import { TenantShell } from "@/components/tenant/tenant-site";
import {
  applyTenantRedirect,
  type TenantSearchParams,
} from "@/lib/tenant-redirect";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<TenantSearchParams>;
}

export default async function TenantRootPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  await applyTenantRedirect({ slug, path: "/", searchParams: await searchParams });
  return <TenantShell slug={slug} />;
}
