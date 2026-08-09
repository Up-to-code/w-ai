import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireOrgAccess } from "./helpers";

const contactShape = v.object({
  _id: v.id("contacts"),
  orgId: v.id("organizations"),
  name: v.string(),
  phoneNumber: v.string(),
  email: v.optional(v.string()),
  message: v.string(),
  reason: v.optional(v.string()),
  read: v.boolean(),
  createdAt: v.number(),
});

/** Public form submission — no auth required. */
export const submit = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    phoneNumber: v.string(),
    email: v.optional(v.string()),
    message: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("contacts", {
      ...args,
      read: false,
      createdAt: Date.now(),
    });
  },
  returns: v.id("contacts"),
});

export const list = query({
  args: { orgId: v.id("organizations"), unreadOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const rows = await ctx.db
      .query("contacts")
      .withIndex("by_org_created", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();
    return args.unreadOnly ? rows.filter((c) => !c.read) : rows;
  },
  returns: v.array(contactShape),
});

export const markRead = mutation({
  args: { contactId: v.id("contacts"), orgId: v.id("organizations"), read: v.boolean() },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const c = await ctx.db.get(args.contactId);
    if (!c || c.orgId !== args.orgId) throw new ConvexError("Contact not found");
    await ctx.db.patch(args.contactId, { read: args.read });
  },
});

export const remove = mutation({
  args: { contactId: v.id("contacts"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.orgId);
    const c = await ctx.db.get(args.contactId);
    if (!c || c.orgId !== args.orgId) throw new ConvexError("Contact not found");
    await ctx.db.delete(args.contactId);
  },
});
