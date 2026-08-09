import { describe, expect, it } from "vitest";

import {
  preferredVercelDnsTargets,
  type VercelDomainConfiguration,
} from "./vercelDomainConfig";

const baseConfig: VercelDomainConfiguration = {
  configuredBy: null,
  acceptedChallenges: ["dns-01", "http-01"],
  recommendedIPv4: [],
  recommendedCNAME: [],
  misconfigured: true,
};

describe("Vercel domain configuration", () => {
  it("uses the highest-priority project-specific records", () => {
    expect(
      preferredVercelDnsTargets(
        {
          ...baseConfig,
          recommendedIPv4: [
            { rank: 2, value: ["192.0.2.2"] },
            { rank: 1, value: ["192.0.2.1", "192.0.2.3"] },
          ],
          recommendedCNAME: [
            { rank: 2, value: "secondary.vercel-dns.example" },
            { rank: 1, value: "project.vercel-dns.example." },
          ],
        },
        {
          cnameTarget: "cname.vercel-dns.com",
          apexTarget: "76.76.21.21",
        },
      ),
    ).toEqual({
      cnameTarget: "project.vercel-dns.example",
      apexTarget: "192.0.2.1",
    });
  });

  it("falls back when Vercel returns no usable recommendation", () => {
    expect(
      preferredVercelDnsTargets(baseConfig, {
        cnameTarget: "cname.vercel-dns.com",
        apexTarget: "76.76.21.21",
      }),
    ).toEqual({
      cnameTarget: "cname.vercel-dns.com",
      apexTarget: "76.76.21.21",
    });
  });
});
