import { describe, expect, it } from "vitest";

import {
  activeCertificateExpiration,
  certificateNameCoversHostname,
} from "./domains";

describe("custom-domain TLS readiness", () => {
  it("matches exact names without case or trailing-dot sensitivity", () => {
    expect(
      certificateNameCoversHostname("WWW.Example.COM.", "www.example.com"),
    ).toBe(true);
    expect(
      certificateNameCoversHostname("example.com", "www.example.com"),
    ).toBe(false);
  });

  it("limits wildcard certificates to one subdomain label", () => {
    expect(
      certificateNameCoversHostname("*.example.com", "shop.example.com"),
    ).toBe(true);
    expect(certificateNameCoversHostname("*.example.com", "example.com")).toBe(
      false,
    );
    expect(
      certificateNameCoversHostname("*.example.com", "eu.shop.example.com"),
    ).toBe(false);
  });

  it("returns the latest unexpired certificate that covers the hostname", () => {
    const now = new Date("2026-08-09T00:00:00.000Z").getTime();
    const latest = now + 90 * 24 * 60 * 60_000;
    expect(
      activeCertificateExpiration(
        [
          {
            cns: ["www.example.com"],
            expiration: now / 1000 - 60,
          },
          {
            cns: ["irrelevant.example.com"],
            expiration: latest + 1,
          },
          {
            cns: ["*.example.com"],
            expiration: String(latest),
          },
        ],
        "www.example.com",
        now,
      ),
    ).toBe(latest);
  });
});
