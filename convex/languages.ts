import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireNonEmpty, requireOrgAccess } from "./helpers";

const langShape = v.object({
  _id: v.id("languages"),
  orgId: v.id("organizations"),
  code: v.string(),
  name: v.string(),
  nativeName: v.optional(v.string()),
  direction: v.optional(v.union(v.literal("ltr"), v.literal("rtl"))),
  preferredFont: v.optional(v.string()),
  rtl: v.boolean(),
  enabled: v.boolean(),
  isDefault: v.boolean(),
  createdAt: v.number(),
});

const CODE_RE = /^[a-z]{2,5}(-[a-z0-9]{2,8})?$/;

export const list = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const rows = await ctx.db
      .query("languages")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows.map((language) => ({
      _id: language._id,
      orgId: language.orgId,
      code: language.code,
      name: language.name,
      nativeName: language.nativeName,
      direction: language.direction,
      preferredFont: language.preferredFont,
      rtl: language.rtl,
      enabled: language.enabled,
      isDefault: language.isDefault,
      createdAt: language.createdAt,
    }));
  },
  returns: v.array(langShape),
});

export const add = mutation({
  args: {
    orgId: v.id("organizations"),
    code: v.string(),
    name: v.string(),
    nativeName: v.optional(v.string()),
    preferredFont: v.optional(v.string()),
    rtl: v.optional(v.boolean()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.orgId);
    const code = args.code.trim().toLowerCase();
    if (!CODE_RE.test(code)) throw new ConvexError("Invalid language code");
    const name = requireNonEmpty(args.name, "Language name", 80);

    const existing = await ctx.db
      .query("languages")
      .withIndex("by_org_code", (q) =>
        q.eq("orgId", args.orgId).eq("code", code),
      )
      .first();
    if (existing) throw new ConvexError("Language already exists");
    const conflictingPage = await ctx.db
      .query("pages")
      .withIndex("by_org_slug", (q) => q.eq("orgId", args.orgId).eq("slug", code))
      .unique();
    const localizedPages = await ctx.db
      .query("pageLocales")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (conflictingPage || localizedPages.some((page) => page.slug === code))
      throw new ConvexError("This language code is already used as a page address");

    const all = await ctx.db
      .query("languages")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (all.length >= 10) throw new ConvexError("Maximum of 10 languages per workspace");

    return ctx.db.insert("languages", {
      orgId: args.orgId,
      code,
      name,
      nativeName: args.nativeName?.trim() || name,
      direction: args.rtl ? "rtl" : "ltr",
      preferredFont: args.preferredFont?.trim() || undefined,
      rtl: args.rtl ?? false,
      enabled: args.enabled ?? true,
      isDefault: all.length === 0,
      createdAt: Date.now(),
    });
  },
  returns: v.id("languages"),
});

export const update = mutation({
  args: {
    orgId: v.id("organizations"),
    code: v.string(),
    name: v.optional(v.string()),
    nativeName: v.optional(v.string()),
    preferredFont: v.optional(v.string()),
    rtl: v.optional(v.boolean()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.orgId);
    const lang = await ctx.db
      .query("languages")
      .withIndex("by_org_code", (q) =>
        q.eq("orgId", args.orgId).eq("code", args.code),
      )
      .first();
    if (!lang) throw new ConvexError("Language not found");

    if (args.enabled === false && lang.isDefault) {
      throw new ConvexError("Cannot disable the default language");
    }
    if (args.enabled === false) {
      const localizedPages = await ctx.db
        .query("pageLocales")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
      if (localizedPages.some((page) => page.localeCode === lang.code))
        throw new ConvexError("Remove this language from every page before disabling it");
    }

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = requireNonEmpty(args.name, "Language name", 80);
    if (args.rtl !== undefined) patch.rtl = args.rtl;
    if (args.rtl !== undefined) patch.direction = args.rtl ? "rtl" : "ltr";
    if (args.nativeName !== undefined)
      patch.nativeName = requireNonEmpty(args.nativeName, "Native name", 80);
    if (args.preferredFont !== undefined)
      patch.preferredFont = requireNonEmpty(args.preferredFont, "Preferred font", 120);
    if (args.enabled !== undefined) patch.enabled = args.enabled;
    if (Object.keys(patch).length > 0) await ctx.db.patch(lang._id, patch);
    return null;
  },
  returns: v.null(),
});

export const setDefault = mutation({
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
    if (!lang.enabled) throw new ConvexError("Enable the language before making it default");

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

export const remove = mutation({
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
    if (lang.isDefault) throw new ConvexError("Cannot remove the default language");
    const localizedPages = await ctx.db
      .query("pageLocales")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (localizedPages.some((page) => page.localeCode === lang.code))
      throw new ConvexError("Remove this language from every page first");

    const all = await ctx.db
      .query("languages")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (all.length <= 1) throw new ConvexError("At least one language is required");

    await ctx.db.delete(lang._id);
    return null;
  },
  returns: v.null(),
});
