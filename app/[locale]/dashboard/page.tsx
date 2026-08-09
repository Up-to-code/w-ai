import type { Locale } from "@/i18n/routing";

import { WorkspaceDashboard } from "@/components/dashboard/workspace-dashboard-v2";

interface DashboardPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  return <WorkspaceDashboard locale={locale === "ar" ? "ar" : "en"} />;
}
