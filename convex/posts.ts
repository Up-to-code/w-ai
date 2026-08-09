import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireEditor, requireOrgAccess } from "./helpers";

const localized = v.record(v.string(), v.string());
const status = v.union(v.literal("draft"), v.literal("published"), v.literal("archived"));

const postShape = v.object({
  _id: v.id("posts"),
  orgId: v.id("organizations"),
  title: localized,
  excerpt: v.optional(localized),
  content: v.optional(localized),
  headerImage: v.optional(v.string()),
  thumbnail: v.optional(v.string()),
  status,
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const listPublished = query({
  args: { orgId: v.id("organizations"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", args.orgId).eq("status", "published"),
      )
      .order("desc")
      .collect();
    return args.limit ? rows.slice(0, args.limit) : rows;
  },
  returns: v.array(postShape),
});

export const listAdmin = query({
  args: { orgId: v.id("organizations"), status: v.optional(status) },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_org_created", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();
    return args.status ? rows.filter((p) => p.status === args.status) : rows;
  },
  returns: v.array(postShape),
});

export const getAdmin = query({
  args: { postId: v.id("posts"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const post = await ctx.db.get(args.postId);
    if (!post || post.orgId !== args.orgId) throw new ConvexError("Post not found");
    return post;
  },
  returns: postShape,
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    title: localized,
    excerpt: v.optional(localized),
    content: v.optional(localized),
    headerImage: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    status: v.optional(status),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const now = Date.now();
    return ctx.db.insert("posts", {
      orgId: args.orgId,
      title: args.title,
      excerpt: args.excerpt,
      content: args.content,
      headerImage: args.headerImage,
      thumbnail: args.thumbnail,
      status: args.status ?? "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
  returns: v.id("posts"),
});

export const update = mutation({
  args: {
    postId: v.id("posts"),
    orgId: v.id("organizations"),
    title: v.optional(localized),
    excerpt: v.optional(localized),
    content: v.optional(localized),
    headerImage: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    status: v.optional(status),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const post = await ctx.db.get(args.postId);
    if (!post || post.orgId !== args.orgId) throw new ConvexError("Post not found");
    const { postId, orgId: _o, ...patch } = args;
    const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    await ctx.db.patch(postId, { ...cleanPatch, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { postId: v.id("posts"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const post = await ctx.db.get(args.postId);
    if (!post || post.orgId !== args.orgId) throw new ConvexError("Post not found");
    await ctx.db.delete(args.postId);
  },
});
