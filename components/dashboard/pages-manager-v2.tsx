"use client";

import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/routing";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
  Edit2,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  GlobeLock,
  Grid2X2,
  List,
  MoreHorizontal,
  Plus,
  Search,
  ArrowUpDown,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { withLogger } from "@/lib/logger";
import { tenantUrl } from "@/lib/tenant-host";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/dashboard/status-badge";

const log = withLogger("pages-manager");

type PageRow = {
  slug: string;
  title: Record<string, string>;
  published: boolean;
  order: number;
  componentCount: number;
  createdAt: number;
  updatedAt: number;
};

type PageTemplate = "blank" | "landing" | "content" | "contact" | "properties";

const TEMPLATES: Array<{ value: PageTemplate; label: string; hint: string }> = [
  { value: "landing", label: "Landing", hint: "Hero + features + CTA" },
  { value: "content", label: "Content", hint: "Heading + text blocks" },
  { value: "contact", label: "Contact", hint: "Contact layout" },
  { value: "properties", label: "Showcase", hint: "Gallery-style layout" },
  { value: "blank", label: "Blank", hint: "Empty canvas" },
];

const PAGE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function PagesManager({
  locale,
  orgId,
  orgSlug,
  orgName,
  initialPages,
  labels,
}: {
  locale: "ar" | "en";
  orgId: Id<"organizations">;
  orgSlug: string;
  orgName: string;
  initialPages: PageRow[];
  labels: Record<string, string>;
}) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const livePages = useQuery(
    api.pages.listPages,
    isAuthenticated ? { orgId } : "skip",
  );
  const pages = livePages ?? initialPages;
  const [open, setOpen] = useState(false);
  const languages = useQuery(api.languages.list, isAuthenticated ? { orgId } : "skip");
  const enabledLanguages = (languages ?? []).filter((language) => language.enabled);
  const defaultLanguage = enabledLanguages.find((language) => language.isDefault) ?? enabledLanguages[0];
  const [localizedNames, setLocalizedNames] = useState<Record<string, string>>({});
  const [pageSlug, setPageSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [template, setTemplate] = useState<PageTemplate>("landing");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortNewest, setSortNewest] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");

  const createPage = useMutation(api.pages.createPage);
  const deletePage = useMutation(api.pages.deletePage);
  const togglePublish = useMutation(api.pages.togglePublish);

  const publishedCount = useMemo(
    () => pages.filter((p) => p.published).length,
    [pages],
  );
  const draftCount = pages.length - publishedCount;
  const visiblePages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...pages]
      .filter((page) => !needle || page.slug.toLowerCase().includes(needle) || Object.values(page.title).some((title) => title.toLowerCase().includes(needle)))
      .sort((a, b) => sortNewest ? b.updatedAt - a.updatedAt : a.slug.localeCompare(b.slug));
  }, [pages, query, sortNewest]);
  const siteUrl = tenantUrl(orgSlug);

  const trimmedPageSlug = pageSlug.trim().toLowerCase();
  const slugValid =
    trimmedPageSlug.length >= 1 &&
    trimmedPageSlug.length <= 80 &&
    PAGE_SLUG_RE.test(trimmedPageSlug);
  const slugError = pageSlug && !slugValid ? labels.slugInvalid : null;

  async function handleCreate() {
    if (!isAuthenticated) return;
    const title = Object.fromEntries(Object.entries(localizedNames).map(([code, value]) => [code, value.trim()]).filter(([, value]) => value));
    if (Object.keys(title).length === 0) return;
    if (!slugValid) {
      toast.error(labels.slugInvalid);
      return;
    }
    setCreating(true);
    try {
      await createPage({
        orgId,
        slug: trimmedPageSlug,
        title,
        template,
      });
      toast.success(labels.created);
      setOpen(false);
      setLocalizedNames({});
      setPageSlug("");
      setSlugTouched(false);
      setTemplate("landing");
    } catch (e: unknown) {
      log.error("Failed to create page", e);
      toast.error(e instanceof Error ? e.message : labels.error);
    } finally {
      setCreating(false);
    }
  }

  async function handleTogglePublish(target: string) {
    if (!isAuthenticated) return;
    try {
      const next = await togglePublish({ orgId, slug: target });
      toast.success(next ? labels.publish : labels.unpublish);
    } catch (e: unknown) {
      log.error("Failed to update publication state", e);
      toast.error(e instanceof Error ? e.message : labels.error);
    }
  }

  async function handleDelete(target: string) {
    if (!isAuthenticated) return;
    try {
      await deletePage({ orgId, slug: target });
      toast.success(labels.delete);
    } catch (e: unknown) {
      log.error("Failed to delete page", e);
      toast.error(e instanceof Error ? e.message : labels.error);
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-white px-5 py-7 text-[#171717] md:px-8 lg:px-12">
      <div className="mx-auto max-w-[1240px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-[-0.025em]">
                {labels.title}
              </h1>
              <span className="rounded bg-[#f1efff] px-1.5 py-0.5 text-[10px] font-medium text-[#6757d7]">
                {pages.length}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              className="h-9 rounded-md border-black/15 bg-white px-3 shadow-none"
            >
              <a href={siteUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="me-1.5 size-3.5" />
                {labels.openSite}
              </a>
            </Button>
            <Button
              type="button"
              onClick={() => setOpen(true)}
              disabled={authLoading || !isAuthenticated}
              className="h-9 rounded-md bg-black px-4 shadow-none hover:bg-black/80"
            >
              <Plus className="me-1.5 size-4" />
              {labels.newPage}
            </Button>
          </div>
        </header>

        <div className="mt-6 flex items-center gap-4 border-b border-black/10 pb-3 text-xs text-black/45">
          <span>
            {labels.pagesStat}{" "}
            <strong className="ms-1 font-semibold text-black">
              {pages.length}
            </strong>
          </span>
          <span>
            {labels.publishedStat}{" "}
            <strong className="ms-1 font-semibold text-black">
              {publishedCount}
            </strong>
          </span>
          <span>
            {labels.draftsStat}{" "}
            <strong className="ms-1 font-semibold text-black">
              {draftCount}
            </strong>
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/35" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages" className="h-10 rounded-lg border-black/15 bg-white pl-9 text-xs shadow-none" /></div>
          <Button type="button" variant="outline" onClick={() => setSortNewest((value) => !value)} className="h-10 rounded-lg border-black/15 px-3 text-xs shadow-none"><ArrowUpDown className="me-1.5 size-3.5" />{sortNewest ? "Updated" : "Name"}</Button>
          <div className="flex rounded-lg border border-black/15 bg-white p-1"><button type="button" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")} className={view === "grid" ? "grid size-8 place-items-center rounded-md bg-black text-white" : "grid size-8 place-items-center rounded-md text-black/40 hover:text-black"}><Grid2X2 className="size-3.5" /></button><button type="button" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")} className={view === "list" ? "grid size-8 place-items-center rounded-md bg-black text-white" : "grid size-8 place-items-center rounded-md text-black/40 hover:text-black"}><List className="size-3.5" /></button></div>
        </div>

        {pages.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-black/15 px-6 py-16 text-center">
            <FileText className="mx-auto mb-3 size-5 text-black/25" />
            <p className="mb-5 text-sm text-black/45">{labels.empty}</p>
            <Button
              type="button"
              onClick={() => setOpen(true)}
              disabled={authLoading || !isAuthenticated}
              className="rounded-md bg-black shadow-none hover:bg-black/80"
            >
              <Plus className="me-1.5 size-4" />
              {labels.newPage}
            </Button>
          </div>
        ) : (
          <div className={view === "grid" ? "mt-5 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(285px,1fr))] xl:grid-cols-3" : "mt-5 grid gap-2"}>
            {visiblePages.map((page) => {
              const titleAr = page.title.ar ?? "";
              const titleEn = page.title.en ?? "";
              const label =
                locale === "en"
                  ? titleEn || titleAr || page.slug
                  : titleAr || titleEn || page.slug;
              const isHome = page.slug === "home";
              const publicUrl = tenantUrl(
                orgSlug,
                page.slug === "home" ? "/" : `/${page.slug}`,
              );

              return (
                <article
                  key={page.slug}
                  className={view === "grid" ? "group overflow-hidden rounded-xl border border-black/10 bg-white transition-colors hover:border-black/25" : "group grid overflow-hidden rounded-lg border border-black/10 bg-white transition-colors hover:border-black/25 md:grid-cols-[180px_1fr]"}
                >
                  <Link href={{ pathname: "/dashboard/[org]/pages/[slug]/edit", params: { org: orgSlug, slug: page.slug } }} className="block border-b border-black/10 bg-[#f3f3f1] p-3">
                    <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-black/[0.06] bg-white">
                      <div className="absolute inset-x-4 top-4 flex items-center gap-2"><span className="size-5 rounded-md bg-black text-white"><FileText className="m-1 size-3" /></span><span className="h-1.5 w-16 rounded-full bg-black/15" /><span className="ms-auto h-1.5 w-8 rounded-full bg-black/10" /></div>
                      <div className="absolute inset-x-4 top-12 flex h-[42%] items-center justify-center rounded-md bg-black/[0.055] px-4 text-center"><span className="truncate text-sm font-semibold text-black/45">{label}</span></div>
                      <div className="absolute inset-x-4 bottom-4 grid h-[18%] grid-cols-3 gap-2"><span className="rounded bg-black/[0.055]"/><span className="rounded bg-black/[0.055]"/><span className="rounded bg-black/[0.055]"/></div>
                    </div>
                  </Link>
                  <div className="flex items-start gap-3 p-4">
                    <Link
                      href={{
                        pathname: "/dashboard/[org]/pages/[slug]/edit",
                        params: { org: orgSlug, slug: page.slug },
                      }}
                      className="min-w-0 flex-1"
                    >
                      <h2 className="truncate text-sm font-semibold">{label}</h2>
                      <p
                        className="mt-1 truncate font-mono text-[11px] text-black/40"
                        dir="ltr"
                      >
                        /{page.slug}
                      </p>
                    </Link>
                    <StatusBadge status={page.published ? "live" : "draft"} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="-me-2 -mt-2 size-8 rounded-md text-black/40 hover:text-black"
                          aria-label={`${label} actions`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-44 rounded-md"
                      >
                        <DropdownMenuItem asChild>
                          <Link
                            href={{
                              pathname: "/dashboard/[org]/pages/[slug]/edit",
                              params: { org: orgSlug, slug: page.slug },
                            }}
                          >
                            <Edit2 className="me-2 size-4" />
                            {labels.edit}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={{
                              pathname: "/dashboard/[org]/pages/[slug]/preview",
                              params: { org: orgSlug, slug: page.slug },
                            }}
                          >
                            <Eye className="me-2 size-4" />
                            {labels.preview}
                          </Link>
                        </DropdownMenuItem>
                        {page.published ? (
                          <DropdownMenuItem asChild>
                            <a
                              href={publicUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="me-2 size-4" />
                              {labels.openSite}
                            </a>
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem
                          onSelect={() => void handleTogglePublish(page.slug)}
                        >
                          {page.published ? (
                            <GlobeLock className="me-2 size-4" />
                          ) : (
                            <Globe className="me-2 size-4" />
                          )}
                          {page.published ? labels.unpublish : labels.publish}
                        </DropdownMenuItem>
                        {!isHome ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onSelect={() => setDeleteTarget(page.slug)}
                            >
                              <Trash2 className="me-2 size-4" />
                              {labels.delete}
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center border-t border-black/[0.07] px-4 py-2.5 text-[11px] text-black/40">
                    <span>
                      {labels.updated}{" "}
                      {formatDistanceToNow(new Date(page.updatedAt), {
                        addSuffix: true,
                      })}
                    </span>
                    <span className="mx-2 text-black/15">•</span>
                    <span>{page.componentCount} blocks</span>
                    <div className="ms-auto flex items-center gap-1">
                      <Link
                        href={{
                          pathname: "/dashboard/[org]/pages/[slug]/edit",
                          params: { org: orgSlug, slug: page.slug },
                        }}
                        className="inline-flex size-7 items-center justify-center rounded-md text-black/40 hover:bg-black/[0.04] hover:text-black"
                        aria-label={labels.edit}
                      >
                        <Edit2 className="size-3.5" />
                      </Link>
                      <Link
                        href={{
                          pathname: "/dashboard/[org]/pages/[slug]/preview",
                          params: { org: orgSlug, slug: page.slug },
                        }}
                        className="inline-flex size-7 items-center justify-center rounded-md text-black/40 hover:bg-black/[0.04] hover:text-black"
                        aria-label={labels.preview}
                      >
                        <Eye className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-black/10 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,.16)]">
          <DialogHeader>
            <DialogTitle>{labels.newPage}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              {(enabledLanguages.length ? enabledLanguages : [{ code: "en", name: "English", rtl: false, isDefault: true }]).map((language) => (
              <div key={language.code} className="space-y-1.5">
                <Label>{language.isDefault ? `Page name · ${language.name}` : language.name}</Label>
                <Input
                  dir={language.rtl ? "rtl" : "ltr"}
                  value={localizedNames[language.code] ?? ""}
                  onChange={(e) => {
                    setLocalizedNames((current) => ({ ...current, [language.code]: e.target.value }));
                    if (!slugTouched && (language.isDefault || language.code === defaultLanguage?.code)) setPageSlug(slugify(e.target.value));
                  }}
                  placeholder="Page name"
                  className="h-11 rounded-xl border-black/10 shadow-none"
                />
              </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pageSlug">{labels.pageAddress}</Label>
              <Input
                id="pageSlug"
                dir="ltr"
                value={pageSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setPageSlug(e.target.value.toLowerCase());
                }}
                placeholder="about"
                className="h-11 rounded-xl border-black/10 font-mono shadow-none"
                aria-invalid={!!slugError}
              />
              {slugError ? (
                <p className="text-xs text-w-red">{slugError}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select
                value={template}
                onValueChange={(v) => setTemplate(v as PageTemplate)}
              >
                <SelectTrigger className="h-11 rounded-xl border-black/10 shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-black/10">
                  {TEMPLATES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TEMPLATES.find((o) => o.value === template)?.hint}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => setOpen(false)}
            >
              {labels.cancel}
            </Button>
            <Button
              className="rounded-lg bg-black text-white shadow-none hover:bg-black/80"
              onClick={handleCreate}
              disabled={
                creating ||
                !isAuthenticated ||
                !slugValid ||
                Object.values(localizedNames).every((value) => !value.trim())
              }
            >
              {creating ? "…" : labels.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{labels.deleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">
              {labels.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-sm bg-w-red text-white hover:bg-w-red/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={!isAuthenticated}
            >
              {labels.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
