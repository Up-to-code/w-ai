import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireOrgAccess } from "./helpers";

/**
 * Dashboard stats summary for the org overview.
 * Counts items per table without filtering — fast index scans only.
 */
export const getSummary = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");

    const [pages, properties, posts, contacts, interests, conversations] =
      await Promise.all([
        ctx.db
          .query("pages")
          .withIndex("by_org_order", (q) => q.eq("orgId", args.orgId))
          .collect(),
        ctx.db
          .query("properties")
          .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
          .collect(),
        ctx.db
          .query("posts")
          .withIndex("by_org_created", (q) => q.eq("orgId", args.orgId))
          .collect(),
        ctx.db
          .query("contacts")
          .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
          .collect(),
        ctx.db
          .query("interests")
          .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
          .collect(),
        ctx.db
          .query("conversations")
          .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
          .collect(),
      ]);

    return {
      pages: {
        total: pages.length,
        published: pages.filter((p) => p.published).length,
      },
      properties: {
        total: properties.length,
        published: properties.filter((p) => p.published).length,
      },
      posts: {
        total: posts.length,
        published: posts.filter((p) => p.status === "published").length,
      },
      contacts: {
        total: contacts.length,
        unread: contacts.filter((c) => !c.read).length,
      },
      interests: {
        total: interests.length,
        unread: interests.filter((i) => !i.read).length,
      },
      conversations: {
        total: conversations.length,
        open: conversations.filter((c) => c.status === "open").length,
      },
    };
  },
  returns: v.object({
    pages: v.object({ total: v.number(), published: v.number() }),
    properties: v.object({ total: v.number(), published: v.number() }),
    posts: v.object({ total: v.number(), published: v.number() }),
    contacts: v.object({ total: v.number(), unread: v.number() }),
    interests: v.object({ total: v.number(), unread: v.number() }),
    conversations: v.object({ total: v.number(), open: v.number() }),
  }),
});
