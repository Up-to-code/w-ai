import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/routing";

import { fetchAuthQuery, getToken } from "@/lib/auth-server";
import { BrandLockup } from "@/components/brand/brand-mark";

interface AuthLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Auth shell. Signed-in users never stay on login/register —
 * they go to onboarding (no sites) or the dashboard.
 */
export default async function AuthLayout({
  children,
  params,
}: AuthLayoutProps) {
  const { locale } = await params;
  const token = await getToken();

  if (token) {
    try {
      const orgs = await fetchAuthQuery(api.organizations.listMine, {});
      if (!orgs || orgs.length === 0) {
        redirect(`/${locale}/onboarding`);
      }
      redirect(`/${locale}/dashboard`);
    } catch {
      // Session token present but query failed — still leave auth forms.
      redirect(`/${locale}/dashboard`);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xs font-semibold text-foreground transition-opacity hover:opacity-60"
          >
            <BrandLockup />
          </Link>
          <p className="label-meta">AUTH · WEB BUILDER</p>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm border border-border bg-card p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
