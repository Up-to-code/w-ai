import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireOrgAccess } from "./helpers";

const localized = v.record(v.string(), v.string());
const navItem = v.object({ label: localized, href: v.string() });
const socialType = v.union(
  v.literal("facebook"),
  v.literal("twitter"),
  v.literal("instagram"),
  v.literal("linkedin"),
  v.literal("youtube"),
  v.literal("whatsapp"),
);

export const get = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const s = await ctx.db
      .query("siteSettings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();
    const t = await ctx.db
      .query("theme")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();
    return { settings: s ?? null, theme: t ?? null };
  },
  returns: v.object({
    settings: v.union(
      v.null(),
      v.object({
        _id: v.id("siteSettings"),
        _creationTime: v.number(),
        orgId: v.id("organizations"),
        customCode: v.optional(
          v.object({
            head: v.optional(v.string()),
            footer: v.optional(v.string()),
          }),
        ),
        navigation: v.object({
          mainLinks: v.array(navItem),
          secondaryLinks: v.optional(v.array(navItem)),
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
              links: v.array(navItem),
            }),
          ),
          socialLinks: v.array(
            v.object({
              type: socialType,
              url: v.string(),
            }),
          ),
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
        updatedAt: v.number(),
      }),
    ),
    theme: v.union(
      v.null(),
      v.object({
        _id: v.id("theme"),
        _creationTime: v.number(),
        orgId: v.id("organizations"),
        primary: v.string(),
        secondary: v.optional(v.string()),
        accent: v.optional(v.string()),
        background: v.optional(v.string()),
        foreground: v.optional(v.string()),
        radius: v.optional(v.number()),
        font: v.optional(v.string()),
        mode: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
        updatedAt: v.number(),
      }),
    ),
  }),
});

async function requireSettings(ctx: any, orgId: any) {
  const s = await ctx.db
    .query("siteSettings")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .first();
  if (!s) throw new ConvexError("Settings not found");
  return s;
}

export const updateNavigation = mutation({
  args: {
    orgId: v.id("organizations"),
    mainLinks: v.array(navItem),
    secondaryLinks: v.optional(v.array(navItem)),
    ctaLabel: v.optional(localized),
    ctaHref: v.optional(v.string()),
    sticky: v.boolean(),
    showLogo: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.orgId);
    const s = await requireSettings(ctx, args.orgId);
    if (args.mainLinks.length > 20) {
      throw new ConvexError("Maximum of 20 main navigation links");
    }
    await ctx.db.patch(s._id, {
      navigation: {
        ...s.navigation,
        mainLinks: args.mainLinks,
        secondaryLinks: args.secondaryLinks ?? s.navigation.secondaryLinks,
        ctaLabel: args.ctaLabel,
        ctaHref: args.ctaHref,
        sticky: args.sticky,
        showLogo: args.showLogo,
      },
      updatedAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
});

export const updateCustomCode = mutation({
  args: {
    orgId: v.id("organizations"),
    head: v.optional(v.string()),
    footer: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.orgId);
    const settings = await requireSettings(ctx, args.orgId);
    const head = args.head?.trim();
    const footer = args.footer?.trim();
    if ((head?.length ?? 0) > 50_000 || (footer?.length ?? 0) > 50_000) {
      throw new ConvexError("Custom code must be under 50,000 characters per area");
    }
    await ctx.db.patch(settings._id, {
      customCode: {
        head: head || undefined,
        footer: footer || undefined,
      },
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const updateFooter = mutation({
  args: {
    orgId: v.id("organizations"),
    tagline: v.optional(localized),
    sections: v.array(
      v.object({
        title: localized,
        links: v.array(navItem),
      }),
    ),
    socialLinks: v.array(v.object({ type: socialType, url: v.string() })),
    showSocialLinks: v.boolean(),
    copyrightText: v.optional(localized),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.orgId);
    const s = await requireSettings(ctx, args.orgId);
    if (args.sections.length > 8) throw new ConvexError("Maximum of 8 footer sections");
    if (args.socialLinks.length > 10) throw new ConvexError("Maximum of 10 social links");
    await ctx.db.patch(s._id, {
      footer: {
        tagline: args.tagline,
        sections: args.sections,
        socialLinks: args.socialLinks,
        showSocialLinks: args.showSocialLinks,
        copyrightText: args.copyrightText,
      },
      updatedAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
});

export const updateMeta = mutation({
  args: {
    orgId: v.id("organizations"),
    title: v.optional(localized),
    description: v.optional(localized),
    keywords: v.optional(localized),
    ogImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.orgId);
    const s = await requireSettings(ctx, args.orgId);
    await ctx.db.patch(s._id, {
      meta: {
        title: args.title,
        description: args.description,
        keywords: args.keywords,
        ogImage: args.ogImage,
      },
      updatedAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
});

export const updateLogo = mutation({
  args: {
    orgId: v.id("organizations"),
    image: v.optional(v.string()),
    altText: v.optional(localized),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.orgId);
    const s = await requireSettings(ctx, args.orgId);
    await ctx.db.patch(s._id, {
      logo: { image: args.image, altText: args.altText },
      updatedAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
});

export const updateTheme = mutation({
  args: {
    orgId: v.id("organizations"),
    primary: v.optional(v.string()),
    secondary: v.optional(v.string()),
    accent: v.optional(v.string()),
    background: v.optional(v.string()),
    foreground: v.optional(v.string()),
    radius: v.optional(v.number()),
    font: v.optional(v.string()),
    mode: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.orgId);
    const theme = await ctx.db
      .query("theme")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    const { orgId: _o, ...rest } = args;
    const clean = Object.fromEntries(
      Object.entries(rest).filter(([, val]) => val !== undefined),
    );

    if (!theme) {
      await ctx.db.insert("theme", {
        orgId: args.orgId,
        primary: (clean.primary as string) ?? "#C9A227",
        secondary: clean.secondary as string | undefined,
        accent: clean.accent as string | undefined,
        background: clean.background as string | undefined,
        foreground: clean.foreground as string | undefined,
        radius: clean.radius as number | undefined,
        font: clean.font as string | undefined,
        mode: (clean.mode as "light" | "dark" | "system") ?? "light",
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(theme._id, { ...clean, updatedAt: Date.now() });
    }
    return null;
  },
  returns: v.null(),
});
