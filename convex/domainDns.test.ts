import { describe, expect, it } from "vitest";

import {
  dnsNameBelongsToHostname,
  isPlatformManagedDnsRecord,
  validateDnsRecordInput,
} from "./domainDns";

const domain = {
  hostname: "site.example.co.uk",
  routingType: "CNAME" as const,
  platformVerification: [
    { type: "TXT", domain: "_vercel.site.example.co.uk" },
  ],
};

describe("domain DNS isolation", () => {
  it("accepts the selected hostname and its children", () => {
    expect(dnsNameBelongsToHostname("site.example.co.uk", domain.hostname)).toBe(true);
    expect(dnsNameBelongsToHostname("api.site.example.co.uk", domain.hostname)).toBe(true);
  });

  it("rejects sibling records in a shared provider zone", () => {
    expect(dnsNameBelongsToHostname("other.example.co.uk", domain.hostname)).toBe(false);
    expect(dnsNameBelongsToHostname("example.co.uk", domain.hostname)).toBe(false);
  });

  it("protects routing, ownership, and platform challenge records", () => {
    expect(isPlatformManagedDnsRecord({ type: "CNAME", name: domain.hostname }, domain)).toBe(true);
    expect(isPlatformManagedDnsRecord({ type: "TXT", name: `_w-ai-verify.${domain.hostname}` }, domain)).toBe(true);
    expect(isPlatformManagedDnsRecord({ type: "TXT", name: "_vercel.site.example.co.uk" }, domain)).toBe(true);
    expect(isPlatformManagedDnsRecord({ type: "TXT", name: "custom.site.example.co.uk" }, domain)).toBe(false);
  });

  it("validates bounded content and provider-safe TTLs", () => {
    expect(validateDnsRecordInput({ content: " 203.0.113.1 ", ttl: 300 })).toEqual({ content: "203.0.113.1", recordId: undefined });
    expect(() => validateDnsRecordInput({ content: "", ttl: 300 })).toThrow(/content/);
    expect(() => validateDnsRecordInput({ content: "value", ttl: 30 })).toThrow(/TTL/);
  });
});
