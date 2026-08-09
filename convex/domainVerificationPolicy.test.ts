import { describe, expect, it } from "vitest";

import {
  DOMAIN_VERIFICATION_RETRY_DELAYS_MS,
  nextDomainVerificationRetry,
} from "./domainVerificationPolicy";

describe("automatic domain verification policy", () => {
  it("uses increasing bounded retries", () => {
    const now = 1_000_000;
    expect(nextDomainVerificationRetry(0, now)).toEqual({
      attempt: 1,
      delayMs: 2 * 60 * 1000,
      nextVerificationAt: now + 2 * 60 * 1000,
    });
    expect(
      nextDomainVerificationRetry(
        DOMAIN_VERIFICATION_RETRY_DELAYS_MS.length - 1,
        now,
      ),
    ).toEqual({
      attempt: DOMAIN_VERIFICATION_RETRY_DELAYS_MS.length,
      delayMs: 24 * 60 * 60 * 1000,
      nextVerificationAt: now + 24 * 60 * 60 * 1000,
    });
    expect(
      nextDomainVerificationRetry(
        DOMAIN_VERIFICATION_RETRY_DELAYS_MS.length,
        now,
      ),
    ).toBeNull();
  });

  it("rejects malformed attempt counters", () => {
    expect(() => nextDomainVerificationRetry(-1, Date.now())).toThrow(
      "non-negative integer",
    );
    expect(() => nextDomainVerificationRetry(1.5, Date.now())).toThrow(
      "non-negative integer",
    );
  });
});
