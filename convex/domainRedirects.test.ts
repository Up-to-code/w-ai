import { describe, expect, it } from "vitest";

import type { Id } from "./_generated/dataModel";
import { assertDomainRedirectTransition } from "./domains";

function domain(
  id: string,
  orgId: string,
  overrides: Partial<{
    verified: boolean;
    redirectTo: string;
  }> = {},
) {
  return {
    _id: id as Id<"domains">,
    orgId: orgId as Id<"organizations">,
    hostname: `${id}.example`,
    verified: overrides.verified ?? true,
    redirectTo: overrides.redirectTo,
  };
}

describe("domain redirect transitions", () => {
  it("requires ownership verification on both sides", () => {
    expect(() =>
      assertDomainRedirectTransition(
        domain("source", "site", { verified: false }),
        domain("target", "site"),
      ),
    ).toThrow("Verify the source domain");

    expect(() =>
      assertDomainRedirectTransition(
        domain("source", "site"),
        domain("target", "site", { verified: false }),
      ),
    ).toThrow("Verify the destination domain");
  });

  it("prevents cross-site, self, and chained redirects", () => {
    expect(() =>
      assertDomainRedirectTransition(
        domain("source", "site-a"),
        domain("target", "site-b"),
      ),
    ).toThrow("same site");

    const source = domain("source", "site-a");
    expect(() => assertDomainRedirectTransition(source, source)).toThrow(
      "itself",
    );

    expect(() =>
      assertDomainRedirectTransition(
        source,
        domain("target", "site-a", { redirectTo: "canonical.example" }),
      ),
    ).toThrow("not another redirect");
  });

  it("allows verified redirects and always allows removing one", () => {
    expect(() =>
      assertDomainRedirectTransition(
        domain("source", "site"),
        domain("target", "site"),
      ),
    ).not.toThrow();
    expect(() =>
      assertDomainRedirectTransition(
        domain("source", "site", { verified: false }),
        null,
      ),
    ).not.toThrow();
  });
});
