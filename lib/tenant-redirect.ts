import "server-only";

import { headers } from "next/headers";
import { permanentRedirect, redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";

import { convexClient } from "@/lib/convex-server";
import { tenantRequestIdentity } from "@/lib/tenant-host";

export type TenantSearchParams = Record<string, string | string[] | undefined>;

function appendSearchParams(url: URL, searchParams: TenantSearchParams) {
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || url.searchParams.has(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, value);
    }
  }
}

export async function applyTenantRedirect({
  slug,
  path,
  searchParams,
}: {
  slug: string;
  path: string;
  searchParams: TenantSearchParams;
}) {
  const host = (await headers()).get("host") ?? "";
  const identity = tenantRequestIdentity(host, slug);
  if (!identity) return;
  const rule = await convexClient.query(api.redirects.resolve, {
    slug: identity.kind === "slug" ? identity.slug : identity.hostname,
    host,
    path,
  });
  if (!rule) return;

  const base = `https://${host || "redirect.invalid"}`;
  const target = new URL(rule.destination, base);
  if (rule.preserveQuery) appendSearchParams(target, searchParams);

  const currentPath = path.length > 1 ? path.replace(/\/$/, "") : path;
  const currentHost = host.split(":")[0].toLowerCase();
  const current = new URL(currentPath, base);
  appendSearchParams(current, searchParams);
  if (
    target.hostname.toLowerCase() === currentHost &&
    target.pathname === currentPath &&
    target.search === current.search
  ) {
    return;
  }

  const destination = rule.destination.startsWith("/")
    ? `${target.pathname}${target.search}${target.hash}`
    : target.toString();
  if (rule.statusCode === 301 || rule.statusCode === 308) {
    permanentRedirect(destination);
  }
  redirect(destination);
}
