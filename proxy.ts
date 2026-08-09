import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { isAppHost, tenantSlugFromHost } from "./lib/tenant-host";

const intl = createMiddleware(routing);

const APP_ONLY_PATH_PREFIXES = [
  "/api",
  "/brand",
  "/c",
  "/icons",
  "/images",
  "/metadata",
  "/roshn-plus",
];

const APP_STATIC_PATHS = new Set([
  "/icon.svg",
  "/robots.txt",
  "/site.webmanifest",
]);

/**
 * These paths belong to the W-AI application when they are requested on an
 * application host. They must not be excluded by the static matcher because
 * the same path names are valid customer-site URLs on a custom domain.
 */
export function isAppOnlyPath(pathname: string) {
  return (
    APP_STATIC_PATHS.has(pathname) ||
    APP_ONLY_PATH_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

// Tenant subdomains ({slug}.qentrah.com / {slug}.localhost) serve the org's
// public single-locale site. The app origin keeps its normal next-intl routing.
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");

  if (!isAppHost(host)) {
    const slug = tenantSlugFromHost(host) ?? host?.split(":")[0].toLowerCase();
    if (slug) {
      const url = request.nextUrl.clone();
      url.pathname = `/c/${slug}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  if (isAppOnlyPath(pathname)) return NextResponse.next();

  return intl(request);
}

// Read more: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
export const config = {
  matcher: [
    // Keep framework assets out of Proxy, but do not exclude application path
    // names such as `c`, `contact`, `api`, or `images` globally. On a custom
    // domain those are tenant-owned paths and may have redirect rules.
    "/((?!_next/static|_next/image|favicon.ico|_next/data).*)",
    "/(en|ar)/:path*",
  ],
};
