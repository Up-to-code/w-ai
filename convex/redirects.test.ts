import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { assertHostname, assertNoDuplicateOrLoop } from "./redirects";
import schema from "./schema";
import { modules } from "./test.setup";

const NOW = new Date("2026-08-09T12:00:00.000Z").getTime();

async function seedOrg(
  t: ReturnType<typeof convexTest>,
  slug: string,
  status: "active" | "suspended" = "active",
) {
  return t.run(async (ctx) =>
    ctx.db.insert("organizations", {
      name: slug,
      slug,
      plan: "pro",
      status,
      createdAt: NOW,
    }),
  );
}

async function seedRule(
  t: ReturnType<typeof convexTest>,
  orgId: Id<"organizations">,
  sourcePath: string,
  destination: string,
  hostname?: string,
) {
  return t.run(async (ctx) =>
    ctx.db.insert("redirectRules", {
      orgId,
      hostname,
      matchType: "exact",
      sourcePath,
      destination,
      statusCode: 308,
      preserveQuery: true,
      enabled: true,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );
}

describe("tenant redirect resolution", () => {
  it("uses a hostname-specific rule before the site-wide fallback", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "studio");
    await t.run(async (ctx) => {
      await ctx.db.insert("domains", {
        orgId,
        hostname: "www.studio.co.uk",
        verified: true,
        createdAt: NOW,
      });
    });
    await seedRule(t, orgId, "/old", "/global");
    await seedRule(t, orgId, "/old", "/custom", "www.studio.co.uk");

    const custom = await t.query(api.redirects.resolve, {
      slug: "studio",
      host: "www.studio.co.uk:443",
      path: "/old/",
    });
    const tenantSubdomain = await t.query(api.redirects.resolve, {
      slug: "studio",
      host: "studio.qentrah.com",
      path: "/old",
    });

    expect(custom?.destination).toBe("/custom");
    expect(tenantSubdomain?.destination).toBe("/global");
  });

  it("resolves a hostname-specific exact rule beyond the old scan limit", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "many-domains");
    await t.run(async (ctx) => {
      for (let index = 0; index < 25; index += 1) {
        const hostname = `domain-${index}.customer.example`;
        await ctx.db.insert("domains", {
          orgId,
          hostname,
          verified: true,
          createdAt: NOW + index,
        });
        await ctx.db.insert("redirectRules", {
          orgId,
          hostname,
          matchType: "exact",
          sourcePath: "/old",
          destination: `/destination-${index}`,
          statusCode: 308,
          preserveQuery: true,
          enabled: true,
          createdAt: NOW + index,
          updatedAt: NOW + index,
        });
      }
    });

    expect(
      await t.query(api.redirects.resolve, {
        slug: "untrusted-route-slug",
        host: "domain-24.customer.example",
        path: "/old",
      }),
    ).toMatchObject({ destination: "/destination-24" });
  });

  it("detects a duplicate beyond the old multi-host scan limit", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "duplicate-many-domains");
    await t.run(async (ctx) => {
      for (let index = 0; index < 25; index += 1) {
        const hostname = `duplicate-${index}.customer.example`;
        await ctx.db.insert("domains", {
          orgId,
          hostname,
          verified: true,
          createdAt: NOW + index,
        });
        await ctx.db.insert("redirectRules", {
          orgId,
          hostname,
          matchType: "exact",
          sourcePath: "/shared-source",
          destination: `/destination-${index}`,
          statusCode: 308,
          preserveQuery: true,
          enabled: true,
          createdAt: NOW + index,
          updatedAt: NOW + index,
        });
      }
    });

    await expect(
      t.run((ctx) =>
        assertNoDuplicateOrLoop(ctx, {
          orgId,
          hostname: "duplicate-24.customer.example",
          matchType: "exact",
          sourcePath: "/shared-source",
          destination: "/replacement",
        }),
      ),
    ).rejects.toThrow("already exists");
  });

  it("resolves a verified custom domain without trusting a route slug", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "real-site");
    await t.run(async (ctx) => {
      await ctx.db.insert("domains", {
        orgId,
        hostname: "www.customer.example",
        verified: true,
        redirectTo: "customer.example",
        redirectStatusCode: 308,
        createdAt: NOW,
      });
    });

    const resolved = await t.query(api.redirects.resolve, {
      slug: "untrusted-internal-route",
      host: "WWW.CUSTOMER.EXAMPLE:443",
      path: "/catalog/",
    });

    expect(resolved).toEqual({
      destination: "https://customer.example/catalog",
      statusCode: 308,
      preserveQuery: true,
    });
  });

  it("applies a whole-domain redirect before a matching URL rule", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "canonical-site");
    await t.run(async (ctx) => {
      await ctx.db.insert("domains", {
        orgId,
        hostname: "www.customer.example",
        verified: true,
        redirectTo: "customer.example",
        redirectStatusCode: 301,
        createdAt: NOW,
      });
      await ctx.db.insert("domains", {
        orgId,
        hostname: "customer.example",
        verified: true,
        createdAt: NOW,
      });
      await ctx.db.insert("redirectRules", {
        orgId,
        hostname: "www.customer.example",
        matchType: "exact",
        sourcePath: "/old",
        destination: "/new",
        statusCode: 308,
        preserveQuery: false,
        enabled: true,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    expect(
      await t.query(api.redirects.resolve, {
        slug: "untrusted-internal-route",
        host: "www.customer.example",
        path: "/old",
      }),
    ).toEqual({
      destination: "https://customer.example/old",
      statusCode: 301,
      preserveQuery: true,
    });
  });

  it("does not trust an internal route slug on the application host", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "route-slug-victim");
    await seedRule(t, orgId, "/old", "/new");

    expect(
      await t.query(api.redirects.resolve, {
        slug: "route-slug-victim",
        host: "localhost:3000",
        path: "/old",
      }),
    ).toBeNull();
  });

  it("rejects a route slug that does not match the tenant subdomain", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "victim");
    await seedRule(t, orgId, "/old", "/new");

    expect(
      await t.query(api.redirects.resolve, {
        slug: "victim",
        host: "another-site.qentrah.com",
        path: "/old",
      }),
    ).toBeNull();
  });

  it("does not resolve unverified domains or suspended sites", async () => {
    const t = convexTest(schema, modules);
    const activeOrgId = await seedOrg(t, "active-site");
    const suspendedOrgId = await seedOrg(t, "suspended-site", "suspended");
    await seedRule(t, activeOrgId, "/old", "/new");
    await seedRule(t, suspendedOrgId, "/old", "/new");
    await t.run(async (ctx) => {
      await ctx.db.insert("domains", {
        orgId: activeOrgId,
        hostname: "unverified.example",
        verified: false,
        createdAt: NOW,
      });
    });

    expect(
      await t.query(api.redirects.resolve, {
        slug: "unverified.example",
        host: "unverified.example",
        path: "/old",
      }),
    ).toBeNull();
    expect(
      await t.query(api.redirects.resolve, {
        slug: "suspended-site",
        host: "suspended-site.qentrah.com",
        path: "/old",
      }),
    ).toBeNull();
  });

  it("ignores disabled rules", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "disabled-rule");
    await t.run(async (ctx) => {
      await ctx.db.insert("redirectRules", {
        orgId,
        sourcePath: "/old",
        destination: "/new",
        statusCode: 307,
        preserveQuery: false,
        enabled: false,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    expect(
      await t.query(api.redirects.resolve, {
        slug: "disabled-rule",
        host: "disabled-rule.qentrah.com",
        path: "/old",
      }),
    ).toBeNull();
  });

  it("moves a whole path section and preserves the suffix", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "section-move");
    await t.run(async (ctx) => {
      await ctx.db.insert("redirectRules", {
        orgId,
        matchType: "prefix",
        sourcePath: "/blog",
        destination: "/journal/:splat",
        statusCode: 308,
        preserveQuery: true,
        enabled: true,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    expect(
      await t.query(api.redirects.resolve, {
        slug: "section-move",
        host: "section-move.qentrah.com",
        path: "/blog/launch/post-one",
      }),
    ).toMatchObject({ destination: "/journal/launch/post-one" });
  });

  it("prefers exact redirects, then the longest matching prefix", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "precedence");
    await t.run(async (ctx) => {
      for (const [matchType, sourcePath, destination] of [
        ["prefix", "/docs", "/help/:splat"],
        ["prefix", "/docs/api", "/reference/:splat"],
        ["exact", "/docs/api/auth", "/login-reference"],
      ] as const) {
        await ctx.db.insert("redirectRules", {
          orgId,
          matchType,
          sourcePath,
          destination,
          statusCode: 308,
          preserveQuery: true,
          enabled: true,
          createdAt: NOW,
          updatedAt: NOW,
        });
      }
    });

    const exact = await t.query(api.redirects.resolve, {
      slug: "precedence",
      host: "precedence.qentrah.com",
      path: "/docs/api/auth",
    });
    const prefix = await t.query(api.redirects.resolve, {
      slug: "precedence",
      host: "precedence.qentrah.com",
      path: "/docs/api/domains",
    });
    expect(exact?.destination).toBe("/login-reference");
    expect(prefix?.destination).toBe("/reference/domains");
  });

  it("resolves a prefix rule beyond the old collection limit", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "many-prefixes");
    await t.run(async (ctx) => {
      for (let index = 0; index < 210; index += 1) {
        await ctx.db.insert("redirectRules", {
          orgId,
          matchType: "prefix",
          sourcePath: `/archive-${index}`,
          destination: `/history-${index}/:splat`,
          statusCode: 308,
          preserveQuery: true,
          enabled: true,
          createdAt: NOW + index,
          updatedAt: NOW + index,
        });
      }
      await ctx.db.insert("redirectRules", {
        orgId,
        matchType: "prefix",
        sourcePath: "/docs",
        destination: "/reference/:splat",
        statusCode: 308,
        preserveQuery: true,
        enabled: true,
        createdAt: NOW + 211,
        updatedAt: NOW + 211,
      });
    });

    expect(
      await t.query(api.redirects.resolve, {
        slug: "many-prefixes",
        host: "many-prefixes.qentrah.com",
        path: "/docs/getting-started",
      }),
    ).toMatchObject({ destination: "/reference/getting-started" });
  });

  it("supports separate exact-page and section rules at the same path", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "shared-source");
    await t.run(async (ctx) => {
      await ctx.db.insert("redirectRules", {
        orgId,
        matchType: "exact",
        sourcePath: "/docs",
        destination: "/documentation",
        statusCode: 308,
        preserveQuery: true,
        enabled: true,
        createdAt: NOW,
        updatedAt: NOW,
      });
      await ctx.db.insert("redirectRules", {
        orgId,
        matchType: "prefix",
        sourcePath: "/docs",
        destination: "/reference/:splat",
        statusCode: 308,
        preserveQuery: true,
        enabled: true,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    expect(
      await t.query(api.redirects.resolve, {
        slug: "shared-source",
        host: "shared-source.qentrah.com",
        path: "/docs",
      }),
    ).toMatchObject({ destination: "/documentation" });
    expect(
      await t.query(api.redirects.resolve, {
        slug: "shared-source",
        host: "shared-source.qentrah.com",
        path: "/docs/getting-started",
      }),
    ).toMatchObject({ destination: "/reference/getting-started" });
  });

  it("allows a root prefix to move every site path", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "root-prefix");
    await t.run(async (ctx) => {
      await ctx.db.insert("redirectRules", {
        orgId,
        matchType: "prefix",
        sourcePath: "/",
        destination: "https://new.example/:splat",
        statusCode: 308,
        preserveQuery: true,
        enabled: true,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    const resolved = await t.query(api.redirects.resolve, {
      slug: "root-prefix",
      host: "root-prefix.qentrah.com",
      path: "/catalog/item",
    });
    expect(resolved?.destination).toBe("https://new.example/catalog/item");
  });

  it("blocks a loop that crosses two custom hostnames on the same site", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "cross-host-loop");
    await t.run(async (ctx) => {
      for (const hostname of ["a.customer.example", "b.customer.example"]) {
        await ctx.db.insert("domains", {
          orgId,
          hostname,
          verified: true,
          createdAt: NOW,
        });
      }
      await ctx.db.insert("redirectRules", {
        orgId,
        hostname: "b.customer.example",
        matchType: "exact",
        sourcePath: "/second",
        destination: "https://a.customer.example/first",
        statusCode: 308,
        preserveQuery: true,
        enabled: true,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    await expect(
      t.run((ctx) =>
        assertNoDuplicateOrLoop(ctx, {
          orgId,
          hostname: "a.customer.example",
          matchType: "exact",
          sourcePath: "/first",
          destination: "https://b.customer.example/second",
        }),
      ),
    ).rejects.toThrow("loop");
  });

  it("checks a site-wide rule against hostname-specific fallbacks", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "global-host-loop");
    await t.run(async (ctx) => {
      await ctx.db.insert("domains", {
        orgId,
        hostname: "www.global-host.example",
        verified: true,
        createdAt: NOW,
      });
      await ctx.db.insert("redirectRules", {
        orgId,
        hostname: "www.global-host.example",
        matchType: "exact",
        sourcePath: "/second",
        destination: "/first",
        statusCode: 308,
        preserveQuery: true,
        enabled: true,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    await expect(
      t.run((ctx) =>
        assertNoDuplicateOrLoop(ctx, {
          orgId,
          matchType: "exact",
          sourcePath: "/first",
          destination: "/second",
        }),
      ),
    ).rejects.toThrow("loop");
  });

  it("revalidates a disabled rule before it can be enabled", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "reenable-loop");
    const disabledRuleId = await t.run(async (ctx) => {
      const ruleId = await ctx.db.insert("redirectRules", {
        orgId,
        matchType: "exact",
        sourcePath: "/first",
        destination: "/second",
        statusCode: 308,
        preserveQuery: true,
        enabled: false,
        createdAt: NOW,
        updatedAt: NOW,
      });
      await ctx.db.insert("redirectRules", {
        orgId,
        matchType: "exact",
        sourcePath: "/second",
        destination: "/first",
        statusCode: 308,
        preserveQuery: true,
        enabled: true,
        createdAt: NOW,
        updatedAt: NOW,
      });
      return ruleId;
    });

    await expect(
      t.run((ctx) =>
        assertNoDuplicateOrLoop(ctx, {
          orgId,
          matchType: "exact",
          sourcePath: "/first",
          destination: "/second",
          ruleId: disabledRuleId,
        }),
      ),
    ).rejects.toThrow("loop");
  });

  it("does not allow path rules on a redirect-only hostname", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t, "redirect-host-scope");
    await t.run(async (ctx) => {
      await ctx.db.insert("domains", {
        orgId,
        hostname: "www.redirect-host.example",
        verified: true,
        redirectTo: "redirect-host.example",
        redirectStatusCode: 308,
        createdAt: NOW,
      });
    });

    await expect(
      t.run((ctx) => assertHostname(ctx, orgId, "www.redirect-host.example")),
    ).rejects.toThrow("only be scoped to a domain that serves this site");
  });
});
