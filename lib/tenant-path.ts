export type SiteLanguage = {
  code: string;
  enabled?: boolean;
  isDefault: boolean;
};

export type TenantPathResolution = {
  localeCode: string;
  pageSlug: string;
  localePrefix: string;
  isDefaultLocale: boolean;
};

/** Resolves locale/page below the tenant route, never in Next Proxy. */
export function resolveTenantPath(
  path: string | string[] | undefined,
  languages: SiteLanguage[],
): TenantPathResolution {
  const segments = (Array.isArray(path) ? path : path?.split("/") ?? [])
    .map((segment) => segment.trim())
    .filter(Boolean);
  const defaultLanguage =
    languages.find((language) => language.isDefault) ??
    languages[0] ??
    { code: "en", isDefault: true };
  const first = segments[0];
  const prefixed = languages.find(
    (language) =>
      language.code === first &&
      language.code !== defaultLanguage.code &&
      language.enabled !== false,
  );
  const localeCode = prefixed?.code ?? defaultLanguage.code;
  const pageSegments = prefixed ? segments.slice(1) : segments;
  return {
    localeCode,
    pageSlug: pageSegments.join("/") || "home",
    localePrefix: prefixed ? `/${prefixed.code}` : "",
    isDefaultLocale: !prefixed,
  };
}

export function localizedPageHref(
  slug: string,
  localePrefix: string,
) {
  const pagePath = slug === "home" ? "" : `/${slug}`;
  return `${localePrefix}${pagePath}` || "/";
}
