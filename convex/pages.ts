import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  logEvent,
  normalizeSlug,
  requireEditor,
  requireOrgAccess,
} from "./helpers";
import { assertWithinLimit } from "./limits";
import { pageDataForTemplate } from "./pageTemplates";

const puckData = v.object({
  root: v.any(),
  content: v.array(v.any()),
  zones: v.optional(v.any()),
});

const qentrahData = v.object({
  builder: v.literal("qentrah"),
  version: v.literal(1),
  serialized: v.string(),
});

// Existing Puck pages remain readable while each page migrates to Qentrah on
// its first save. New writes use the explicit, versioned Qentrah envelope.
const pageData = v.union(puckData, qentrahData);

function componentCount(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const value = data as {
    content?: unknown;
    builder?: unknown;
    serialized?: unknown;
  };
  if (Array.isArray(value.content)) return value.content.length;
  if (value.builder !== "qentrah" || typeof value.serialized !== "string")
    return 0;
  try {
    const nodes = JSON.parse(value.serialized) as Record<string, unknown>;
    return Math.max(0, Object.keys(nodes).length - 1);
  } catch {
    return 0;
  }
}

const pageTitle = v.record(v.string(), v.string());
const pageTemplate = v.union(
  v.literal("blank"),
  v.literal("landing"),
  v.literal("content"),
  v.literal("contact"),
  v.literal("properties"),
);

const pagePublic = v.object({
  slug: v.string(),
  title: pageTitle,
  published: v.boolean(),
  data: pageData,
  seo: v.optional(
    v.object({
      title: v.optional(pageTitle),
      description: v.optional(pageTitle),
      ogImage: v.optional(v.string()),
    }),
  ),
});

export const listPublished = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_org_published", (q) =>
        q.eq("orgId", args.orgId).eq("published", true),
      )
      .collect();
    return pages
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ slug: p.slug, title: p.title, order: p.order }));
  },
  returns: v.array(
    v.object({
      slug: v.string(),
      title: pageTitle,
      order: v.number(),
    }),
  ),
});

export const getHomePage = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("pages")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", "home"),
      )
      .first();
    if (!page || !page.published) return null;
    return {
      slug: page.slug,
      title: page.title,
      published: page.published,
      data: page.data,
      seo: page.seo,
    };
  },
  returns: v.union(v.null(), pagePublic),
});

export const getPageBySlug = query({
  args: { orgId: v.id("organizations"), slug: v.string() },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("pages")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .first();
    if (!page || !page.published) return null;
    return {
      slug: page.slug,
      title: page.title,
      published: page.published,
      data: page.data,
      seo: page.seo,
    };
  },
  returns: v.union(v.null(), pagePublic),
});

// ---------------------------------------------------------------------------
// Authenticated (dashboard) page management. Every function re-derives org
// access server-side from the caller's membership — never from the client.
// ---------------------------------------------------------------------------

export const listPages = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_org_order", (q) => q.eq("orgId", args.orgId))
      .collect();
    return pages
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        slug: p.slug,
        title: p.title,
        published: p.published,
        order: p.order,
        componentCount: componentCount(p.data),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
  },
  returns: v.array(
    v.object({
      slug: v.string(),
      title: pageTitle,
      published: v.boolean(),
      order: v.number(),
      componentCount: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
});

export const getEditablePage = query({
  args: { orgId: v.id("organizations"), slug: v.string() },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const page = await ctx.db
      .query("pages")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .first();
    if (!page) throw new ConvexError("Page not found");
    return {
      slug: page.slug,
      title: page.title,
      published: page.published,
      order: page.order,
      updatedAt: page.updatedAt,
      data: page.data,
    };
  },
  returns: v.object({
    slug: v.string(),
    title: pageTitle,
    published: v.boolean(),
    order: v.number(),
    updatedAt: v.number(),
    data: pageData,
  }),
});

export const createPage = mutation({
  args: {
    orgId: v.id("organizations"),
    slug: v.string(),
    title: pageTitle,
    template: v.optional(pageTemplate),
  },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.orgId);
    await assertWithinLimit(ctx, args.orgId, "pages");
    const slug = normalizeSlug(args.slug, { min: 1, max: 80 });
    const existing = await ctx.db
      .query("pages")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", slug),
      )
      .first();
    if (existing)
      throw new ConvexError("A page with this address already exists");

    const max = await ctx.db
      .query("pages")
      .withIndex("by_org_order", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .first();
    const now = Date.now();
    const id = await ctx.db.insert("pages", {
      orgId: args.orgId,
      slug,
      title: args.title,
      published: false,
      order: (max?.order ?? -1) + 1,
      data: pageDataForTemplate(args.template ?? "content"),
      createdAt: now,
      updatedAt: now,
    });
    await logEvent(ctx, {
      orgId: args.orgId,
      userId: user._id,
      type: "page.create",
      title: `Page created: ${slug}`,
    });
    return id;
  },
  returns: v.id("pages"),
});

export const savePage = mutation({
  args: {
    orgId: v.id("organizations"),
    slug: v.string(),
    data: pageData,
    title: v.optional(pageTitle),
    published: v.optional(v.boolean()),
    seo: v.optional(
      v.object({
        title: v.optional(pageTitle),
        description: v.optional(pageTitle),
        ogImage: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const page = await ctx.db
      .query("pages")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .first();
    if (!page) throw new ConvexError("Page not found");
    await ctx.db.patch(page._id, {
      data: args.data,
      ...(args.title ? { title: args.title } : {}),
      ...(args.published !== undefined ? { published: args.published } : {}),
      ...(args.seo !== undefined ? { seo: args.seo } : {}),
      updatedAt: Date.now(),
    });
    return page._id;
  },
  returns: v.id("pages"),
});

export const renamePage = mutation({
  args: {
    orgId: v.id("organizations"),
    slug: v.string(),
    newSlug: v.optional(v.string()),
    title: v.optional(pageTitle),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const page = await ctx.db
      .query("pages")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .first();
    if (!page) throw new ConvexError("Page not found");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title) patch.title = args.title;
    if (args.newSlug !== undefined) {
      if (page.slug === "home") {
        throw new ConvexError("The home page address cannot be changed");
      }
      const newSlug = normalizeSlug(args.newSlug, { min: 1, max: 80 });
      if (newSlug !== page.slug) {
        const clash = await ctx.db
          .query("pages")
          .withIndex("by_org_slug", (q) =>
            q.eq("orgId", args.orgId).eq("slug", newSlug),
          )
          .first();
        if (clash)
          throw new ConvexError("A page with this address already exists");
        patch.slug = newSlug;
      }
    }
    await ctx.db.patch(page._id, patch);
    return null;
  },
  returns: v.null(),
});

export const reorderPages = mutation({
  args: {
    orgId: v.id("organizations"),
    /** Ordered list of page slugs. Pages not listed keep their relative order at the end. */
    orderedSlugs: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_org_order", (q) => q.eq("orgId", args.orgId))
      .collect();
    const bySlug = new Map(pages.map((p) => [p.slug, p]));
    let order = 0;
    for (const slug of args.orderedSlugs) {
      const page = bySlug.get(slug);
      if (!page) continue;
      await ctx.db.patch(page._id, { order, updatedAt: Date.now() });
      bySlug.delete(slug);
      order += 1;
    }
    // Append any pages the client didn't include.
    const remaining = [...bySlug.values()].sort((a, b) => a.order - b.order);
    for (const page of remaining) {
      await ctx.db.patch(page._id, { order, updatedAt: Date.now() });
      order += 1;
    }
    return null;
  },
  returns: v.null(),
});

export const togglePublish = mutation({
  args: { orgId: v.id("organizations"), slug: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.orgId);
    const page = await ctx.db
      .query("pages")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .first();
    if (!page) throw new ConvexError("Page not found");
    const next = !page.published;
    await ctx.db.patch(page._id, { published: next, updatedAt: Date.now() });
    await logEvent(ctx, {
      orgId: args.orgId,
      userId: user._id,
      type: next ? "page.publish" : "page.unpublish",
      title: `Page ${next ? "published" : "unpublished"}: ${page.slug}`,
    });
    return next;
  },
  returns: v.boolean(),
});

export const deletePage = mutation({
  args: { orgId: v.id("organizations"), slug: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.orgId);
    if (args.slug === "home") {
      throw new ConvexError("The home page cannot be deleted");
    }
    const page = await ctx.db
      .query("pages")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .first();
    if (!page) throw new ConvexError("Page not found");
    await ctx.db.delete(page._id);
    await logEvent(ctx, {
      orgId: args.orgId,
      userId: user._id,
      type: "page.delete",
      title: `Page deleted: ${args.slug}`,
    });
    return null;
  },
  returns: v.null(),
});
