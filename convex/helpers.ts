import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";

export type OrgRole = "owner" | "admin" | "editor" | "viewer";

const ROLE_RANK: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

export function roleAtLeast(
  role: OrgRole | null | undefined,
  min: OrgRole,
): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export type OrgId = Id<"organizations">;

const localized = v.record(v.string(), v.string());

/**
 * Public site shape shared by tenant host/slug resolution. Only fields a
 * visitor-facing site needs (theme tokens, nav/footer, enabled languages).
 */
export const publicSiteValidator = v.object({
  id: v.id("organizations"),
  name: v.string(),
  slug: v.string(),
  theme: v.union(
    v.null(),
    v.object({
      primary: v.string(),
      secondary: v.optional(v.string()),
      accent: v.optional(v.string()),
      background: v.optional(v.string()),
      foreground: v.optional(v.string()),
      radius: v.optional(v.number()),
      font: v.optional(v.string()),
      mode: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    }),
  ),
  settings: v.union(
    v.null(),
    v.object({
      customCode: v.optional(
        v.object({
          head: v.optional(v.string()),
          footer: v.optional(v.string()),
        }),
      ),
      navigation: v.object({
        mainLinks: v.array(v.object({ label: localized, href: v.string() })),
        secondaryLinks: v.optional(
          v.array(v.object({ label: localized, href: v.string() })),
        ),
        ctaLabel: v.optional(localized),
        ctaHref: v.optional(v.string()),
        sticky: v.boolean(),
        showLogo: v.boolean(),
      }),
      footer: v.object({
        tagline: v.optional(localized),
        sections: v.array(
          v.object({
            title: localized,
            links: v.array(v.object({ label: localized, href: v.string() })),
          }),
        ),
        socialLinks: v.array(v.object({ type: v.string(), url: v.string() })),
        showSocialLinks: v.boolean(),
        copyrightText: v.optional(localized),
      }),
      logo: v.object({
        image: v.optional(v.string()),
        altText: v.optional(localized),
      }),
      meta: v.object({
        title: v.optional(localized),
        description: v.optional(localized),
        keywords: v.optional(localized),
        ogImage: v.optional(v.string()),
      }),
    }),
  ),
  languages: v.array(
    v.object({
      code: v.string(),
      name: v.string(),
      rtl: v.boolean(),
      isDefault: v.boolean(),
    }),
  ),
});

export async function publicSite(ctx: QueryCtx, orgId: OrgId) {
  const org = await ctx.db.get(orgId);
  if (!org) return null;
  if (org.status === "suspended" || org.status === "deleted") return null;

  const theme = await ctx.db
    .query("theme")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
  const settings = await ctx.db
    .query("siteSettings")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
  const languages = await ctx.db
    .query("languages")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  return {
    id: org._id,
    name: org.name,
    slug: org.slug,
    theme: theme
      ? {
          primary: theme.primary,
          secondary: theme.secondary ?? undefined,
          accent: theme.accent ?? undefined,
          background: theme.background ?? undefined,
          foreground: theme.foreground ?? undefined,
          radius: theme.radius ?? undefined,
          font: theme.font ?? undefined,
          mode: theme.mode,
        }
      : null,
    settings: settings
      ? {
          customCode: settings.customCode,
          navigation: settings.navigation,
          footer: settings.footer,
          logo: settings.logo,
          meta: settings.meta,
        }
      : null,
    languages: languages
      .filter((l) => l.enabled)
      .map((l) => ({
        code: l.code,
        name: l.name,
        rtl: l.rtl,
        isDefault: l.isDefault,
      })),
  };
}

export async function getOrg(ctx: QueryCtx, orgId: OrgId) {
  return ctx.db.get(orgId);
}

type AuthCtx = QueryCtx | MutationCtx;

/**
 * Resolves the authenticated user and verifies they belong to the org with at
 * least `minRole`. Throws ConvexError otherwise.
 */
export async function requireOrgAccess(
  ctx: AuthCtx,
  orgId: OrgId,
  minRole: OrgRole = "viewer",
) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new ConvexError("Not authenticated");
  const org = await ctx.db.get(orgId);
  if (!org) throw new ConvexError("Organization not found");
  if (org.status === "suspended") {
    throw new ConvexError("This workspace is suspended");
  }
  if (org.status === "deleted") {
    throw new ConvexError("This workspace has been deleted");
  }
  const member = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) =>
      q.eq("orgId", orgId).eq("userId", user._id),
    )
    .first();
  if (!member)
    throw new ConvexError("You don't have access to this organization");
  if (!roleAtLeast(member.role, minRole)) {
    throw new ConvexError("You don't have permission to do this");
  }
  return { user, member, org };
}

/** Admin+ guard. */
export function requireAdmin(ctx: AuthCtx, orgId: OrgId) {
  return requireOrgAccess(ctx, orgId, "admin");
}

/** Editor+ guard (can edit content but not members/billing). */
export function requireEditor(ctx: AuthCtx, orgId: OrgId) {
  return requireOrgAccess(ctx, orgId, "editor");
}

/** Owner-only guard. */
export function requireOwner(ctx: AuthCtx, orgId: OrgId) {
  return requireOrgAccess(ctx, orgId, "owner");
}

// ---------------------------------------------------------------------------
// Shared validation helpers
// ---------------------------------------------------------------------------

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const HOSTNAME_RE =
  /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSlug(
  raw: string,
  opts?: { min?: number; max?: number },
) {
  const slug = raw.trim().toLowerCase();
  const min = opts?.min ?? 1;
  const max = opts?.max ?? 80;
  if (!SLUG_RE.test(slug) || slug.length < min || slug.length > max) {
    throw new ConvexError(
      `Slug must be ${min}-${max} chars, lowercase letters, numbers and dashes only`,
    );
  }
  return slug;
}

export function normalizeHostname(raw: string) {
  const hostname = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .replace(/\.$/, "");
  if (!HOSTNAME_RE.test(hostname)) {
    throw new ConvexError("Invalid domain");
  }
  return hostname;
}

export function requireNonEmpty(value: string, label: string, max = 500) {
  const trimmed = value.trim();
  if (!trimmed) throw new ConvexError(`${label} is required`);
  if (trimmed.length > max) throw new ConvexError(`${label} is too long`);
  return trimmed;
}

export function optionalEmail(value: string | undefined) {
  if (value === undefined || value === "") return undefined;
  const email = value.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new ConvexError("Invalid email address");
  return email;
}

export function randomToken(bytes = 16): string {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > 128) {
    throw new ConvexError("Token size must be between 1 and 128 bytes");
  }
  const entropy = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(entropy, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/** Write an audit/activity event. Failures must never break the main mutation. */
export async function logEvent(
  ctx: MutationCtx,
  args: {
    orgId?: OrgId;
    userId?: string;
    type: string;
    title: string;
    description?: string;
    metadata?: unknown;
  },
) {
  await ctx.db.insert("events", {
    orgId: args.orgId,
    userId: args.userId,
    type: args.type,
    title: args.title,
    description: args.description,
    metadata: args.metadata,
    createdAt: Date.now(),
  });
}

/**
 * Cascade-delete every row that belongs to an organization. Call only after
 * owner authorization. Order does not matter for Convex document deletes.
 */
export async function cascadeDeleteOrg(ctx: MutationCtx, orgId: OrgId) {
  const deleteAll = async <T extends { _id: Id<any> }>(rows: T[]) => {
    for (const row of rows) await ctx.db.delete(row._id);
  };

  await deleteAll(
    await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("languages")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("pages")
      .withIndex("by_org_order", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("domains")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("redirectRules")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(1000),
  );
  await deleteAll(
    await ctx.db
      .query("domainOrderEvents")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(1000),
  );
  await deleteAll(
    await ctx.db
      .query("domainOrders")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(1000),
  );
  await deleteAll(
    await ctx.db
      .query("properties")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("posts")
      .withIndex("by_org_created", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("contacts")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("interests")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("services")
      .withIndex("by_org_order", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("assets")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("mapLocations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("forms")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("formSubmissions")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("conversations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("messages")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("events")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  await deleteAll(
    await ctx.db
      .query("cmsEntries")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(1000),
  );
  await deleteAll(
    await ctx.db
      .query("cmsCollections")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(1000),
  );
  await deleteAll(
    await ctx.db
      .query("libraryInstallations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(1000),
  );
  await deleteAll(
    await ctx.db
      .query("libraryEntitlements")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(1000),
  );
  await deleteAll(
    await ctx.db
      .query("componentLibraries")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(1000),
  );

  const themeDoc = await ctx.db
    .query("theme")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
  if (themeDoc) await ctx.db.delete(themeDoc._id);

  const settings = await ctx.db
    .query("siteSettings")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
  if (settings) await ctx.db.delete(settings._id);

  await ctx.db.delete(orgId);
}
