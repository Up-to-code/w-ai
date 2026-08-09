import type { Locale } from "@/i18n/routing";

import { WorkspaceDomains } from "@/components/dashboard/workspace-domains";

export default async function WorkspaceDomainsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  return <WorkspaceDomains locale={locale === "ar" ? "ar" : "en"} />;
}
