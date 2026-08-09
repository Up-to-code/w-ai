"use client";

import { useCallback, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, usePathname } from "@/i18n/routing";
import {
  ChevronRight,
  ChevronDown,
  Database,
  ExternalLink,
  FileText,
  Globe2,
  Route,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { tenantUrl } from "@/lib/tenant-host";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/brand-mark";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "@/lib/auth-client";

const DEFAULT_SIDEBAR_WIDTH = 208;
const MIN_SIDEBAR_WIDTH = 176;
const MAX_SIDEBAR_WIDTH = 280;
const COLLAPSED_SIDEBAR_WIDTH = 56;

type NavItem = {
  label: string;
  icon: React.ElementType;
  pathname:
    | "/dashboard/[org]/pages"
    | "/dashboard/[org]/settings"
    | "/dashboard/[org]/redirects"
    | "/dashboard/[org]/site-settings"
    | "/dashboard/[org]/collections";
};

const NAV: NavItem[] = [
  { label: "pages", icon: FileText, pathname: "/dashboard/[org]/pages" },
  { label: "collections", icon: Database, pathname: "/dashboard/[org]/collections" },
  { label: "domains", icon: Globe2, pathname: "/dashboard/[org]/settings" },
  { label: "redirects", icon: Route, pathname: "/dashboard/[org]/redirects" },
];

export function DashboardSidebar({
  orgSlug,
  orgName,
}: {
  orgSlug: string;
  orgName?: string;
}) {
  const t = useTranslations("dashboard.sidebar");
  const pathname = usePathname();
  const { data: session } = useSession();
  const [settingsOpen, setSettingsOpen] = useState(pathname.includes("site-settings"));
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const host = tenantUrl(orgSlug).replace(/^https?:\/\//, "");
  const user = session?.user;
  const userLabel = user?.name || user?.email || "Account";
  const userInitials = userLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (collapsed) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = sidebarWidth;
      const direction = document.documentElement.dir === "rtl" ? -1 : 1;

      const resize = (pointerEvent: PointerEvent) => {
        const nextWidth = startWidth + (pointerEvent.clientX - startX) * direction;
        setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, nextWidth)));
      };
      const finish = () => {
        window.removeEventListener("pointermove", resize);
        window.removeEventListener("pointerup", finish);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", resize);
      window.addEventListener("pointerup", finish, { once: true });
    },
    [collapsed, sidebarWidth],
  );

  return (
    <aside
      className="relative flex h-svh shrink-0 flex-col border-e border-border bg-white transition-[width] duration-200"
      style={{ width: collapsed ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth }}
    >
      <div className={cn("flex h-12 items-center border-b border-border", collapsed ? "justify-center px-2" : "justify-between px-3")}>
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground"
          aria-label="W-AI dashboard"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-[10px] font-bold text-background">
            <BrandMark className="h-4 w-6" />
          </span>
          {!collapsed ? <span>W-AI</span> : null}
        </Link>
        {!collapsed ? (
          <button type="button" onClick={() => setCollapsed(true)} className="grid size-7 place-items-center rounded-md text-black/35 hover:bg-black/[0.04] hover:text-black" aria-label="Collapse sidebar" title="Collapse sidebar">
            <PanelLeftClose className="size-3.5" strokeWidth={1.5} />
          </button>
        ) : null}
      </div>

      {!collapsed ? <div className="space-y-1 px-3 py-3">
        <Link href="/dashboard" className="text-[10px] text-black/40 transition-colors hover:text-black">All projects</Link>
        <p className="truncate text-xs font-semibold">{orgName || orgSlug}</p>
        <p
          className="truncate font-mono text-[9px] text-muted-foreground"
          dir="ltr"
          title={host}
        >
          {host}
        </p>
      </div> : null}

      <nav className="flex-1 overflow-y-auto px-2 py-1" aria-label="Dashboard">
        {!collapsed ? <p className="mb-1.5 px-2 font-mono text-[9px] uppercase tracking-[.15em] text-muted-foreground">
          Site
        </p> : null}
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const href = { pathname: item.pathname, params: { org: orgSlug } };
            const resolved = item.pathname.replace("[org]", orgSlug);
            const active =
              pathname === resolved || pathname.startsWith(`${resolved}/`);
            const Icon = item.icon;

            return (
              <li key={item.pathname}>
                <Link
                  href={href}
                  className={cn(
                    "transition-brand group flex items-center rounded-md py-1.5 text-xs",
                    collapsed ? "justify-center px-2" : "gap-2.5 px-2",
                    active
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                  {!collapsed ? <span className="flex-1 truncate">
                    {item.label === "collections"
                      ? "Collections"
                      : item.label === "redirects"
                        ? "Redirects"
                        : t(item.label as Parameters<typeof t>[0])}
                  </span> : null}
                  {!collapsed && active ? (
                    <span className="size-1 rounded-full bg-foreground" />
                  ) : !collapsed ? (
                    <ChevronRight
                      className="transition-brand size-3.5 opacity-0 group-hover:opacity-40"
                      strokeWidth={1.5}
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-1">
          <button type="button" onClick={() => collapsed ? setCollapsed(false) : setSettingsOpen((open) => !open)} className={cn("flex w-full items-center rounded-md py-1.5 text-xs text-muted-foreground hover:bg-secondary/70 hover:text-foreground", collapsed ? "justify-center px-2" : "gap-2.5 px-2")} title={t("siteSettings")}><SlidersHorizontal className="size-4"/>{!collapsed ? <span className="flex-1 text-start">{t("siteSettings")}</span> : null}{!collapsed ? settingsOpen ? <ChevronDown className="size-3.5"/> : <ChevronRight className="size-3.5"/> : null}</button>
          {settingsOpen && !collapsed ? <div className="ms-6 mt-1 space-y-0.5 border-s border-black/10 ps-2">{[
            ["/dashboard/[org]/site-settings/head-footer", "Head & footer"],
            ["/dashboard/[org]/site-settings/branding", "Branding"],
            ["/dashboard/[org]/site-settings/media", "Media"],
            ["/dashboard/[org]/site-settings/metadata", "Metadata"],
            ["/dashboard/[org]/site-settings/localization", "Localization"],
          ].map(([settingsPath, label]) => {
            const resolved = settingsPath.replace("[org]", orgSlug);
            const active = pathname === resolved;
            return <Link key={settingsPath} href={{ pathname: settingsPath as "/dashboard/[org]/site-settings/head-footer", params: { org: orgSlug } }} className={cn("block rounded-md px-2 py-1.5 text-[11px] transition-colors", active ? "bg-black/[0.05] font-medium text-black" : "text-black/50 hover:bg-black/[0.04] hover:text-black")}>{label}</Link>;
          })}</div> : null}
        </div>
      </nav>

      <div className="space-y-0.5 border-t border-border p-2">
        <a
          href={tenantUrl(orgSlug)}
          target="_blank"
          rel="noreferrer"
          className={cn("transition-brand flex items-center rounded-md py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground", collapsed ? "justify-center px-2" : "gap-2.5 px-2")}
          title={t("viewSite")}
        >
          <ExternalLink className="size-3.5" strokeWidth={1.5} />
          {!collapsed ? t("viewSite") : null}
        </a>
        <div className={cn("flex items-center rounded-md py-1.5", collapsed ? "justify-center px-1" : "gap-2 px-2")} title={userLabel}>
          <Avatar className="size-7 border border-black/10">
            {user?.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback className="bg-black text-[9px] font-semibold text-white">{userInitials || "U"}</AvatarFallback>
          </Avatar>
          {!collapsed ? <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-medium text-black">{userLabel}</p>{user?.email && user.name ? <p className="truncate text-[9px] text-black/40">{user.email}</p> : null}</div> : null}
        </div>
      </div>
      {collapsed ? <button type="button" onClick={() => setCollapsed(false)} className="absolute -end-3 top-3 z-10 grid size-6 place-items-center rounded-full border border-black/10 bg-white text-black/45 hover:text-black" aria-label="Expand sidebar" title="Expand sidebar"><PanelLeftOpen className="size-3" strokeWidth={1.5}/></button> : null}
      {!collapsed ? <button type="button" onPointerDown={startResize} className="absolute inset-y-0 -end-1 z-20 w-2 cursor-col-resize touch-none opacity-0 transition-opacity hover:opacity-100 focus:opacity-100" aria-label="Resize sidebar" title="Drag to resize sidebar"><span className="absolute end-[3px] top-1/2 h-12 w-px -translate-y-1/2 bg-black/20" /></button> : null}
    </aside>
  );
}
