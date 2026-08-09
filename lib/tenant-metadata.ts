import "server-only";

import type { Metadata } from "next";
import { headers } from "next/headers";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convexClient } from "@/lib/convex-server";
import { localizedPageHref, resolveTenantPath } from "@/lib/tenant-path";
import { resolveTenantSite } from "@/lib/tenant-resolution";

function originForHost(host: string) {
  const local = /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(host);
  return `${local ? "http" : "https"}://${host}`;
}

export async function tenantPageMetadata(
  routeSlug: string,
  requestPath: string[],
): Promise<Metadata> {
  const host = (await headers()).get("host") ?? "";
  const site = await resolveTenantSite(routeSlug, host);
  if (!site) return {};

  const route = resolveTenantPath(requestPath, site.languages);
  let page = await convexClient.query(api.pageLocales.resolvePublished, {
    orgId: site.id,
    localeCode: route.localeCode,
    slug: route.pageSlug,
  });
  let detail:
    | {
        collectionId: Id<"cmsCollections">;
        detailPageSlug: string;
        entryId: Id<"cmsEntries">;
        values: unknown;
      }
    | null = null;
  if (!page) {
    const [collectionSlug, ...entrySlugParts] = route.pageSlug.split("/");
    if (collectionSlug && entrySlugParts.length > 0) {
      detail = await convexClient.query(api.cms.resolvePublishedDetail, {
        orgId: site.id,
        collectionSlug,
        localeCode: route.localeCode,
        slug: entrySlugParts.join("/"),
      });
      if (detail) {
        page = await convexClient.query(api.pageLocales.resolvePublished, {
          orgId: site.id,
          localeCode: route.localeCode,
          slug: detail.detailPageSlug,
        });
      }
    }
  }
  if (!page) return {};

  const defaultLocale =
    site.languages.find((language) => language.isDefault)?.code ?? "en";
  const alternates = detail
    ? await convexClient.query(api.cms.listPublishedEntryRoutes, {
        entryId: detail.entryId,
      })
    : await convexClient.query(api.pageLocales.listPublishedAlternates, {
        pageId: page.pageId,
      });
  const origin = originForHost(host);
  const languageUrls = Object.fromEntries(
    alternates.map((alternate) => [
      alternate.localeCode,
      `${origin}${localizedPageHref(
        detail ? `${route.pageSlug.split("/")[0]}/${alternate.slug}` : alternate.slug,
        alternate.localeCode === defaultLocale ? "" : alternate.localeCode,
      )}`,
    ]),
  );
  const canonical = `${origin}${localizedPageHref(
    detail ? route.pageSlug : page.slug,
    route.localePrefix,
  )}`;
  const localizedEntryTitle =
    detail?.values && typeof detail.values === "object"
      ? (detail.values as Record<string, unknown>).title
      : undefined;
  const titleValue =
    localizedEntryTitle && typeof localizedEntryTitle === "object"
      ? (localizedEntryTitle as Record<string, unknown>)[route.localeCode]
      : localizedEntryTitle;
  const title =
    (typeof titleValue === "string" ? titleValue : undefined) ??
    page.seo?.title ??
    page.title ??
    site.name;
  const description = page.seo?.description;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: languageUrls,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: site.name,
      locale: route.localeCode,
      images: page.seo?.ogImage ? [page.seo.ogImage] : undefined,
    },
  };
}
