import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireEditor, requireOrgAccess } from "./helpers";

const localized = v.record(v.string(), v.string());

const serviceShape = v.object({
  _id: v.id("services"),
  orgId: v.id("organizations"),
  title: localized,
  description: localized,
  image: v.optional(v.string()),
  features: v.array(localized),
  order: v.number(),
  enabled: v.boolean(),
  createdAt: v.number(),
});

export const listPublic = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("services")
      .withIndex("by_org_order", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows.filter((s) => s.enabled).sort((a, b) => a.order - b.order);
  },
  returns: v.array(serviceShape),
});

export const listAdmin = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const rows = await ctx.db
      .query("services")
      .withIndex("by_org_order", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows.sort((a, b) => a.order - b.order);
  },
  returns: v.array(serviceShape),
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    title: localized,
    description: localized,
    image: v.optional(v.string()),
    features: v.optional(v.array(localized)),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const max = await ctx.db
      .query("services")
      .withIndex("by_org_order", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .first();
    return ctx.db.insert("services", {
      orgId: args.orgId,
      title: args.title,
      description: args.description,
      image: args.image,
      features: args.features ?? [],
      order: (max?.order ?? -1) + 1,
      enabled: args.enabled ?? true,
      createdAt: Date.now(),
    });
  },
  returns: v.id("services"),
});

export const update = mutation({
  args: {
    serviceId: v.id("services"),
    orgId: v.id("organizations"),
    title: v.optional(localized),
    description: v.optional(localized),
    image: v.optional(v.string()),
    features: v.optional(v.array(localized)),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const row = await ctx.db.get(args.serviceId);
    if (!row || row.orgId !== args.orgId) throw new ConvexError("Service not found");
    const { serviceId, orgId: _o, ...patch } = args;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    await ctx.db.patch(serviceId, clean);
  },
});

export const remove = mutation({
  args: { serviceId: v.id("services"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const row = await ctx.db.get(args.serviceId);
    if (!row || row.orgId !== args.orgId) throw new ConvexError("Service not found");
    await ctx.db.delete(args.serviceId);
  },
});
