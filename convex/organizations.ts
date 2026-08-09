import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";
import {
  cascadeDeleteOrg,
  logEvent,
  normalizeSlug,
  OrgId,
  publicSite,
  publicSiteValidator,
  requireAdmin,
  requireNonEmpty,
  requireOrgAccess,
  requireOwner,
} from "./helpers";
import { assertOrgCreateAllowed, assertWithinLimit, getUsage } from "./limits";
import { loc, pageDataForTemplate } from "./pageTemplates";

// Default brand palette (Qentrah style): refined gold on warm neutrals.
const DEFAULT_THEME = {
  primary: "#C9A227",
  secondary: "#1F2937",
  accent: "#0F766E",
  background: "#F5F2EC",
  foreground: "#17120B",
  radius: 12,
  font: "tajawal",
  mode: "light" as const,
};

async function bootstrapOrg(ctx: MutationCtx, orgId: OrgId) {
  await ctx.db.insert("languages", {
    orgId,
    code: "ar",
    name: "العربية",
    rtl: true,
    enabled: true,
    isDefault: false,
    createdAt: Date.now(),
  });
  await ctx.db.insert("languages", {
    orgId,
    code: "en",
    name: "English",
    rtl: false,
    enabled: true,
    isDefault: true,
    createdAt: Date.now(),
  });

  await ctx.db.insert("theme", {
    orgId,
    ...DEFAULT_THEME,
    updatedAt: Date.now(),
  });

  await ctx.db.insert("siteSettings", {
    orgId,
    navigation: {
      mainLinks: [
        { label: loc("الرئيسية", "Home"), href: "/" },
        { label: loc("الخدمات", "Services"), href: "/services" },
        { label: loc("الوحدات", "Properties"), href: "/properties" },
        { label: loc("المدونة", "Blog"), href: "/blog" },
        { label: loc("تواصل معنا", "Contact"), href: "/contact" },
      ],
      sticky: true,
      showLogo: true,
    },
    footer: {
      tagline: loc("", ""),
      sections: [],
      socialLinks: [],
      showSocialLinks: false,
      copyrightText: loc("جميع الحقوق محفوظة", "All rights reserved"),
    },
    logo: {},
    meta: {
      title: loc("", ""),
      description: loc("", ""),
    },
    updatedAt: Date.now(),
  });

  const starterPages = [
    { slug: "home", title: loc("الرئيسية", "Home"), order: 0 },
    { slug: "about", title: loc("من نحن", "About"), order: 1 },
    { slug: "services", title: loc("خدماتنا", "Services"), order: 2 },
    { slug: "properties", title: loc("الوحدات", "Properties"), order: 3 },
    { slug: "blog", title: loc("المدونة", "Blog"), order: 4 },
    { slug: "contact", title: loc("تواصل معنا", "Contact"), order: 5 },
  ];
  const now = Date.now();
  const starterTemplates: Record<
    string,
    ReturnType<typeof pageDataForTemplate>
  > = {
    home: pageDataForTemplate("landing"),
    about: pageDataForTemplate("content"),
    services: pageDataForTemplate("content"),
    properties: pageDataForTemplate("properties"),
    blog: pageDataForTemplate("content"),
    contact: pageDataForTemplate("contact"),
  };

  for (const page of starterPages) {
    await ctx.db.insert("pages", {
      orgId,
      slug: page.slug,
      title: page.title,
      published: page.slug === "home",
      order: page.order,
      data: starterTemplates[page.slug] ?? pageDataForTemplate("blank"),
      createdAt: now,
      updatedAt: now,
    });
  }
}

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);

    await assertOrgCreateAllowed(ctx, user._id);

    const name = requireNonEmpty(args.name, "Organization name", 80);
    if (name.length < 2)
      throw new ConvexError("Organization name must be at least 2 characters");
    const slug = normalizeSlug(args.slug, { min: 3, max: 40 });

    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) throw new ConvexError("This site address is already taken");

    const orgId = await ctx.db.insert("organizations", {
      name,
      slug,
      plan: "free",
      status: "active",
      createdAt: Date.now(),
    });

    await ctx.db.insert("memberships", {
      orgId,
      userId: user._id,
      role: "owner",
      createdAt: Date.now(),
    });

    await bootstrapOrg(ctx, orgId);

    await logEvent(ctx, {
      orgId,
      userId: user._id,
      type: "org.create",
      title: `Workspace created: ${name}`,
      metadata: { slug },
    });

    return orgId;
  },
  returns: v.id("organizations"),
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const orgs = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.orgId);
      if (org && org.status !== "deleted") {
        orgs.push({
          _id: org._id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          role: m.role,
          status: org.status ?? "active",
          createdAt: org.createdAt,
        });
      }
    }
    return orgs;
  },
  returns: v.array(
    v.object({
      _id: v.id("organizations"),
      name: v.string(),
      slug: v.string(),
      plan: v.optional(
        v.union(
          v.literal("free"),
          v.literal("starter"),
          v.literal("pro"),
          v.literal("enterprise"),
        ),
      ),
      role: v.string(),
      status: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
});

async function getOrgDetails(ctx: QueryCtx, orgId: OrgId) {
  const { user, member } = await requireOrgAccess(ctx, orgId);
  const org = await ctx.db.get(orgId);
  if (!org) throw new ConvexError("Organization not found");

  const members = await ctx.db
    .query("memberships")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const memberUsers = [];
  for (const m of members) {
    memberUsers.push({
      userId: m.userId,
      role: m.role,
      createdAt: m.createdAt,
    });
  }

  const languages = await ctx.db
    .query("languages")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const domains = await ctx.db
    .query("domains")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();

  return {
    org: {
      _id: org._id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      billingEmail: org.billingEmail,
      avatar: org.avatar,
      status: org.status ?? "active",
      createdAt: org.createdAt,
    },
    myRole: member.role,
    myUserId: user._id,
    members: memberUsers,
    languages: languages.map((l) => ({
      _id: l._id,
      code: l.code,
      name: l.name,
      rtl: l.rtl,
      enabled: l.enabled,
      isDefault: l.isDefault,
    })),
    domains: domains.map((d) => ({
      _id: d._id,
      hostname: d.hostname,
      verified: d.verified,
      redirectTo: d.redirectTo,
      redirectStatusCode: d.redirectStatusCode,
      verificationToken: d.verificationToken,
      verifiedAt: d.verifiedAt,
    })),
  };
}

const orgDetailsValidator = v.object({
  org: v.object({
    _id: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    plan: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("pro"),
      v.literal("enterprise"),
    ),
    billingEmail: v.optional(v.string()),
    avatar: v.optional(v.string()),
    status: v.optional(v.string()),
    createdAt: v.number(),
  }),
  myRole: v.string(),
  myUserId: v.string(),
  members: v.array(
    v.object({
      userId: v.string(),
      role: v.string(),
      createdAt: v.number(),
    }),
  ),
  languages: v.array(
    v.object({
      _id: v.id("languages"),
      code: v.string(),
      name: v.string(),
      rtl: v.boolean(),
      enabled: v.boolean(),
      isDefault: v.boolean(),
    }),
  ),
  domains: v.array(
    v.object({
      _id: v.id("domains"),
      hostname: v.string(),
      verified: v.boolean(),
      redirectTo: v.optional(v.string()),
      redirectStatusCode: v.optional(
        v.union(v.literal(301), v.literal(302), v.literal(307), v.literal(308)),
      ),
      verificationToken: v.optional(v.string()),
      verifiedAt: v.optional(v.number()),
    }),
  ),
});

export const get = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return getOrgDetails(ctx, args.orgId);
  },
  returns: orgDetailsValidator,
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!org) throw new ConvexError("Organization not found");
    return getOrgDetails(ctx, org._id);
  },
  returns: orgDetailsValidator,
});

/** Public info used to resolve a tenant site by slug (subdomain or custom domain). */
export const getPublicBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!org) return null;
    return publicSite(ctx, org._id);
  },
  returns: v.union(v.null(), publicSiteValidator),
});

export const update = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.orgId);
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new ConvexError("Organization not found");

    const patch: {
      name?: string;
      slug?: string;
      billingEmail?: string;
      avatar?: string;
    } = {};
    if (args.name !== undefined) {
      const name = requireNonEmpty(args.name, "Organization name", 80);
      if (name.length < 2)
        throw new ConvexError(
          "Organization name must be at least 2 characters",
        );
      patch.name = name;
    }
    if (args.slug !== undefined) {
      const slug = normalizeSlug(args.slug, { min: 3, max: 40 });
      if (slug !== org.slug) {
        const existing = await ctx.db
          .query("organizations")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .first();
        if (existing)
          throw new ConvexError("This site address is already taken");
        patch.slug = slug;
      }
    }
    if (args.billingEmail !== undefined)
      patch.billingEmail = args.billingEmail.trim();
    if (args.avatar !== undefined) patch.avatar = args.avatar;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.orgId, patch);
    }
    return null;
  },
  returns: v.null(),
});

export const addMember = mutation({
  args: {
    orgId: v.id("organizations"),
    email: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const { user, member } = await requireAdmin(ctx, args.orgId);
    await assertWithinLimit(ctx, args.orgId, "members");

    if (args.role === "owner" && member.role !== "owner") {
      throw new ConvexError("Only owners can grant owner role");
    }

    const email = args.email.trim().toLowerCase();
    if (!email) throw new ConvexError("Email is required");

    const target = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: email }],
    });
    if (!target) throw new ConvexError("No account found with this email");

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", target._id),
      )
      .first();
    if (existing) throw new ConvexError("This user is already a member");

    await ctx.db.insert("memberships", {
      orgId: args.orgId,
      userId: target._id,
      role: args.role,
      createdAt: Date.now(),
    });

    await logEvent(ctx, {
      orgId: args.orgId,
      userId: user._id,
      type: "org.member_add",
      title: `Member added: ${email}`,
      metadata: { role: args.role },
    });
    return null;
  },
  returns: v.null(),
});

export const updateMemberRole = mutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const { member, user } = await requireOrgAccess(ctx, args.orgId, "admin");

    const target = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.userId),
      )
      .first();
    if (!target) throw new ConvexError("Member not found");

    // Only owners can change owner roles or promote to owner.
    if (target.role === "owner" && member.role !== "owner") {
      throw new ConvexError("Only owners can change another owner's role");
    }
    if (args.role === "owner" && member.role !== "owner") {
      throw new ConvexError("Only owners can grant owner role");
    }
    // Prevent demoting the last owner.
    if (target.role === "owner" && args.role !== "owner") {
      const owners = await ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
      const ownerCount = owners.filter((m) => m.role === "owner").length;
      if (ownerCount <= 1) {
        throw new ConvexError("Cannot demote the last owner");
      }
    }

    await ctx.db.patch(target._id, { role: args.role });
    await logEvent(ctx, {
      orgId: args.orgId,
      userId: user._id,
      type: "org.member_role",
      title: `Role updated to ${args.role}`,
      metadata: { targetUserId: args.userId },
    });
    return null;
  },
  returns: v.null(),
});

export const removeMember = mutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { member, user } = await requireOrgAccess(ctx, args.orgId, "admin");

    const target = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.userId),
      )
      .first();
    if (!target) throw new ConvexError("Member not found");

    if (target.role === "owner")
      throw new ConvexError("Owners cannot be removed");
    if (member.role !== "owner" && member.role !== "admin") {
      throw new ConvexError("Only admins can remove members");
    }
    // Admins cannot remove other admins — only owners can.
    if (target.role === "admin" && member.role !== "owner") {
      throw new ConvexError("Only owners can remove admins");
    }
    if (args.userId === user._id) throw new ConvexError("Use leave instead");

    await ctx.db.delete(target._id);
    await logEvent(ctx, {
      orgId: args.orgId,
      userId: user._id,
      type: "org.member_remove",
      title: "Member removed",
      metadata: { targetUserId: args.userId },
    });
    return null;
  },
  returns: v.null(),
});

export const leave = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { user } = await requireOrgAccess(ctx, args.orgId);
    const member = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", user._id),
      )
      .first();
    if (!member) return null;
    if (member.role === "owner") {
      const members = await ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
      const ownerCount = members.filter((m) => m.role === "owner").length;
      if (ownerCount <= 1) {
        throw new ConvexError("Transfer ownership before leaving");
      }
    }
    await ctx.db.delete(member._id);
    return null;
  },
  returns: v.null(),
});

export const remove = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { user } = await requireOwner(ctx, args.orgId);
    await logEvent(ctx, {
      orgId: args.orgId,
      userId: user._id,
      type: "org.delete",
      title: "Workspace deleted",
    });
    await cascadeDeleteOrg(ctx, args.orgId);
    return null;
  },
  returns: v.null(),
});

const themePatch = v.object({
  primary: v.optional(v.string()),
  secondary: v.optional(v.string()),
  accent: v.optional(v.string()),
  background: v.optional(v.string()),
  foreground: v.optional(v.string()),
  radius: v.optional(v.number()),
  font: v.optional(v.string()),
  mode: v.optional(
    v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
  ),
});

export const updateBranding = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.optional(v.string()),
    theme: v.optional(themePatch),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.orgId);

    if (args.name !== undefined) {
      const name = requireNonEmpty(args.name, "Organization name", 80);
      if (name.length < 2)
        throw new ConvexError(
          "Organization name must be at least 2 characters",
        );
      await ctx.db.patch(args.orgId, { name });
    }

    if (args.theme) {
      const theme = await ctx.db
        .query("theme")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .first();
      if (!theme) {
        await ctx.db.insert("theme", {
          orgId: args.orgId,
          primary: args.theme.primary ?? DEFAULT_THEME.primary,
          secondary: args.theme.secondary ?? DEFAULT_THEME.secondary,
          accent: args.theme.accent ?? DEFAULT_THEME.accent,
          background: args.theme.background ?? DEFAULT_THEME.background,
          foreground: args.theme.foreground ?? DEFAULT_THEME.foreground,
          radius: args.theme.radius ?? DEFAULT_THEME.radius,
          font: args.theme.font ?? DEFAULT_THEME.font,
          mode: args.theme.mode ?? "light",
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.patch(theme._id, {
          ...(args.theme.primary !== undefined
            ? { primary: args.theme.primary }
            : {}),
          ...(args.theme.secondary !== undefined
            ? { secondary: args.theme.secondary }
            : {}),
          ...(args.theme.accent !== undefined
            ? { accent: args.theme.accent }
            : {}),
          ...(args.theme.background !== undefined
            ? { background: args.theme.background }
            : {}),
          ...(args.theme.foreground !== undefined
            ? { foreground: args.theme.foreground }
            : {}),
          ...(args.theme.radius !== undefined
            ? { radius: args.theme.radius }
            : {}),
          ...(args.theme.font !== undefined ? { font: args.theme.font } : {}),
          ...(args.theme.mode !== undefined ? { mode: args.theme.mode } : {}),
          updatedAt: Date.now(),
        });
      }
    }
    return null;
  },
  returns: v.null(),
});

export const setDefaultLanguage = mutation({
  args: { orgId: v.id("organizations"), code: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.orgId);
    const lang = await ctx.db
      .query("languages")
      .withIndex("by_org_code", (q) =>
        q.eq("orgId", args.orgId).eq("code", args.code),
      )
      .first();
    if (!lang) throw new ConvexError("Language not found");
    const all = await ctx.db
      .query("languages")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    for (const l of all) {
      await ctx.db.patch(l._id, { isDefault: l._id === lang._id });
    }
    return null;
  },
  returns: v.null(),
});

/** Plan usage for the settings / billing panel. */
export const getPlanUsage = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    return getUsage(ctx, args.orgId);
  },
  returns: v.object({
    plan: v.string(),
    limits: v.object({
      pages: v.number(),
      properties: v.number(),
      posts: v.number(),
      services: v.number(),
      members: v.number(),
      domains: v.number(),
      assets: v.number(),
      forms: v.number(),
      mapLocations: v.number(),
      assetBytes: v.number(),
    }),
    usage: v.object({
      pages: v.number(),
      properties: v.number(),
      posts: v.number(),
      services: v.number(),
      members: v.number(),
      domains: v.number(),
      assets: v.number(),
      forms: v.number(),
      mapLocations: v.number(),
      assetBytes: v.number(),
    }),
  }),
});
