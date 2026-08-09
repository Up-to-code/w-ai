import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { api } from "@/convex/_generated/api";
import { convexClient } from "@/lib/convex-server";
import { getToken } from "@/lib/auth-server";
import type { Id } from "@/convex/_generated/dataModel";

export type OrgDetails = Awaited<ReturnType<typeof fetchOrgBySlug>>;

/**
 * Fetches full org details by slug using the service-role Convex HTTP client.
 * Wrapped in `cache()` so repeated calls within one RSC render tree are
 * de-duplicated automatically (React's per-request cache).
 */
export const fetchOrgBySlug = cache(async (slug: string, locale: string) => {
  const token = await getToken();
  if (!token) redirect(`/${locale}/login`);

  try {
    const org = await convexClient.query(api.organizations.getBySlug, { slug });
    return org;
  } catch {
    notFound();
  }
});

/**
 * Validates that the org ID string is a real Convex ID shape.
 * Used by layouts that receive `orgId` from parent props.
 */
export function asOrgId(id: string): Id<"organizations"> {
  return id as Id<"organizations">;
}
