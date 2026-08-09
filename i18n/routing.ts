import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",

  pathnames: {
    "/": {
      en: "/",
      ar: "/",
    },
    "/admin": {
      en: "/admin",
      ar: "/admin",
    },
    "/dashboard": {
      en: "/dashboard",
      ar: "/dashboard",
    },
    "/dashboard/settings": {
      en: "/dashboard/settings",
      ar: "/dashboard/settings",
    },
    "/dashboard/domains": {
      en: "/dashboard/domains",
      ar: "/dashboard/domains",
    },
    "/dashboard/folders/[folderId]": {
      en: "/dashboard/folders/[folderId]",
      ar: "/dashboard/folders/[folderId]",
    },
    "/dashboard/[org]": {
      en: "/dashboard/[org]",
      ar: "/dashboard/[org]",
    },
    "/dashboard/[org]/pages": {
      en: "/dashboard/[org]/pages",
      ar: "/dashboard/[org]/pages",
    },
    "/dashboard/[org]/pages/[slug]/edit": {
      en: "/dashboard/[org]/pages/[slug]/edit",
      ar: "/dashboard/[org]/pages/[slug]/edit",
    },
    "/dashboard/[org]/pages/[slug]/preview": {
      en: "/dashboard/[org]/pages/[slug]/preview",
      ar: "/dashboard/[org]/pages/[slug]/preview",
    },
    "/dashboard/[org]/settings": {
      en: "/dashboard/[org]/settings",
      ar: "/dashboard/[org]/settings",
    },
    "/dashboard/[org]/redirects": {
      en: "/dashboard/[org]/redirects",
      ar: "/dashboard/[org]/redirects",
    },

    "/dashboard/[org]/properties": {
      en: "/dashboard/[org]/properties",
      ar: "/dashboard/[org]/properties",
    },
    "/dashboard/[org]/posts": {
      en: "/dashboard/[org]/posts",
      ar: "/dashboard/[org]/posts",
    },
    "/dashboard/[org]/contacts": {
      en: "/dashboard/[org]/contacts",
      ar: "/dashboard/[org]/contacts",
    },
    "/dashboard/[org]/interests": {
      en: "/dashboard/[org]/interests",
      ar: "/dashboard/[org]/interests",
    },
    "/dashboard/[org]/inbox": {
      en: "/dashboard/[org]/inbox",
      ar: "/dashboard/[org]/inbox",
    },
    "/dashboard/[org]/services": {
      en: "/dashboard/[org]/services",
      ar: "/dashboard/[org]/services",
    },
    "/dashboard/[org]/site-settings": {
      en: "/dashboard/[org]/site-settings",
      ar: "/dashboard/[org]/site-settings",
    },
    "/dashboard/[org]/site-settings/head-footer": {
      en: "/dashboard/[org]/site-settings/head-footer",
      ar: "/dashboard/[org]/site-settings/head-footer",
    },
    "/dashboard/[org]/site-settings/branding": {
      en: "/dashboard/[org]/site-settings/branding",
      ar: "/dashboard/[org]/site-settings/branding",
    },
    "/dashboard/[org]/site-settings/media": {
      en: "/dashboard/[org]/site-settings/media",
      ar: "/dashboard/[org]/site-settings/media",
    },
    "/dashboard/[org]/site-settings/metadata": {
      en: "/dashboard/[org]/site-settings/metadata",
      ar: "/dashboard/[org]/site-settings/metadata",
    },
    "/dashboard/[org]/site-settings/localization": {
      en: "/dashboard/[org]/site-settings/localization",
      ar: "/dashboard/[org]/site-settings/localization",
    },
    "/dashboard/[org]/collections": {
      en: "/dashboard/[org]/collections",
      ar: "/dashboard/[org]/collections",
    },
    "/login": {
      en: "/login",
      ar: "/login",
    },
    "/register": {
      en: "/register",
      ar: "/register",
    },
    "/onboarding": {
      en: "/onboarding",
      ar: "/onboarding",
    },
    "/projects": {
      en: "/projects",
      ar: "/projects",
    },
    "/about": {
      en: "/about",
      ar: "/about",
    },
    "/contact": {
      en: "/contact",
      ar: "/contact",
    },
    "/p": {
      en: "/p",
      ar: "/p",
    },
    "/services": {
      en: "/services",
      ar: "/services",
    },
    "/blog": {
      en: "/blog",
      ar: "/blog",
    },
    "/docs": {
      en: "/docs",
      ar: "/docs",
    },
    "/admin/projects": {
      en: "/admin/projects",
      ar: "/admin/projects",
    },
    "/admin/forms": {
      en: "/admin/forms",
      ar: "/admin/forms",
    },
    "/admin/blogs": {
      en: "/admin/blogs",
      ar: "/admin/blogs",
    },
    "/admin/media": {
      en: "/admin/media",
      ar: "/admin/media",
    },
    "/404": {
      en: "/404",
      ar: "/404",
    },
    "/terms": {
      en: "/terms",
      ar: "/terms",
    },
    "/pricing": {
      en: "/pricing",
      ar: "/pricing",
    },
    "/privacy": {
      en: "/privacy",
      ar: "/privacy",
    },
    "/refund": {
      en: "/refund",
      ar: "/refund",
    },
    "/reviews": {
      en: "/reviews",
      ar: "/reviews",
    },
  },
});

// ✅ الأنواع (types)
export type Locale = (typeof routing.locales)[number];
export type Pathnames = keyof (typeof routing)["pathnames"];

// ✅ wrappers بتاعت Next-intl Navigation
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
