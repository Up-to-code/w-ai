import { getTranslations } from "next-intl/server";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { DomainsSettings } from "@/components/dashboard/domains-settings-v2";
import type { Id } from "@/convex/_generated/dataModel";

interface SettingsPageProps {
  params: Promise<{ org: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { org: slug } = await params;
  const t = await getTranslations("dashboard.settings");

  const orgDetails = await fetchAuthQuery(api.organizations.getBySlug, {
    slug,
  });
  const orgId = orgDetails.org._id as Id<"organizations">;
  const domains = await fetchAuthQuery(api.domains.listForOrg, { orgId });
  return (
    <DomainsSettings
      orgId={orgId}
      orgSlug={slug}
      initialDomains={domains}
      labels={{
        title: t("title"),
        subtitle: t("subtitle"),
        name: t("name"),
        namePlaceholder: t("namePlaceholder"),
        theme: t("theme"),
        primary: t("primary"),
        background: t("background"),
        foreground: t("foreground"),
        secondary: t("secondary"),
        accent: t("accent"),
        radius: t("radius"),
        save: t("save"),
        saved: t("saved"),
        saveError: t("saveError"),
        customDomain: t("customDomain"),
        customDomainHint: t("customDomainHint"),
        domainPlaceholder: t("domainPlaceholder"),
        addDomain: t("addDomain"),
        domainAdded: t("domainAdded"),
        verify: t("verify"),
      }}
    />
  );
}
