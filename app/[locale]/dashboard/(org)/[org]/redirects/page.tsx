import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { fetchAuthQuery } from "@/lib/auth-server";
import { RedirectsManager } from "@/components/dashboard/redirects-manager";

export default async function RedirectsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const details = await fetchAuthQuery(api.organizations.getBySlug, { slug });
  return (
    <RedirectsManager
      orgId={details.org._id as Id<"organizations">}
      domains={details.domains.map((domain) => ({
        _id: domain._id,
        hostname: domain.hostname,
        verified: domain.verified,
        redirectTo: domain.redirectTo,
        redirectStatusCode: domain.redirectStatusCode,
      }))}
    />
  );
}
