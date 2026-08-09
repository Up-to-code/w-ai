import { describe, expect, it } from "vitest";

import { domainTransitionBlockerMessage } from "./domains";

describe("domain ownership transition guards", () => {
  it("blocks detachment while another hostname redirects to the domain", () => {
    expect(
      domainTransitionBlockerMessage(["www.customer.example"], [], "detaching"),
    ).toBe(
      "Remove redirects from www.customer.example before detaching this domain",
    );
  });

  it("blocks reassignment while hostname-specific path redirects remain", () => {
    expect(
      domainTransitionBlockerMessage(
        [],
        ["/old", "/campaign", "/pricing", "/legacy"],
        "assigning",
      ),
    ).toBe(
      "Remove hostname-specific redirect rules (/old, /campaign, /pricing, and 1 more) before assigning this domain",
    );
  });

  it("allows a transition after all redirect dependencies are removed", () => {
    expect(domainTransitionBlockerMessage([], [], "detaching")).toBeNull();
  });

  it("prevents redirect chains and unreachable hostname rules", () => {
    expect(
      domainTransitionBlockerMessage(
        ["shop.customer.example"],
        [],
        "redirecting",
      ),
    ).toBe(
      "Remove redirects from shop.customer.example before redirecting this domain",
    );
    expect(
      domainTransitionBlockerMessage([], ["/old", "/campaign"], "redirecting"),
    ).toBe(
      "Remove hostname-specific redirect rules (/old, /campaign) before redirecting this domain",
    );
  });
});
