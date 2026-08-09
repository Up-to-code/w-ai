import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import { domainCheckResultValidator, verifyDomainConnection } from "./domains";

const HEALTH_CHECK_LEASE_MS = 60 * 60 * 1000;
const TRANSIENT_RETRY_MS = 60 * 60 * 1000;

/**
 * Claims due domains before scheduling actions so overlapping cron runs cannot
 * fan out duplicate provider/DNS checks.
 */
export const scheduleDue = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const domains = await ctx.db
      .query("domains")
      .withIndex("by_verified_and_next_health_check", (q) =>
        q.eq("verified", true).lte("nextHealthCheckAt", now),
      )
      .take(200);
    let scheduled = 0;
    for (const [index, domain] of domains.entries()) {
      if (!domain.verified) continue;
      await ctx.db.patch(domain._id, {
        nextHealthCheckAt: now + HEALTH_CHECK_LEASE_MS,
      });
      await ctx.scheduler.runAfter(index * 250, internal.domainHealth.check, {
        domainId: domain._id,
      });
      scheduled += 1;
    }
    return scheduled;
  },
});

export const check = internalAction({
  args: { domainId: v.id("domains") },
  returns: v.union(v.null(), domainCheckResultValidator),
  handler: async (ctx, args) => {
    const domain = await ctx.runQuery(internal.domains.getForAutomaticCheck, {
      domainId: args.domainId,
    });
    if (!domain?.verified) return null;

    try {
      const result = await verifyDomainConnection(ctx, args.domainId, domain);
      if (!result.verified) {
        await ctx.scheduler.runAfter(
          30 * 1000,
          internal.domainVerification.restart,
          { domainId: args.domainId },
        );
      }
      return result;
    } catch (error) {
      await ctx.runMutation(internal.domains.leaseHealthCheck, {
        domainId: args.domainId,
        nextHealthCheckAt: Date.now() + TRANSIENT_RETRY_MS,
        error:
          error instanceof Error
            ? error.message
            : "Automatic domain health check failed",
      });
      return null;
    }
  },
});
