import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { AlertTriangle, ArrowUpRight, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { fetchAuthQuery, getToken } from "@/lib/auth-server";
import { BrandLockup } from "@/components/brand/brand-mark";
import { OrgShell } from "@/components/dashboard/org-shell";

interface OrgLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: Locale; org: string }>;
}

type UserOrg = {
  _id: string;
  name: string;
  slug: string;
  role: string;
};

async function MissingOrgDashboard({
  missingSlug,
  orgs,
}: {
  missingSlug: string;
  orgs: UserOrg[];
}) {
  const t = await getTranslations("dashboard");

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
        <header className="flex h-12 items-center justify-between border-b border-border">
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-foreground"
          >
            <BrandLockup />
          </Link>
          <Link
            href="/onboarding"
            className="transition-brand inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3.5" strokeWidth={1.5} />
            {t("orgNotFound.newSite")}
          </Link>
        </header>

        <section className="grid flex-1 gap-6 py-12 lg:grid-cols-[1fr_340px] lg:items-center">
          <div className="space-y-5">
            <span className="tag-schema schema-orange">
              <AlertTriangle className="size-3.5" strokeWidth={1.5} />
              {t("orgNotFound.badge")}
            </span>
            <p className="label-meta" dir="ltr">
              /dashboard/{missingSlug}
            </p>
            <h1 className="max-w-xl text-h1 font-semibold text-foreground">
              {t("orgNotFound.title")}
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              {t("orgNotFound.subtitle")}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href="/dashboard"
                className="transition-brand inline-flex items-center gap-1.5 rounded-sm bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-w-carbon"
              >
                {t("orgNotFound.chooseSite")}
                <ArrowUpRight className="size-4" strokeWidth={1.5} />
              </Link>
              <Link
                href="/onboarding"
                className="transition-brand inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-w-canvas"
              >
                <Plus className="size-4" strokeWidth={1.5} />
                {t("orgNotFound.createSite")}
              </Link>
            </div>
          </div>

          <aside className="border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="label-meta">{t("orgNotFound.availableSites")}</p>
            </div>
            {orgs.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">
                {t("orgNotFound.empty")}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {orgs.map((org, index) => (
                  <Link
                    key={org._id}
                    href={{
                      pathname: "/dashboard/[org]/pages",
                      params: { org: org.slug },
                    }}
                    className="transition-brand group flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-w-canvas"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {org.name}
                      </span>
                      <span
                        className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground"
                        dir="ltr"
                      >
                        {org.slug}.qentrah.com
                      </span>
                    </span>
                    <span className="label-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { locale, org: slug } = await params;

  const token = await getToken();
  if (!token) redirect(`/${locale}/login`);

  let orgDetails;
  try {
    orgDetails = await fetchAuthQuery(api.organizations.getBySlug, { slug });
  } catch {
    const orgs = await fetchAuthQuery(api.organizations.listMine, {}).catch(
      () => [],
    );
    if (orgs.length === 0) redirect(`/${locale}/onboarding`);
    return <MissingOrgDashboard missingSlug={slug} orgs={orgs} />;
  }

  if (!orgDetails) notFound();

  return (
    <OrgShell
      org={{
        orgId: orgDetails.org._id as Id<"organizations">,
        orgSlug: orgDetails.org.slug,
        orgName: orgDetails.org.name,
        role: orgDetails.myRole,
        domains: (orgDetails.domains ?? []).map((d) => ({
          _id: d._id,
          hostname: d.hostname,
          verified: d.verified,
        })),
      }}
    >
      {children}
    </OrgShell>
  );
}
