import { unstable_doesMiddlewareMatch } from "next/dist/experimental/testing/server/middleware-testing-utils";
import { getRewrittenUrl, isRewrite } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import {
  hostnameFromHostHeader,
  tenantRequestIdentity,
} from "../lib/tenant-host";
import proxy, { config, isAppOnlyPath } from "../proxy";

vi.mock("next-intl/middleware", () => ({
  default: () => () => new Response(null, { status: 204 }),
}));
vi.mock("../i18n/routing", () => ({ routing: {} }));

describe("tenant request proxy", () => {
  it("binds internal tenant routes to the incoming hostname", () => {
    expect(tenantRequestIdentity("studio.localhost:3000", "studio")).toEqual({
      kind: "slug",
      slug: "studio",
    });
    expect(
      tenantRequestIdentity("studio.localhost:3000", "another-site"),
    ).toBeNull();
    expect(tenantRequestIdentity("localhost:3000", "studio")).toBeNull();
    expect(
      tenantRequestIdentity("www.customer.example:443", "internal-rewrite"),
    ).toEqual({
      kind: "custom-host",
      hostname: "www.customer.example",
    });
  });

  it("normalizes bracketed IPv6 development hosts safely", () => {
    expect(hostnameFromHostHeader("[::1]:3000")).toBe("[::1]");
  });

  it("matches customer paths that previously collided with app prefixes", () => {
    for (const path of [
      "/contact",
      "/catalog/item",
      "/c",
      "/api/reference",
      "/images/archive",
    ]) {
      expect(
        unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path }),
        path,
      ).toBe(true);
    }
  });

  it("still excludes Next.js framework assets", () => {
    for (const path of [
      "/_next/static/chunks/app.js",
      "/_next/image?url=%2Flogo.png&w=640&q=75",
      "/favicon.ico",
    ]) {
      expect(
        unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path }),
        path,
      ).toBe(false);
    }
  });

  it("rewrites the complete path space on a custom domain", async () => {
    for (const path of ["/contact", "/api/reference", "/images/archive"]) {
      const request = new NextRequest(`https://customer.example${path}`, {
        headers: { host: "customer.example" },
      });
      const response = await proxy(request);

      expect(isRewrite(response), path).toBe(true);
      expect(getRewrittenUrl(response), path).toBe(
        `https://customer.example/c/customer.example${path}`,
      );
    }
  });

  it("keeps application-only routes on the application host", () => {
    expect(isAppOnlyPath("/api/domains")).toBe(true);
    expect(isAppOnlyPath("/brand/brand-logo.svg")).toBe(true);
    expect(isAppOnlyPath("/c/site")).toBe(true);
    expect(isAppOnlyPath("/icons/w-ai-192.png")).toBe(true);
    expect(isAppOnlyPath("/icon.svg")).toBe(true);
    expect(isAppOnlyPath("/site.webmanifest")).toBe(true);
    expect(isAppOnlyPath("/contact")).toBe(false);
  });
});
