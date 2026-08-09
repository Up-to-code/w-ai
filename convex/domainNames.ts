import { getDomain, parse } from "tldts";

/**
 * Returns the registrable DNS name using the Public Suffix List.
 *
 * A last-two-label heuristic is incorrect for multi-label public suffixes such
 * as `co.uk` and `com.au`. Private suffixes are enabled so tenant-style names
 * are never silently collapsed to a provider-owned parent zone.
 */
export function registrableDomain(hostname: string) {
  return getDomain(hostname, { allowPrivateDomains: true }) ?? hostname;
}

export function isApexHostname(hostname: string) {
  return registrableDomain(hostname) === hostname;
}

export function isRegistrableHostname(hostname: string) {
  const result = parse(hostname, { allowPrivateDomains: true });
  return result.domain !== null && result.isPrivate === false;
}

export function isHostnameWithinDomain(hostname: string, domain: string) {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/, "");
  const normalizedDomain = domain.toLowerCase().replace(/\.$/, "");
  return (
    normalizedHostname === normalizedDomain ||
    normalizedHostname.endsWith(`.${normalizedDomain}`)
  );
}

export function customDomainClaimError(
  hostname: string,
  reservedDomains: readonly string[],
) {
  if (!isRegistrableHostname(hostname)) {
    return "Enter a registrable public domain or subdomain";
  }
  if (
    reservedDomains.some((domain) => isHostnameWithinDomain(hostname, domain))
  ) {
    return "This hostname is reserved for the W-AI platform";
  }
  return null;
}
