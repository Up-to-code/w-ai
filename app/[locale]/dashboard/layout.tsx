import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getToken } from "@/lib/auth-server";

interface DashboardLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Dashboard root layout owns authentication only. The `/dashboard` index
 * loads the user's sites reactively on the client; org-scoped routes are
 * entered only after a site is selected.
 */
export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { locale } = await params;
  const token = await getToken();
  if (!token) redirect(`/${locale}/login`);

  return <>{children}</>;
}
