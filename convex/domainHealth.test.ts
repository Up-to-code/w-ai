import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("connected domain health scheduling", () => {
  it("includes legacy and due verified domains but skips future and inactive rows", async () => {
    const t = convexTest(schema, modules);
    const now = new Date("2026-08-09T12:00:00.000Z").getTime();
    const ids = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Health check site",
        slug: "health-check-site",
        plan: "pro",
        createdAt: now,
      });
      const legacy = await ctx.db.insert("domains", {
        orgId,
        hostname: "legacy.example.com",
        verified: true,
        createdAt: now,
      });
      const due = await ctx.db.insert("domains", {
        orgId,
        hostname: "due.example.com",
        verified: true,
        nextHealthCheckAt: now - 1,
        createdAt: now,
      });
      const future = await ctx.db.insert("domains", {
        orgId,
        hostname: "future.example.com",
        verified: true,
        nextHealthCheckAt: now + 60_000,
        createdAt: now,
      });
      const pending = await ctx.db.insert("domains", {
        orgId,
        hostname: "pending.example.com",
        verified: false,
        createdAt: now,
      });
      return { legacy, due, future, pending };
    });

    const due = await t.query(internal.domains.listDueForHealthCheck, {
      now,
      limit: 200,
    });

    expect(new Set(due)).toEqual(new Set([ids.legacy, ids.due]));
    expect(due).not.toContain(ids.future);
    expect(due).not.toContain(ids.pending);
  });

  it("lets a scheduled verification persist Vercel state without a user session", async () => {
    const t = convexTest(schema, modules);
    const now = new Date("2026-08-09T12:00:00.000Z").getTime();
    const domainId = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Background verification site",
        slug: "background-verification-site",
        plan: "pro",
        createdAt: now,
      });
      return ctx.db.insert("domains", {
        orgId,
        hostname: "www.background.example",
        verified: true,
        status: "verified",
        platformVerified: true,
        tlsStatus: "active",
        tlsExpiresAt: now + 90 * 24 * 60 * 60_000,
        createdAt: now,
      });
    });

    await t.mutation(internal.domains.savePlatformState, {
      domainId,
      status: "pending",
      platformVerified: false,
      tlsStatus: "pending",
      tlsCheckedAt: now,
      tlsExpiresAt: null,
      platformVerification: [
        {
          type: "TXT",
          domain: "_vercel.www.background.example",
          value: "challenge",
        },
      ],
      error: "Vercel ownership must be reverified",
    });

    expect(await t.run((ctx) => ctx.db.get(domainId))).toMatchObject({
      verified: false,
      status: "pending",
      platformVerified: false,
      tlsStatus: "pending",
      tlsCheckedAt: now,
      error: "Vercel ownership must be reverified",
    });
    expect((await t.run((ctx) => ctx.db.get(domainId)))?.tlsExpiresAt).toBe(
      undefined,
    );
  });
});
