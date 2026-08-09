import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";

const environmentValidator = v.union(
  v.literal("sandbox"),
  v.literal("production"),
);

export const get = internalQuery({
  args: {
    environment: environmentValidator,
    accountHash: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      encryptedAccessToken: v.string(),
      expiresAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("registrarProviderSessions")
      .withIndex("by_provider_environment_account", (query) =>
        query
          .eq("provider", "openprovider")
          .eq("environment", args.environment)
          .eq("accountHash", args.accountHash),
      )
      .unique();
    return session
      ? {
          encryptedAccessToken: session.encryptedAccessToken,
          expiresAt: session.expiresAt,
        }
      : null;
  },
});

export const save = internalMutation({
  args: {
    environment: environmentValidator,
    accountHash: v.string(),
    encryptedAccessToken: v.string(),
    expiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("registrarProviderSessions")
      .withIndex("by_provider_environment_account", (query) =>
        query
          .eq("provider", "openprovider")
          .eq("environment", args.environment)
          .eq("accountHash", args.accountHash),
      )
      .unique();
    const now = Date.now();
    const values = {
      encryptedAccessToken: args.encryptedAccessToken,
      expiresAt: args.expiresAt,
      updatedAt: now,
    };
    if (existing) await ctx.db.patch(existing._id, values);
    else {
      await ctx.db.insert("registrarProviderSessions", {
        provider: "openprovider",
        environment: args.environment,
        accountHash: args.accountHash,
        ...values,
        createdAt: now,
      });
    }
    return null;
  },
});
