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
  searchParams: Promise<{ locale?: string }>;
}

export default async function PagePreviewPage({ params, searchParams }: PagePreviewProps) {
  const { org: orgSlug, slug: pageSlug } = await params;
  const requestedLocale = (await searchParams).locale ?? "en";
  const puckLocale = requestedLocale as QentrahLocale;

  let orgDetails;
  try {
    orgDetails = await fetchAuthQuery(api.organizations.getBySlug, {
      slug: orgSlug,
    });
  } catch {
    notFound();
  }

  const [page, pageLocaleData, languages] = await Promise.all([
    fetchAuthQuery(api.pages.getEditablePage, {
      orgId: orgDetails.org._id,
      slug: pageSlug,
    }),
    fetchAuthQuery(api.pageLocales.listForPage, {
      orgId: orgDetails.org._id,
      pageSlug,
    }),
    fetchAuthQuery(api.languages.list, { orgId: orgDetails.org._id }),
  ]);

  if (!page) notFound();

  const localeRecord = pageLocaleData.locales.find(
    (item) => item.localeCode === requestedLocale,
  );
  const language = languages.find((item) => item.code === requestedLocale);
  if (!localeRecord || !language?.enabled) notFound();
  const title = localeRecord.title || pick(page.title, puckLocale) || page.slug;
  const localePrefix =
    requestedLocale === pageLocaleData.defaultLocale ? "" : `/${requestedLocale}`;
  const localizedSlug = localeRecord.slug === "home" ? "" : `/${localeRecord.slug}`;
  const publicUrl = tenantUrl(
    orgSlug,
    `${localePrefix}${localizedSlug}` || "/",
  );

  return (
    <PreviewShell
      orgSlug={orgSlug}
      pageSlug={page.slug}
      title={title}
      published={localeRecord.status === "published"}
      publicUrl={publicUrl}
    >
      <PageRenderer
        data={page.data}
        locale={puckLocale}
        direction={language.direction ?? (language.rtl ? "rtl" : "ltr")}
        preferredFont={language.preferredFont}
      />
    </PreviewShell>
  );
}
