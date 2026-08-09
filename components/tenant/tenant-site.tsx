import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { blendHex, hexToHslTriplet, isLightColor } from "@/lib/color";
import { convexClient } from "@/lib/convex-server";
import { pick, type QentrahLocale } from "@/lib/puck/localized";
import {
  localizedPageHref,
  resolveTenantPath,
} from "@/lib/tenant-path";
import { resolveTenantSite } from "@/lib/tenant-resolution";
import { PageRenderer } from "@/components/qentrah/page-renderer";
import {
  SiteFooterCode,
  SiteHeadCode,
} from "@/components/tenant/site-custom-code";

const DEFAULT_TOKENS = {
  primary: "#C9A227",
  secondary: "#1F2937",
  accent: "#0F766E",
  background: "#F5F2EC",
  foreground: "#17120B",
  radius: 12,
} as const;

type PublicSite = Awaited<ReturnType<typeof resolveTenantSite>>;

function hsl(hex: string): string {
  return hexToHslTriplet(hex) ?? "0 0% 0%";
}

function blend(bg: string, fg: string, t: number): string {
  return blendHex(bg, fg, t) ?? fg;
}

/**
 * Builds the shadcn token set from an org's theme. Every value is an HSL
 * triplet so `hsl(var(--token))` (and `hsl(var(--token) / a)` opacity
 * modifiers) stay valid — rgba() strings here would produce invalid CSS.
 */
function themeVars(site: NonNullable<PublicSite>) {
  const theme = site.theme;
  const bg = theme?.background ?? DEFAULT_TOKENS.background;
  const fg = theme?.foreground ?? DEFAULT_TOKENS.foreground;
  const primary = theme?.primary ?? DEFAULT_TOKENS.primary;
  const secondary = theme?.secondary ?? DEFAULT_TOKENS.secondary;
  const accent = theme?.accent ?? DEFAULT_TOKENS.accent;
  const radius = theme?.radius ?? DEFAULT_TOKENS.radius;

  const border = blend(bg, fg, 0.12);
  const primaryForeground = isLightColor(primary)
    ? DEFAULT_TOKENS.foreground
    : "#FFFFFF";

  return {
    "--background": hsl(bg),
    "--foreground": hsl(fg),
    "--primary": hsl(primary),
    "--primary-foreground": hsl(primaryForeground),
    "--secondary": hsl(blend(bg, fg, 0.06)),
    "--secondary-foreground": hsl(fg),
    "--accent": hsl(blend(bg, fg, 0.08)),
    "--accent-foreground": hsl(fg),
    "--border": hsl(border),
    "--input": hsl(border),
    "--ring": hsl(primary),
    "--muted": hsl(blend(bg, fg, 0.05)),
    "--muted-foreground": hsl(blend(bg, fg, 0.55)),
    "--card": hsl(bg),
    "--card-foreground": hsl(fg),
    "--popover": hsl(bg),
    "--popover-foreground": hsl(fg),
    "--radius": `${radius}px`,
  } as React.CSSProperties;
}

interface TenantShellProps {
  slug: string;
  requestPath?: string[];
}

export async function TenantShell({
  slug,
  requestPath = [],
}: TenantShellProps) {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";

  const site = await resolveTenantSite(slug, host);
  if (!site) notFound();

  const route = resolveTenantPath(requestPath, site.languages);
  const localizedPage = await convexClient.query(api.pageLocales.resolvePublished, {
    orgId: site.id,
    localeCode: route.localeCode,
    slug: route.pageSlug,
  });
  let page: { data: unknown } | null = localizedPage;
  let cmsEntry:
    | { collectionId: string; values: Record<string, unknown> }
    | undefined;
  if (!page) {
    const [collectionSlug, ...entrySlugParts] = route.pageSlug.split("/");
    if (collectionSlug && entrySlugParts.length > 0) {
      const detail = await convexClient.query(api.cms.resolvePublishedDetail, {
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
        cmsEntry = {
          collectionId: String(detail.collectionId),
          values: detail.values as Record<string, unknown>,
        };
      }
    }
  }
  // Compatibility read for default-locale pages until the idempotent migration
  // has materialized their publication snapshot. Secondary locales never fall back.
  if (!page && route.isDefaultLocale) {
    page = await convexClient.query(api.pages.getPageBySlug, {
      orgId: site.id,
      slug: route.pageSlug,
    });
  }
  if (!page) notFound();

  const defaultLanguage = site.languages.find((l) => l.isDefault) ?? site.languages[0];
  const activeLanguage =
    site.languages.find((language) => language.code === route.localeCode) ??
    defaultLanguage;
  const locale = route.localeCode as QentrahLocale;
  const dir = activeLanguage?.direction ?? (activeLanguage?.rtl ? "rtl" : "ltr");
  const lang = activeLanguage?.code ?? "en";

  const [localizedNavigation, defaultNavigation] = await Promise.all([
    convexClient.query(api.pageLocales.listPublishedForNavigation, {
      orgId: site.id,
      localeCode: route.localeCode,
    }),
    route.localeCode === defaultLanguage?.code
      ? Promise.resolve([])
      : convexClient.query(api.pageLocales.listPublishedForNavigation, {
          orgId: site.id,
          localeCode: defaultLanguage?.code ?? "en",
        }),
  ]);
  const localizedById = new Map(
    localizedNavigation.map((item) => [String(item.pageId), item]),
  );
  const defaultIdBySlug = new Map(
    (route.localeCode === defaultLanguage?.code
      ? localizedNavigation
      : defaultNavigation
    ).map((item) => [item.slug, String(item.pageId)]),
  );

  const hrefForLink = (link: { href: string; pageId?: Id<"pages"> }) => {
    if (/^(?:[a-z]+:|#)/i.test(link.href)) return link.href;
    const legacySlug = link.href.replace(/^\/+|\/+$/g, "") || "home";
    const pageId = link.pageId ? String(link.pageId) : defaultIdBySlug.get(legacySlug);
    const localized = pageId ? localizedById.get(pageId) : undefined;
    return localized
      ? localizedPageHref(localized.slug, route.localePrefix)
      : link.href;
  };

  const settings = site.settings;
  const navigation = settings?.navigation;
  const footer = settings?.footer;

  return (
    <div
      dir={dir}
      lang={lang}
      style={themeVars(site)}
      className="min-h-screen bg-background text-foreground antialiased"
    >
      <SiteHeadCode code={settings?.customCode?.head} />
      <header
        className={`w-full border-b ${navigation?.sticky ? "sticky top-0 z-50 bg-background/80 backdrop-blur" : "bg-background"}`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
          <a
            href={localizedPageHref("home", route.localePrefix)}
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            {settings?.logo?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logo.image}
                alt={pick(settings.logo.altText, locale)}
                className="h-8 w-auto"
              />
            ) : (
              site.name
            )}
          </a>
          {navigation?.mainLinks?.length ? (
            <nav className="hidden items-center gap-8 md:flex">
              {navigation.mainLinks.map((link) => (
                <a
                  key={link.href}
                  href={hrefForLink(link)}
                  className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
                >
                  {pick(link.label, locale)}
                </a>
              ))}
              {navigation.ctaLabel && navigation.ctaHref ? (
                <a
                  href={hrefForLink({ href: navigation.ctaHref })}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {pick(navigation.ctaLabel, locale)}
                </a>
              ) : null}
            </nav>
          ) : null}
        </div>
      </header>

      <PageRenderer
        data={page.data}
        locale={locale}
        direction={dir}
        preferredFont={activeLanguage?.preferredFont ?? site.theme?.font}
        cmsEntry={cmsEntry}
      />

      <footer className="border-t bg-muted/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-3">
          <div className="space-y-3">
            <p className="text-base font-semibold text-foreground">
              {site.name}
            </p>
            {footer?.tagline ? (
              <p className="text-sm text-muted-foreground">
                {pick(footer.tagline, locale)}
              </p>
            ) : null}
          </div>
          {footer?.sections?.map((section) => (
            <div key={pick(section.title, locale)} className="space-y-3">
              <p className="text-sm font-semibold text-foreground">
                {pick(section.title, locale)}
              </p>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={hrefForLink(link)}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {pick(link.label, locale)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {footer?.showSocialLinks && footer.socialLinks?.length ? (
            <div className="flex gap-3">
              {footer.socialLinks.map((social) => (
                <a
                  key={`${social.type}-${social.url}`}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {social.type}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        {footer?.copyrightText ? (
          <div className="border-t py-6 text-center text-xs text-muted-foreground">
            {pick(footer.copyrightText, locale)}
          </div>
        ) : null}
      </footer>
      <SiteFooterCode code={settings?.customCode?.footer} />
    </div>
  );
}
