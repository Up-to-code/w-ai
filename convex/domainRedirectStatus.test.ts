import { describe, expect, it } from "vitest";

import {
  DOMAIN_REDIRECT_STATUS_OPTIONS,
  isDomainRedirectStatusCode,
} from "../lib/domain-redirect-status";

describe("domain redirect status controls", () => {
  it("offers every status code accepted by the Vercel domain API", () => {
    expect(
      DOMAIN_REDIRECT_STATUS_OPTIONS.map((option) => option.value),
    ).toEqual([308, 301, 307, 302]);
  });

  it("rejects status codes outside the domain redirect contract", () => {
    expect(isDomainRedirectStatusCode(308)).toBe(true);
    expect(isDomainRedirectStatusCode(303)).toBe(false);
  });
});
