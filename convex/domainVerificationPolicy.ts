export const DOMAIN_VERIFICATION_RETRY_DELAYS_MS = [
  2 * 60 * 1000,
  10 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
] as const;

export function nextDomainVerificationRetry(attempt: number, now: number) {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new RangeError("Verification attempt must be a non-negative integer");
  }
  const delayMs = DOMAIN_VERIFICATION_RETRY_DELAYS_MS[attempt];
  return delayMs === undefined
    ? null
    : {
        attempt: attempt + 1,
        delayMs,
        nextVerificationAt: now + delayMs,
      };
}
