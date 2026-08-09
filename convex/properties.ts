import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireEditor, requireOrgAccess } from "./helpers";

const localized = v.record(v.string(), v.string());

const propertyPublic = v.object({
  _id: v.id("properties"),
  orgId: v.id("organizations"),
  title: localized,
  description: v.optional(localized),
  city: v.optional(localized),
  district: v.optional(localized),
  type: v.optional(v.string()),
  price: v.number(),
  currency: v.optional(v.string()),
  images: v.array(v.string()),
  features: v.optional(v.array(localized)),
  map: v.optional(v.object({ latitude: v.number(), longitude: v.number() })),
  published: v.boolean(),
  featured: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ---------------------------------------------------------------------------
// Public queries (tenant site)
// ---------------------------------------------------------------------------

export const listPublished = query({
  args: {
    orgId: v.id("organizations"),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("properties")
      .withIndex("by_org_published", (q) =>
        q.eq("orgId", args.orgId).eq("published", true),
      );
    const rows = await q.collect();
    const filtered = args.type ? rows.filter((p) => p.type === args.type) : rows;
    const sorted = filtered.sort((a, b) => b.createdAt - a.createdAt);
    return args.limit ? sorted.slice(0, args.limit) : sorted;
  },
  returns: v.array(propertyPublic),
});

export const getFeatured = query({
  args: { orgId: v.id("organizations"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("properties")
      .withIndex("by_org_published", (q) =>
        q.eq("orgId", args.orgId).eq("published", true),
      )
      .collect();
    const featured = rows.filter((p) => p.featured).sort((a, b) => b.createdAt - a.createdAt);
    return args.limit ? featured.slice(0, args.limit) : featured;
  },
  returns: v.array(propertyPublic),
});

export const get = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.propertyId);
  },
  returns: v.union(v.null(), propertyPublic),
});

// ---------------------------------------------------------------------------
// Admin queries / mutations
// ---------------------------------------------------------------------------

export const listAdmin = query({
  args: {
    orgId: v.id("organizations"),
    published: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const rows = await ctx.db
      .query("properties")
      .withIndex("by_org_created", (q) => q.eq("orgId", args.orgId))
      .collect();
    const filtered =
      args.published !== undefined
        ? rows.filter((p) => p.published === args.published)
        : rows;
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  },
  returns: v.array(propertyPublic),
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    title: localized,
    description: v.optional(localized),
    city: v.optional(localized),
    district: v.optional(localized),
    type: v.optional(v.string()),
    price: v.number(),
    currency: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    features: v.optional(v.array(localized)),
    map: v.optional(v.object({ latitude: v.number(), longitude: v.number() })),
    published: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const now = Date.now();
    return ctx.db.insert("properties", {
      orgId: args.orgId,
      title: args.title,
      description: args.description,
      city: args.city,
      district: args.district,
      type: args.type,
      price: args.price,
      currency: args.currency ?? "SAR",
      images: args.images ?? [],
      features: args.features,
      map: args.map,
      published: args.published ?? false,
      featured: args.featured ?? false,
      createdAt: now,
      updatedAt: now,
    });
  },
  returns: v.id("properties"),
});

export const update = mutation({
  args: {
    propertyId: v.id("properties"),
    orgId: v.id("organizations"),
    title: v.optional(localized),
    description: v.optional(localized),
    city: v.optional(localized),
    district: v.optional(localized),
    type: v.optional(v.string()),
    price: v.optional(v.number()),
    currency: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    features: v.optional(v.array(localized)),
    map: v.optional(v.object({ latitude: v.number(), longitude: v.number() })),
    published: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const { propertyId, orgId: _orgId, ...patch } = args;
    const prop = await ctx.db.get(propertyId);
    if (!prop || prop.orgId !== args.orgId) throw new ConvexError("Property not found");
    const cleanPatch = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    await ctx.db.patch(propertyId, { ...cleanPatch, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { propertyId: v.id("properties"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const prop = await ctx.db.get(args.propertyId);
    if (!prop || prop.orgId !== args.orgId) throw new ConvexError("Property not found");
    await ctx.db.delete(args.propertyId);
  },
});
