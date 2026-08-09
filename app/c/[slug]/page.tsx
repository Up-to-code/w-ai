import { TenantShell } from "@/components/tenant/tenant-site";
import { tenantPageMetadata } from "@/lib/tenant-metadata";
import {
  applyTenantRedirect,
  type TenantSearchParams,
} from "@/lib/tenant-redirect";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<TenantSearchParams>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  return tenantPageMetadata(slug, []);
}

export default async function TenantRootPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  await applyTenantRedirect({ slug, path: "/", searchParams: await searchParams });
  return <TenantShell slug={slug} requestPath={[]} />;
}
