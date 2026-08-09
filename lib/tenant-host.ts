/** Canonical host for the W-AI application and authentication UI. */
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "w-ai.online";

/** Parent zone reserved for published tenant subdomains. */
export const TENANT_DOMAIN =
  process.env.NEXT_PUBLIC_TENANT_DOMAIN ?? "qentrah.com";

// App root is always a subdomain-capable parent (tenant subdomains live under it).
const PARENT_DOMAINS = [TENANT_DOMAIN, "localhost"];

const APP_SUBDOMAINS = ["app", "www", "admin", "cms", "docs", "api", "billing"];

/** Normalizes a Host header without breaking bracketed IPv6 development hosts. */
export function hostnameFromHostHeader(
  host: string | undefined | null,
): string | null {
  if (!host) return null;
  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    const normalized = host.split(":")[0]?.trim().toLowerCase();
    return normalized || null;
  }
}

/** Canonical hostname for a tenant's site, e.g. `acme.qentrah.com`. */
export function tenantHostname(slug: string): string {
  return `${slug}.${TENANT_DOMAIN}`;
}

/** Origin + path for a tenant site. Uses `{slug}.localhost` in dev. */
export function tenantUrl(slug: string, path = "/"): string {
  const isProd = process.env.NODE_ENV === "production";
  const protocol = isProd ? "https" : "http";
  const host = isProd
    ? tenantHostname(slug)
    : `${slug}.localhost:${process.env.NEXT_PUBLIC_DEV_PORT ?? "3000"}`;
  return `${protocol}://${host}${path}`;
}

/**
 * Extracts the tenant slug from a Host header for `{slug}.{APP_DOMAIN}` (prod)
 * and `{slug}.localhost` (local dev). Returns null when the host is the app
 * itself, a reserved app subdomain, or a non-subdomain host (custom domain —
 * resolved by the domains table instead).
 */
export function tenantSlugFromHost(
  host: string | undefined | null,
): string | null {
  const normalized = hostnameFromHostHeader(host);
  if (!normalized) return null;

  for (const parent of PARENT_DOMAINS) {
    if (normalized === parent) return null;
    const suffix = `.${parent}`;
    if (normalized.endsWith(suffix)) {
      const subdomain = normalized.slice(0, -suffix.length);
      if (!subdomain || subdomain.includes(".")) return null;
      if (APP_SUBDOMAINS.includes(subdomain)) return null;
      return subdomain;
    }
  }
  return null;
}

/** True when the host is the app itself or one of its reserved subdomains. */
export function isAppHost(host: string | undefined | null): boolean {
  const normalized = hostnameFromHostHeader(host);
  if (!normalized) return false;
  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]" ||
    normalized === APP_DOMAIN ||
    normalized === TENANT_DOMAIN
  ) {
    return true;
  }
  for (const sub of APP_SUBDOMAINS) {
    if (
      normalized === `${sub}.localhost` ||
      normalized === `${sub}.${APP_DOMAIN}` ||
      normalized === `${sub}.${TENANT_DOMAIN}`
    ) {
      return true;
    }
  }
  return false;
}

export type TenantRequestIdentity =
  { kind: "slug"; slug: string } | { kind: "custom-host"; hostname: string };

/**
 * Binds the internal `/c/[slug]` rewrite target to the incoming Host header.
 * Direct requests to that internal route on the application host are rejected.
 */
export function tenantRequestIdentity(
  host: string | undefined | null,
  routeSlug: string,
): TenantRequestIdentity | null {
  const tenantSlug = tenantSlugFromHost(host);
  if (tenantSlug) {
    return tenantSlug === routeSlug ? { kind: "slug", slug: tenantSlug } : null;
  }
  if (isAppHost(host)) return null;
  const hostname = hostnameFromHostHeader(host);
  return hostname ? { kind: "custom-host", hostname } : null;
}
