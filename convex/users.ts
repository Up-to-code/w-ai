import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { createAuth, authComponent } from "./auth";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const orgs = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.orgId);
      if (org) {
        orgs.push({
          _id: org._id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          role: m.role,
        });
      }
    }

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email ?? undefined,
        image: user.image ?? undefined,
      },
      orgs,
    };
  },
  returns: v.union(
    v.null(),
    v.object({
      user: v.object({
        id: v.string(),
        name: v.string(),
        email: v.optional(v.string()),
        image: v.optional(v.string()),
      }),
      orgs: v.array(
        v.object({
          _id: v.id("organizations"),
          name: v.string(),
          slug: v.string(),
          plan: v.union(
            v.literal("free"),
            v.literal("starter"),
            v.literal("pro"),
            v.literal("enterprise"),
          ),
          role: v.string(),
        }),
      ),
    }),
  ),
});

export const updateName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (name.length < 2) throw new Error("Name must be at least 2 characters");
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    await auth.api.updateUser({ body: { name }, headers });
  },
});

export const removeAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    // Remove the user from all organizations they belong to.
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const m of memberships) {
      await ctx.db.delete(m._id);
    }
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    await auth.api.deleteUser({ headers, body: {} });
  },
});
