import type { Locale } from "@/i18n/routing";

import { WorkspaceDashboard } from "@/components/dashboard/workspace-dashboard-v2";

interface FolderPageProps {
  params: Promise<{ locale: Locale; folderId: string }>;
}

export default async function FolderPage({ params }: FolderPageProps) {
  const { locale, folderId } = await params;
  return (
    <WorkspaceDashboard
      locale={locale === "ar" ? "ar" : "en"}
      folderId={folderId}
    />
  );
}
