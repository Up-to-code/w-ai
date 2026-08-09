import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireOrgAccess } from "./helpers";

const eventShape = v.object({
  _id: v.id("events"),
  orgId: v.optional(v.id("organizations")),
  userId: v.optional(v.string()),
  type: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  metadata: v.optional(v.any()),
  createdAt: v.number(),
});

/**
 * Recent activity feed for an organization dashboard.
 * Platform-level events (no orgId) are never returned here.
 */
export const listRecent = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const limit = Math.min(Math.max(args.limit ?? 30, 1), 100);
    const rows = await ctx.db
      .query("events")
      .withIndex("by_org_created", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(limit * 2);

    const filtered = args.type ? rows.filter((e) => e.type === args.type) : rows;
    return filtered.slice(0, limit);
  },
  returns: v.array(eventShape),
});
