import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { domainCheckResultValidator, verifyDomainConnection } from "./domains";
import { nextDomainVerificationRetry } from "./domainVerificationPolicy";

export const restart = internalAction({
  args: { domainId: v.id("domains") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const domain = await ctx.runQuery(internal.domains.getForAutomaticCheck, {
      domainId: args.domainId,
    });
    if (!domain || domain.verified) return null;
    const runId = crypto.randomUUID();
    await ctx.runMutation(internal.domains.saveAutomaticCheckSchedule, {
      domainId: args.domainId,
      attempt: 0,
      runId,
      nextVerificationAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.domainVerification.check, {
      domainId: args.domainId,
      attempt: 0,
      runId,
    });
    return null;
  },
});

export const check = internalAction({
  args: {
    domainId: v.id("domains"),
    attempt: v.number(),
    runId: v.string(),
  },
  returns: v.union(v.null(), domainCheckResultValidator),
  handler: async (ctx, args) => {
    const domain = await ctx.runQuery(internal.domains.getForAutomaticCheck, {
      domainId: args.domainId,
    });
    if (!domain || domain.verified || domain.verificationRunId !== args.runId) {
      return null;
    }

    try {
      const result = await verifyDomainConnection(ctx, args.domainId, domain);
      if (result.verified) return result;

      const retry = nextDomainVerificationRetry(args.attempt, Date.now());
      if (!retry) {
        await ctx.runMutation(internal.domains.saveAutomaticCheckSchedule, {
          domainId: args.domainId,
          attempt: args.attempt + 1,
          runId: args.runId,
        });
        return result;
      }
      await ctx.runMutation(internal.domains.saveAutomaticCheckSchedule, {
        domainId: args.domainId,
        attempt: retry.attempt,
        runId: args.runId,
        nextVerificationAt: retry.nextVerificationAt,
      });
      await ctx.scheduler.runAfter(
        retry.delayMs,
        internal.domainVerification.check,
        {
          domainId: args.domainId,
          attempt: retry.attempt,
          runId: args.runId,
        },
      );
      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Automatic domain verification failed";
      const retry = nextDomainVerificationRetry(args.attempt, Date.now());
      await ctx.runMutation(internal.domains.saveAutomaticCheckSchedule, {
        domainId: args.domainId,
        attempt: retry?.attempt ?? args.attempt + 1,
        runId: args.runId,
        nextVerificationAt: retry?.nextVerificationAt,
        error: message,
      });
      if (retry) {
        await ctx.scheduler.runAfter(
          retry.delayMs,
          internal.domainVerification.check,
          {
            domainId: args.domainId,
            attempt: retry.attempt,
            runId: args.runId,
          },
        );
      }
      return null;
    }
  },
});
