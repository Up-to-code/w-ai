import "server-only";

import { api } from "@/convex/_generated/api";

import { convexClient } from "@/lib/convex-server";
import { tenantRequestIdentity } from "@/lib/tenant-host";

export async function resolveTenantSite(routeSlug: string, host: string) {
  const identity = tenantRequestIdentity(host, routeSlug);
  if (!identity) return null;
  return identity.kind === "slug"
    ? convexClient.query(api.tenant.getSiteBySlug, { slug: identity.slug })
    : convexClient.query(api.tenant.getSiteByHost, {
        host: identity.hostname,
      });
}
