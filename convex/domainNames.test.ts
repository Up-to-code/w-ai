import { describe, expect, it } from "vitest";

import {
  customDomainClaimError,
  isApexHostname,
  isHostnameWithinDomain,
  isRegistrableHostname,
  registrableDomain,
} from "./domainNames";

describe("public-suffix-aware domain names", () => {
  it.each([
    ["example.com", "example.com", true],
    ["www.example.com", "example.com", false],
    ["example.co.uk", "example.co.uk", true],
    ["shop.example.co.uk", "example.co.uk", false],
    ["example.com.au", "example.com.au", true],
    ["cdn.example.com.au", "example.com.au", false],
  ])("classifies %s", (hostname, expectedDomain, expectedApex) => {
    expect(registrableDomain(hostname)).toBe(expectedDomain);
    expect(isApexHostname(hostname)).toBe(expectedApex);
  });

  it("does not collapse a private-suffix tenant name to its provider parent", () => {
    expect(registrableDomain("team.github.io")).toBe("team.github.io");
    expect(isApexHostname("team.github.io")).toBe(true);
  });

  it("rejects bare public suffixes and local-only hostnames", () => {
    expect(isRegistrableHostname("example.co.uk")).toBe(true);
    expect(isRegistrableHostname("co.uk")).toBe(false);
    expect(isRegistrableHostname("localhost")).toBe(false);
    expect(isRegistrableHostname("team.github.io")).toBe(false);
  });

  it("matches a platform apex and its subdomains without suffix confusion", () => {
    expect(isHostnameWithinDomain("w-ai.online", "w-ai.online")).toBe(true);
    expect(isHostnameWithinDomain("www.w-ai.online", "w-ai.online")).toBe(true);
    expect(isHostnameWithinDomain("customer.w-ai.online.", "w-ai.online")).toBe(
      true,
    );
    expect(isHostnameWithinDomain("notw-ai.online", "w-ai.online")).toBe(false);
    expect(isHostnameWithinDomain("w-ai.online.example", "w-ai.online")).toBe(
      false,
    );
  });

  it("returns the same claim rejection used by the domain mutation", () => {
    const reserved = ["w-ai.online", "qentrah.com"];
    expect(customDomainClaimError("customer.com", reserved)).toBeNull();
    expect(customDomainClaimError("co.uk", reserved)).toBe(
      "Enter a registrable public domain or subdomain",
    );
    expect(customDomainClaimError("app.w-ai.online", reserved)).toBe(
      "This hostname is reserved for the W-AI platform",
    );
  });
});
