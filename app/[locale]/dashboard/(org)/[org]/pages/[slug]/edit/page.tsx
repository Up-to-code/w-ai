import { notFound } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Locale } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

import { fetchAuthQuery } from "@/lib/auth-server";
import { PageEditor } from "@/components/dashboard/page-editor-v2";

interface EditPageProps {
  params: Promise<{ locale: Locale; org: string; slug: string }>;
}

export default async function EditPage({ params }: EditPageProps) {
  const { locale, org: orgSlug, slug: pageSlug } = await params;
  const t = await getTranslations("dashboard");

  let orgDetails;
  try {
    orgDetails = await fetchAuthQuery(api.organizations.getBySlug, {
      slug: orgSlug,
    });
  } catch {
    notFound();
  }

  const orgId = orgDetails.org._id as Id<"organizations">;

  let page;
  try {
    page = await fetchAuthQuery(api.pages.getEditablePage, {
      orgId,
      slug: pageSlug,
    });
  } catch {
    notFound();
  }

  if (!page) notFound();

  return (
    <PageEditor
      interfaceLocale={locale}
      orgId={orgId}
      orgSlug={orgSlug}
      pageSlug={page.slug}
      initialTitle={page.title}
      initialPublished={page.published}
      initialUpdatedAt={page.updatedAt}
      initialData={page.data}
      labels={{
        back: t("editor.back"),
        save: t("editor.save"),
        preview: t("editor.preview"),
        publish: t("editor.publish"),
        unpublish: t("editor.unpublish"),
        saved: t("editor.saved"),
        saveError: t("editor.saveError"),
        saving: t("editor.saving"),
        notFound: t("editor.notFound"),
      }}
    />
  );
}
