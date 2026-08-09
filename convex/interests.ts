import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireOrgAccess } from "./helpers";

const interestShape = v.object({
  _id: v.id("interests"),
  orgId: v.id("organizations"),
  name: v.string(),
  email: v.optional(v.string()),
  phone: v.string(),
  message: v.optional(v.string()),
  propertyId: v.optional(v.id("properties")),
  source: v.optional(v.string()),
  read: v.boolean(),
  createdAt: v.number(),
});

/** Public: visitor submits interest in a property. */
export const submit = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    message: v.optional(v.string()),
    propertyId: v.optional(v.id("properties")),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("interests", {
      ...args,
      read: false,
      createdAt: Date.now(),
    });
  },
  returns: v.id("interests"),
});

export const list = query({
  args: { orgId: v.id("organizations"), unreadOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const rows = await ctx.db
      .query("interests")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();
    return args.unreadOnly ? rows.filter((i) => !i.read) : rows;
  },
  returns: v.array(interestShape),
});

export const markRead = mutation({
  args: { interestId: v.id("interests"), orgId: v.id("organizations"), read: v.boolean() },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const row = await ctx.db.get(args.interestId);
    if (!row || row.orgId !== args.orgId) throw new ConvexError("Not found");
    await ctx.db.patch(args.interestId, { read: args.read });
  },
});

export const remove = mutation({
  args: { interestId: v.id("interests"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.orgId);
    const row = await ctx.db.get(args.interestId);
    if (!row || row.orgId !== args.orgId) throw new ConvexError("Not found");
    await ctx.db.delete(args.interestId);
  },
});
