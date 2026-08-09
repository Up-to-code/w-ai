import { notFound } from "next/navigation";
import { TenantShell } from "@/components/tenant/tenant-site";
import { tenantPageMetadata } from "@/lib/tenant-metadata";
import {
  applyTenantRedirect,
  type TenantSearchParams,
} from "@/lib/tenant-redirect";

interface PageProps {
  params: Promise<{ slug: string; path: string[] }>;
  searchParams: Promise<TenantSearchParams>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug, path } = await params;
  return tenantPageMetadata(slug, path);
}

export default async function TenantPage({ params, searchParams }: PageProps) {
  const { slug, path } = await params;
  const pageSlug = path.join("/");
  if (!pageSlug) notFound();
  await applyTenantRedirect({
    slug,
    path: `/${pageSlug}`,
    searchParams: await searchParams,
  });
  return <TenantShell slug={slug} requestPath={path} />;
}
