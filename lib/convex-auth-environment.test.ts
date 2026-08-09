import { describe, expect, it } from "vitest";

import {
  deriveConvexSiteUrl,
  resolveConvexAuthEnvironment,
} from "./convex-auth-environment";

describe("Convex auth environment", () => {
  it("derives the HTTP Actions URL from the deployment URL", () => {
    expect(deriveConvexSiteUrl("https://example-123.convex.cloud")).toBe(
      "https://example-123.convex.site",
    );
  });

  it("accepts the server-only variable documented for deployments", () => {
    expect(
      resolveConvexAuthEnvironment({
        NEXT_PUBLIC_CONVEX_URL: "https://example-123.convex.cloud",
        CONVEX_SITE_URL: "https://custom.convex.site",
      }),
    ).toEqual({
      convexUrl: "https://example-123.convex.cloud",
      convexSiteUrl: "https://custom.convex.site",
    });
  });

  it("prefers the explicit public HTTP Actions URL", () => {
    expect(
      resolveConvexAuthEnvironment({
        NEXT_PUBLIC_CONVEX_URL: "https://example-123.convex.cloud",
        CONVEX_SITE_URL: "https://server.convex.site",
        NEXT_PUBLIC_CONVEX_SITE_URL: "https://public.convex.site",
      }).convexSiteUrl,
    ).toBe("https://public.convex.site");
  });
});
