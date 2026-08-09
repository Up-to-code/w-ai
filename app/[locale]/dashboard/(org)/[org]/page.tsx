import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/routing";

interface SiteRootPageProps {
  params: Promise<{ locale: Locale; org: string }>;
}

export default async function SiteRootPage({ params }: SiteRootPageProps) {
  const { locale, org } = await params;

  redirect(`/${locale}/dashboard/${org}/pages`);
}
