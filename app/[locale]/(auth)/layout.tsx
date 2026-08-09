import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations({ locale, namespace: "auth" });
  const isArabic = locale === "ar";
  const authCopy = {
    accountAccess: t.has("accountAccess")
      ? t("accountAccess")
      : isArabic
        ? "الدخول إلى الحساب"
        : "Account access",
    productEyebrow: t.has("productEyebrow")
      ? t("productEyebrow")
      : isArabic
        ? "مساحة عمل W-AI"
        : "W-AI workspace",
    productTitle: t.has("productTitle")
      ? t("productTitle")
      : isArabic
        ? "ابنِ الويب الذي تملكه."
        : "Build the web you own.",
    productDescription: t.has("productDescription")
      ? t("productDescription")
      : isArabic
        ? "صمّم وأدر وانشر مواقع متجاوبة من مساحة عمل مستقلة واحدة."
        : "Design, manage, and publish responsive websites from one independent workspace.",
  };
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
    <div className="min-h-screen bg-background">
      <header className="absolute inset-x-0 top-0 z-10 h-16 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="flex h-full items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className="text-xs font-semibold text-foreground transition-opacity hover:opacity-60"
          >
            <BrandLockup />
          </Link>
          <p className="text-xs text-muted-foreground">
            {authCopy.accountAccess}
          </p>
        </div>
      </header>

      <main className="grid min-h-screen pt-16 lg:grid-cols-[minmax(360px,0.82fr)_1.18fr]">
        <aside className="relative hidden min-h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0a0a] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "linear-gradient(to bottom right, black, transparent 72%)",
            }}
          />

          <p className="relative text-xs font-medium uppercase tracking-[0.14em] text-white/55">
            {authCopy.productEyebrow}
          </p>

          <div className="relative max-w-xl pb-8">
            <h2 className="text-5xl font-semibold leading-[0.98] tracking-[-0.055em] xl:text-6xl">
              {authCopy.productTitle}
            </h2>
            <p className="text-white/58 mt-6 max-w-md text-base leading-7">
              {authCopy.productDescription}
            </p>
          </div>
        </aside>

        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-14 sm:px-10 lg:px-14 xl:px-20">
          {children}
        </div>
      </main>
    </div>
  );
}
