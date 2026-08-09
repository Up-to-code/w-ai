import { notFound } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Locale } from "@/i18n/routing";

import { fetchAuthQuery } from "@/lib/auth-server";
import { pick, type QentrahLocale } from "@/lib/puck/localized";
import { tenantUrl } from "@/lib/tenant-host";
import { PreviewShell } from "@/components/dashboard/preview-shell-v2";
import { PageRenderer } from "@/components/qentrah/page-renderer";

interface PagePreviewProps {
  params: Promise<{ locale: Locale; org: string; slug: string }>;
}

export default async function PagePreviewPage({ params }: PagePreviewProps) {
  const { locale, org: orgSlug, slug: pageSlug } = await params;
  const puckLocale = (locale === "en" ? "en" : "ar") as QentrahLocale;

  let orgDetails;
  try {
    orgDetails = await fetchAuthQuery(api.organizations.getBySlug, {
      slug: orgSlug,
    });
  } catch {
    notFound();
  }

  const page = await fetchAuthQuery(api.pages.getEditablePage, {
    orgId: orgDetails.org._id,
    slug: pageSlug,
  });

  if (!page) notFound();

  const title = pick(page.title, puckLocale) || page.slug;
  const publicUrl = tenantUrl(
    orgSlug,
    page.slug === "home" ? "/" : `/${page.slug}`,
  );

  return (
    <PreviewShell
      orgSlug={orgSlug}
      pageSlug={page.slug}
      title={title}
      published={page.published}
      publicUrl={publicUrl}
    >
      <PageRenderer data={page.data} locale={puckLocale} />
    </PreviewShell>
  );
}
