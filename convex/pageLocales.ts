import { ConvexError, v } from "convex/values";

import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  normalizeSlug,
  requireEditor,
  requireOrgAccess,
} from "./helpers";

const localeStatus = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("unpublished_changes"),
);

const localeRow = v.object({
  _id: v.id("pageLocales"),
  pageId: v.id("pages"),
  localeCode: v.string(),
  slug: v.string(),
  title: v.string(),
  status: localeStatus,
  seo: v.optional(
    v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      ogImage: v.optional(v.string()),
    }),
  ),
  updatedAt: v.number(),
});

async function pageBySlug(
  ctx: QueryCtx | MutationCtx,
  orgId: Parameters<typeof requireOrgAccess>[1],
  slug: string,
) {
  const page = await ctx.db
    .query("pages")
    .withIndex("by_org_slug", (q) => q.eq("orgId", orgId).eq("slug", slug))
    .unique();
  if (!page) throw new ConvexError("Page not found");
  return page;
}

async function enabledLanguage(
  ctx: QueryCtx | MutationCtx,
  orgId: Parameters<typeof requireOrgAccess>[1],
  localeCode: string,
) {
  const language = await ctx.db
    .query("languages")
    .withIndex("by_org_code", (q) =>
      q.eq("orgId", orgId).eq("code", localeCode),
    )
    .unique();
  if (!language?.enabled) throw new ConvexError("Language is not enabled");
  return language;
}

export const listForPage = query({
  args: { orgId: v.id("organizations"), pageSlug: v.string() },
  returns: v.object({
    pageId: v.id("pages"),
    defaultLocale: v.string(),
    locales: v.array(localeRow),
  }),
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const page = await pageBySlug(ctx, args.orgId, args.pageSlug);
    const [rows, languages] = await Promise.all([
      ctx.db
        .query("pageLocales")
        .withIndex("by_page", (q) => q.eq("pageId", page._id))
        .collect(),
      ctx.db
        .query("languages")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect(),
    ]);
    const defaultLocale = languages.find((language) => language.isDefault)?.code ?? "en";
    return {
      pageId: page._id,
      defaultLocale,
      locales: rows.map((row) => ({
        _id: row._id,
        pageId: row.pageId,
        localeCode: row.localeCode,
        slug: row.slug,
        title: row.title,
        status: row.status,
        seo: row.seo,
        updatedAt: row.updatedAt,
      })),
    };
  },
});

export const enable = mutation({
  args: {
    orgId: v.id("organizations"),
    pageSlug: v.string(),
    localeCode: v.string(),
    localizedSlug: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  returns: v.id("pageLocales"),
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const page = await pageBySlug(ctx, args.orgId, args.pageSlug);
    const language = await enabledLanguage(ctx, args.orgId, args.localeCode);
    const existing = await ctx.db
      .query("pageLocales")
      .withIndex("by_page_locale", (q) =>
        q.eq("pageId", page._id).eq("localeCode", args.localeCode),
      )
      .unique();
    if (existing) return existing._id;

    const slug = normalizeSlug(args.localizedSlug ?? page.slug, {
      min: 1,
      max: 80,
    });
    const conflict = await ctx.db
      .query("pageLocales")
      .withIndex("by_org_locale_slug", (q) =>
        q
          .eq("orgId", args.orgId)
          .eq("localeCode", args.localeCode)
          .eq("slug", slug),
      )
      .unique();
    if (conflict) throw new ConvexError("This localized address is already used");

    const now = Date.now();
    return ctx.db.insert("pageLocales", {
      orgId: args.orgId,
      pageId: page._id,
      localeCode: args.localeCode,
      slug,
      title:
        args.title?.trim() ||
        page.title[args.localeCode] ||
        page.title.en ||
        Object.values(page.title)[0] ||
        page.slug,
      status: language.isDefault && page.published ? "published" : "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateDetails = mutation({
  args: {
    orgId: v.id("organizations"),
    pageSlug: v.string(),
    localeCode: v.string(),
    localizedSlug: v.string(),
    title: v.string(),
    seo: v.optional(
      v.object({
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        ogImage: v.optional(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const page = await pageBySlug(ctx, args.orgId, args.pageSlug);
    await enabledLanguage(ctx, args.orgId, args.localeCode);
    const locale = await ctx.db
      .query("pageLocales")
      .withIndex("by_page_locale", (q) =>
        q.eq("pageId", page._id).eq("localeCode", args.localeCode),
      )
      .unique();
    if (!locale) throw new ConvexError("Enable this language first");
    const slug = normalizeSlug(args.localizedSlug, { min: 1, max: 80 });
    const languages = await ctx.db
      .query("languages")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (languages.some((language) => language.enabled && language.code === slug))
      throw new ConvexError("Language codes are reserved and cannot be page addresses");
    const conflict = await ctx.db
      .query("pageLocales")
      .withIndex("by_org_locale_slug", (q) =>
        q
          .eq("orgId", args.orgId)
          .eq("localeCode", args.localeCode)
          .eq("slug", slug),
      )
      .unique();
    if (conflict && conflict._id !== locale._id)
      throw new ConvexError("This localized address is already used");
    const title = args.title.trim();
    if (!title) throw new ConvexError("Page title is required");
    await ctx.db.patch(locale._id, {
      slug,
      title,
      seo: args.seo,
      status: locale.publishedRevisionId ? "unpublished_changes" : locale.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const saveDocument = mutation({
  args: {
    orgId: v.id("organizations"),
    pageSlug: v.string(),
    localeCode: v.string(),
    data: v.any(),
    expectedUpdatedAt: v.optional(v.number()),
  },
  returns: v.object({ updatedAt: v.number(), revisionId: v.id("pageRevisions") }),
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.orgId);
    const page = await pageBySlug(ctx, args.orgId, args.pageSlug);
    await enabledLanguage(ctx, args.orgId, args.localeCode);
    if (
      args.expectedUpdatedAt !== undefined &&
      page.updatedAt !== args.expectedUpdatedAt
    ) {
      throw new ConvexError("This page changed in another session. Reload before saving.");
    }
    const locale = await ctx.db
      .query("pageLocales")
      .withIndex("by_page_locale", (q) =>
        q.eq("pageId", page._id).eq("localeCode", args.localeCode),
      )
      .unique();
    if (!locale) throw new ConvexError("Enable this language for the page first");

    const now = Date.now();
    const revisionId = await ctx.db.insert("pageRevisions", {
      orgId: args.orgId,
      pageId: page._id,
      localeCode: args.localeCode,
      data: page.data,
      source: "save",
      createdBy: user._id,
      createdAt: now,
    });
    await ctx.db.patch(page._id, {
      data: args.data,
      editorVersion: 2,
      updatedAt: now,
    });
    await ctx.db.patch(locale._id, {
      status: locale.publishedRevisionId ? "unpublished_changes" : "draft",
      updatedAt: now,
    });
    return { updatedAt: now, revisionId };
  },
});

export const publish = mutation({
  args: {
    orgId: v.id("organizations"),
    pageSlug: v.string(),
    localeCode: v.string(),
  },
  returns: v.id("pageRevisions"),
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.orgId);
    const page = await pageBySlug(ctx, args.orgId, args.pageSlug);
    const language = await enabledLanguage(ctx, args.orgId, args.localeCode);
    const locale = await ctx.db
      .query("pageLocales")
      .withIndex("by_page_locale", (q) =>
        q.eq("pageId", page._id).eq("localeCode", args.localeCode),
      )
      .unique();
    if (!locale) throw new ConvexError("Enable this language for the page first");
    const now = Date.now();
    const revisionId = await ctx.db.insert("pageRevisions", {
      orgId: args.orgId,
      pageId: page._id,
      localeCode: args.localeCode,
      data: page.data,
      source: "publish",
      createdBy: user._id,
      createdAt: now,
    });
    await ctx.db.patch(locale._id, {
      status: "published",
      publishedRevisionId: revisionId,
      updatedAt: now,
    });
    if (language.isDefault) {
      await ctx.db.patch(page._id, { published: true });
    }
    return revisionId;
  },
});

export const unpublish = mutation({
  args: {
    orgId: v.id("organizations"),
    pageSlug: v.string(),
    localeCode: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const page = await pageBySlug(ctx, args.orgId, args.pageSlug);
    const language = await enabledLanguage(ctx, args.orgId, args.localeCode);
    const locale = await ctx.db
      .query("pageLocales")
      .withIndex("by_page_locale", (q) =>
        q.eq("pageId", page._id).eq("localeCode", args.localeCode),
      )
      .unique();
    if (!locale) throw new ConvexError("Page language not found");
    const now = Date.now();
    await ctx.db.patch(locale._id, {
      status: "draft",
      publishedRevisionId: undefined,
      updatedAt: now,
    });
    if (language.isDefault) {
      await ctx.db.patch(page._id, { published: false });
    }
    return null;
  },
});

export const remove = mutation({
  args: {
    orgId: v.id("organizations"),
    pageSlug: v.string(),
    localeCode: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const page = await pageBySlug(ctx, args.orgId, args.pageSlug);
    const language = await enabledLanguage(ctx, args.orgId, args.localeCode);
    if (language.isDefault) throw new ConvexError("Cannot remove the default language");
    const locale = await ctx.db
      .query("pageLocales")
      .withIndex("by_page_locale", (q) =>
        q.eq("pageId", page._id).eq("localeCode", args.localeCode),
      )
      .unique();
    if (!locale) return null;
    if (locale.publishedRevisionId)
      throw new ConvexError("Unpublish this language before removing it");
    await ctx.db.delete(locale._id);
    return null;
  },
});

/** Public tenant lookup. Secondary locales never fall back to English. */
export const resolvePublished = query({
  args: {
    orgId: v.id("organizations"),
    localeCode: v.string(),
    slug: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      pageId: v.id("pages"),
      localeCode: v.string(),
      slug: v.string(),
      title: v.string(),
      data: v.any(),
      seo: v.optional(v.any()),
    }),
  ),
  handler: async (ctx, args) => {
    const locale = await ctx.db
      .query("pageLocales")
      .withIndex("by_org_locale_slug", (q) =>
        q
          .eq("orgId", args.orgId)
          .eq("localeCode", args.localeCode)
          .eq("slug", args.slug),
      )
      .unique();
    if (!locale || locale.status !== "published" || !locale.publishedRevisionId)
      return null;
    const revision = await ctx.db.get(locale.publishedRevisionId);
    if (!revision) return null;
    return {
      pageId: locale.pageId,
      localeCode: locale.localeCode,
      slug: locale.slug,
      title: locale.title,
      data: revision.data,
      seo: locale.seo,
    };
  },
});

export const listPublishedForNavigation = query({
  args: { orgId: v.id("organizations"), localeCode: v.string() },
  returns: v.array(
    v.object({
      pageId: v.id("pages"),
      slug: v.string(),
      title: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pageLocales")
      .withIndex("by_org_locale_status", (q) =>
        q
          .eq("orgId", args.orgId)
          .eq("localeCode", args.localeCode)
          .eq("status", "published"),
      )
      .collect();
    return rows
      .filter((row) => row.publishedRevisionId)
      .map((row) => ({ pageId: row.pageId, slug: row.slug, title: row.title }));
  },
});

/** Public alternate URLs for canonical/hreflang output. */
export const listPublishedAlternates = query({
  args: { pageId: v.id("pages") },
  returns: v.array(
    v.object({
      localeCode: v.string(),
      slug: v.string(),
      title: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pageLocales")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .collect();
    return rows
      .filter((row) => row.status === "published" && row.publishedRevisionId)
      .map((row) => ({
        localeCode: row.localeCode,
        slug: row.slug,
        title: row.title,
      }));
  },
});
