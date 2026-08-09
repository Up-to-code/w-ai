import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { resolveTenantSite } from "@/lib/tenant-resolution";
import { HtmlDirSetter } from "@/components/html-dir-setter";

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const headersList = await headers();
  const host = headersList.get("host") ?? "";

  const site = await resolveTenantSite(slug, host);
  if (!site) notFound();

  const defaultLanguage =
    site.languages.find((l) => l.isDefault) ?? site.languages[0] ?? null;
  const lang = defaultLanguage?.code ?? "ar";
  const dir = defaultLanguage?.rtl ? "rtl" : "ltr";

  return (
    <>
      <HtmlDirSetter lang={lang} dir={dir} />
      {children}
    </>
  );
}
