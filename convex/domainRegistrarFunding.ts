import { v } from "convex/values";

import { internalMutation } from "./_generated/server";

const environmentValidator = v.union(
  v.literal("sandbox"),
  v.literal("production"),
);

/** Persists an immutable provider observation for later reserve evaluation. */
export const save = internalMutation({
  args: {
    environment: environmentValidator,
    accountHash: v.string(),
    currency: v.string(),
    availableBalanceMinor: v.number(),
    reservedBalanceMinor: v.number(),
    currencyMinorUnit: v.number(),
    fetchedAt: v.number(),
  },
  returns: v.id("registrarFundingSnapshots"),
  handler: async (ctx, args) =>
    ctx.db.insert("registrarFundingSnapshots", {
      provider: "openprovider",
      ...args,
      createdAt: Date.now(),
    }),
});
