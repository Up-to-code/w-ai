import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { normalizeSlug, requireEditor, requireOrgAccess } from "./helpers";

const fieldType = v.union(
  v.literal("text"),
  v.literal("richText"),
  v.literal("number"),
  v.literal("boolean"),
  v.literal("date"),
  v.literal("image"),
);

const collectionField = v.object({
  key: v.string(),
  label: v.string(),
  type: fieldType,
  required: v.boolean(),
});

const collectionSummary = v.object({
  _id: v.id("cmsCollections"),
  name: v.string(),
  slug: v.string(),
  fields: v.array(collectionField),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const preset = v.union(
  v.literal("blank"),
  v.literal("posts"),
  v.literal("products"),
  v.literal("team"),
);

function fieldsForPreset(value: "blank" | "posts" | "products" | "team") {
  const title = {
    key: "title",
    label: "Title",
    type: "text" as const,
    required: true,
  };
  if (value === "posts")
    return [
      title,
      { key: "slug", label: "Slug", type: "text" as const, required: true },
      {
        key: "content",
        label: "Content",
        type: "richText" as const,
        required: true,
      },
      {
        key: "featuredImage",
        label: "Featured image",
        type: "image" as const,
        required: false,
      },
      {
        key: "publishedAt",
        label: "Published at",
        type: "date" as const,
        required: false,
      },
    ];
  if (value === "products")
    return [
      title,
      { key: "price", label: "Price", type: "number" as const, required: true },
      { key: "image", label: "Image", type: "image" as const, required: false },
      {
        key: "available",
        label: "Available",
        type: "boolean" as const,
        required: false,
      },
    ];
  if (value === "team")
    return [
      title,
      { key: "role", label: "Role", type: "text" as const, required: true },
      { key: "photo", label: "Photo", type: "image" as const, required: false },
      { key: "bio", label: "Bio", type: "richText" as const, required: false },
    ];
  return [title];
}

export const listCollections = query({
  args: { orgId: v.id("organizations") },
  returns: v.array(collectionSummary),
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const rows = await ctx.db
      .query("cmsCollections")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(200);
    return rows.map((row) => ({
      _id: row._id,
      name: row.name,
      slug: row.slug,
      fields: row.fields,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },
});

export const createCollection = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    preset,
  },
  returns: v.id("cmsCollections"),
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.orgId);
    const name = args.name.trim();
    if (name.length < 2 || name.length > 80)
      throw new ConvexError("Collection names must be 2–80 characters");
    const slug = normalizeSlug(name, { min: 1, max: 80 });
    const existing = await ctx.db
      .query("cmsCollections")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", slug),
      )
      .first();
    if (existing) throw new ConvexError("A collection with this name exists");
    const now = Date.now();
    return ctx.db.insert("cmsCollections", {
      orgId: args.orgId,
      name,
      slug,
      fields: fieldsForPreset(args.preset),
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listEntries = query({
  args: { orgId: v.id("organizations"), collectionId: v.id("cmsCollections") },
  returns: v.array(
    v.object({
      _id: v.id("cmsEntries"),
      status: v.union(v.literal("draft"), v.literal("published")),
      values: v.any(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.orgId !== args.orgId)
      throw new ConvexError("Collection not found");
    const rows = await ctx.db
      .query("cmsEntries")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .order("desc")
      .take(200);
    return rows.map((row) => ({
      _id: row._id,
      status: row.status,
      values: row.values,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },
});

export const createEntry = mutation({
  args: {
    orgId: v.id("organizations"),
    collectionId: v.id("cmsCollections"),
    values: v.any(),
  },
  returns: v.id("cmsEntries"),
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.orgId);
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.orgId !== args.orgId)
      throw new ConvexError("Collection not found");
    const now = Date.now();
    return ctx.db.insert("cmsEntries", {
      orgId: args.orgId,
      collectionId: args.collectionId,
      status: "draft",
      values: args.values,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});
