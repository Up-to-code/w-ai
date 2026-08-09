import { getTranslations } from "next-intl/server";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { PagesManager } from "@/components/dashboard/pages-manager-v2";
import type { Locale } from "@/i18n/routing";
import type { Id } from "@/convex/_generated/dataModel";

interface PagesPageProps {
  params: Promise<{ locale: Locale; org: string }>;
}

export default async function PagesPage({ params }: PagesPageProps) {
  const { locale, org: slug } = await params;
  const t = await getTranslations("dashboard");

  const orgDetails = await fetchAuthQuery(api.organizations.getBySlug, {
    slug,
  });
  const orgId = orgDetails.org._id as Id<"organizations">;
  const pages = await fetchAuthQuery(api.pages.listPages, { orgId });

  return (
    <PagesManager
      locale={locale === "en" ? "en" : "ar"}
      orgId={orgId}
      orgSlug={slug}
      orgName={orgDetails.org.name}
      initialPages={pages}
      labels={{
        title: t("pages.title"),
        subtitle: t("pages.subtitle"),
        newPage: t("pages.newPage"),
        empty: t("pages.empty"),
        published: t("pages.published"),
        draft: t("pages.draft"),
        edit: t("pages.edit"),
        preview: t("pages.preview"),
        publish: t("pages.publish"),
        unpublish: t("pages.unpublish"),
        delete: t("pages.delete"),
        deleteTitle: t("pages.deleteTitle"),
        deleteDesc: t("pages.deleteDesc"),
        deleteConfirm: t("pages.deleteConfirm"),
        cancel: t("pages.cancel"),
        create: t("pages.create"),
        created: t("pages.created"),
        error: t("pages.error"),
        nameAr: t("pages.nameAr"),
        nameEn: t("pages.nameEn"),
        pageAddress: t("pages.pageAddress"),
        slugInvalid: t("pages.slugInvalid"),
        updated: t("pages.updated"),
        openSite: t("overview.openSite"),
        pagesStat: t("overview.pages"),
        publishedStat: t("overview.published"),
        draftsStat: t("overview.drafts"),
      }}
    />
  );
}
