export const SITE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED_SITE_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "billing",
  "cms",
  "dashboard",
  "docs",
  "help",
  "mail",
  "status",
  "support",
  "www",
]);

export type SiteSlugStatus = "available" | "invalid" | "reserved";

export function siteSlugStatus(raw: string): SiteSlugStatus {
  const slug = raw.trim().toLowerCase();
  if (slug.length < 3 || slug.length > 40 || !SITE_SLUG_RE.test(slug)) {
    return "invalid";
  }
  return RESERVED_SITE_SLUGS.has(slug) ? "reserved" : "available";
}
