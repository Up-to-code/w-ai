"use client";

import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Data } from "@puckeditor/core";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Check,
  Eye,
  Globe2,
  Loader2,
  Magnet,
  Save,
  ScanLine,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

import { buildPuckConfig } from "@/lib/puck/config";
import {
  applyPuckEdit,
  normalizePageDocument,
  relinkLocaleOverrides,
  resolvePageDocument,
  type PageDocumentV2,
  type Viewport,
} from "@/lib/puck/page-document";
import { Puck } from "@/lib/puck/puck-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { EditorErrorBoundary } from "./editor-error-boundary";
import { PuckResizableOverlay } from "./puck-resizable-overlay";

type EditorLabels = {
  back: string;
  save: string;
  preview: string;
  publish: string;
  unpublish: string;
  saved: string;
  saveError: string;
  saving: string;
  notFound: string;
};

export type PuckPageEditorProps = {
  interfaceLocale: string;
  orgId: Id<"organizations">;
  orgSlug: string;
  pageSlug: string;
  initialTitle: Record<string, string>;
  initialPublished: boolean;
  initialUpdatedAt: number;
  initialData: unknown;
  labels: EditorLabels;
};

const viewports = [
  {
    label: "Desktop",
    width: 1280,
    height: "auto" as const,
    icon: "Monitor" as const,
  },
  {
    label: "Tablet",
    width: 768,
    height: "auto" as const,
    icon: "Tablet" as const,
  },
  {
    label: "Mobile",
    width: 390,
    height: "auto" as const,
    icon: "Smartphone" as const,
  },
];

function viewportFromWidth(width: number | "100%"): Viewport {
  if (width === "100%" || width >= 1000) return "desktop";
  return width >= 600 ? "tablet" : "mobile";
}

export function PuckPageEditor(props: PuckPageEditorProps) {
  const languages = useQuery(api.languages.list, { orgId: props.orgId });
  const collections = useQuery(api.cms.listCollections, { orgId: props.orgId });
  const pageLocales = useQuery(api.pageLocales.listForPage, {
    orgId: props.orgId,
    pageSlug: props.pageSlug,
  });
  const enableLocale = useMutation(api.pageLocales.enable);
  const saveDocument = useMutation(api.pageLocales.saveDocument);
  const updateLocaleDetails = useMutation(api.pageLocales.updateDetails);
  const publishLocale = useMutation(api.pageLocales.publish);
  const unpublishLocale = useMutation(api.pageLocales.unpublish);

  const initialDocument = useMemo(
    () => normalizePageDocument(props.initialData),
    [props.initialData],
  );
  const [document, setDocument] = useState<PageDocumentV2>(initialDocument);
  const [selectedLocale, setSelectedLocale] = useState("en");
  const [activeViewport, setActiveViewport] = useState<Viewport>("desktop");
  const [updatedAt, setUpdatedAt] = useState(props.initialUpdatedAt);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [localeDetails, setLocaleDetails] = useState({
    slug: props.pageSlug,
    title: props.initialTitle.en ?? props.pageSlug,
    seoTitle: "",
    seoDescription: "",
    ogImage: "",
  });

  const defaultLocale = pageLocales?.defaultLocale ?? "en";
  const language =
    languages?.find((item) => item.code === selectedLocale) ??
    languages?.find((item) => item.code === defaultLocale);
  const localeRecord = pageLocales?.locales.find(
    (item) => item.localeCode === selectedLocale,
  );
  const direction = language?.direction ?? (language?.rtl ? "rtl" : "ltr");
  const config = useMemo(
    () =>
      buildPuckConfig(
        selectedLocale,
        {
          direction,
          preferredFont: language?.preferredFont,
        },
        {
          collections: (collections ?? []).map((collection) => ({
            id: collection._id,
            name: collection.name,
            fields: collection.fields.map((field) => ({
              id: field.id,
              key: field.key,
              label: field.label,
            })),
          })),
        },
      ),
    [collections, direction, language?.preferredFont, selectedLocale],
  );
  const renderData = useMemo(
    () => resolvePageDocument(document, selectedLocale, activeViewport),
    [activeViewport, document, selectedLocale],
  );
  const puckOverrides = useMemo(
    () => ({
      componentOverlay: (overlayProps: {
        children: React.ReactNode;
        componentId: string;
        componentType: string;
        hover: boolean;
        isSelected: boolean;
      }) => (
        <PuckResizableOverlay {...overlayProps} snapEnabled={snapEnabled} />
      ),
    }),
    [snapEnabled],
  );

  async function ensureLocale() {
    if (localeRecord) return;
    await enableLocale({
      orgId: props.orgId,
      pageSlug: props.pageSlug,
      localeCode: selectedLocale,
      title:
        props.initialTitle[selectedLocale] ??
        props.initialTitle.en ??
        props.pageSlug,
    });
  }

  async function save() {
    setSaving(true);
    try {
      await ensureLocale();
      const result = await saveDocument({
        orgId: props.orgId,
        pageSlug: props.pageSlug,
        localeCode: selectedLocale,
        data: document,
        expectedUpdatedAt: updatedAt,
      });
      setUpdatedAt(result.updatedAt);
      toast.success(props.labels.saved);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : props.labels.saveError,
      );
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      if (localeRecord?.status === "published") {
        await unpublishLocale({
          orgId: props.orgId,
          pageSlug: props.pageSlug,
          localeCode: selectedLocale,
        });
        toast.success(`${language?.nativeName ?? selectedLocale} unpublished`);
      } else {
        await ensureLocale();
        const saved = await saveDocument({
          orgId: props.orgId,
          pageSlug: props.pageSlug,
          localeCode: selectedLocale,
          data: document,
          expectedUpdatedAt: updatedAt,
        });
        setUpdatedAt(saved.updatedAt);
        await publishLocale({
          orgId: props.orgId,
          pageSlug: props.pageSlug,
          localeCode: selectedLocale,
        });
        toast.success(`${language?.nativeName ?? selectedLocale} published`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : props.labels.saveError,
      );
    } finally {
      setPublishing(false);
    }
  }

  function onChange(data: Data) {
    setDocument((current) =>
      applyPuckEdit(current, data, {
        locale: selectedLocale,
        defaultLocale,
        viewport: activeViewport,
      }),
    );
  }

  const status = localeRecord?.status ?? "not enabled";
  const previewHref = `/${props.interfaceLocale}/dashboard/${props.orgSlug}/pages/${props.pageSlug}/preview?locale=${selectedLocale}`;

  return (
    <TooltipProvider>
      <div className="flex h-dvh min-h-0 flex-col bg-w-canvas" dir="ltr">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-3">
          <div className="flex min-w-0 items-center gap-3">
            <a
              href={`/${props.interfaceLocale}/dashboard/${props.orgSlug}/pages`}
              className="grid size-8 place-items-center hover:bg-muted"
              aria-label={props.labels.back}
            >
              <ArrowLeft className="size-4" />
            </a>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {props.initialTitle[selectedLocale] ??
                  props.initialTitle.en ??
                  props.pageSlug}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                /{props.pageSlug}
                <span>·</span>
                <span className="capitalize">
                  {status.replaceAll("_", " ")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-pressed={snapEnabled}
                  onClick={() => setSnapEnabled((current) => !current)}
                  className={`grid size-9 place-items-center border border-border ${
                    snapEnabled ? "bg-foreground text-background" : "bg-card"
                  }`}
                  aria-label="Toggle resize snapping"
                >
                  <ScanLine className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Snap resizing to the parent and sibling sizes. Hold Alt for free
                resizing.
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Select
                    value={selectedLocale}
                    onValueChange={setSelectedLocale}
                  >
                    <SelectTrigger className="h-9 w-[170px] bg-card">
                      <Globe2 className="me-2 size-3.5" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(languages ?? [])
                        .filter((item) => item.enabled)
                        .map((item) => {
                          const enabled = pageLocales?.locales.some(
                            (row) => row.localeCode === item.code,
                          );
                          return (
                            <SelectItem key={item.code} value={item.code}>
                              <span className="flex items-center gap-2">
                                {item.nativeName ?? item.name}
                                {enabled ? (
                                  <Check className="size-3 text-w-green" />
                                ) : null}
                              </span>
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Interface language and canvas language are independent.
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={!localeRecord}
                  onClick={() => {
                    setLocaleDetails({
                      slug: localeRecord?.slug ?? props.pageSlug,
                      title:
                        localeRecord?.title ??
                        props.initialTitle[selectedLocale] ??
                        props.initialTitle.en ??
                        props.pageSlug,
                      seoTitle: localeRecord?.seo?.title ?? "",
                      seoDescription: localeRecord?.seo?.description ?? "",
                      ogImage: localeRecord?.seo?.ogImage ?? "",
                    });
                    setDetailsOpen(true);
                  }}
                  className="grid size-9 place-items-center border border-border bg-card disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Localized page settings"
                >
                  <Settings2 className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Localized title, address, and SEO</TooltipContent>
            </Tooltip>

            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={selectedLocale === defaultLocale}
                      className="grid size-9 place-items-center border border-border bg-card disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Relink ${language?.nativeName ?? selectedLocale} properties`}
                    >
                      <Magnet className="size-3.5" />
                    </button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  Translated edits detach automatically. Relink this locale to
                  inherit global properties again.
                </TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Relink this language?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the detached{" "}
                    {language?.nativeName ?? selectedLocale} values and restores
                    inheritance from the global page. Other languages are not
                    changed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setDocument((current) =>
                        relinkLocaleOverrides(current, selectedLocale),
                      );
                      toast.success(
                        `${language?.nativeName ?? selectedLocale} relinked`,
                      );
                    }}
                  >
                    Relink language
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <a
              href={previewHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
            >
              <Eye className="size-3.5" /> {props.labels.preview}
            </a>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-9 items-center gap-2 border border-border bg-card px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              {saving ? props.labels.saving : props.labels.save}
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={publishing}
              className="inline-flex h-9 items-center gap-2 bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50"
            >
              {publishing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Globe2 className="size-3.5" />
              )}
              {localeRecord?.status === "published"
                ? props.labels.unpublish
                : props.labels.publish}
            </button>
          </div>
        </header>

        <div
          className="min-h-0 flex-1"
          dir={direction}
          lang={selectedLocale}
          style={{ fontFamily: language?.preferredFont || "system-ui" }}
        >
          <EditorErrorBoundary
            documentKey={`${props.pageSlug}:${selectedLocale}:${updatedAt}`}
          >
            <Puck
              key={`${selectedLocale}:${activeViewport}`}
              config={config}
              data={renderData}
              onChange={onChange}
              onPublish={() => void publish()}
              headerTitle="W-AI"
              headerPath={`/${props.pageSlug} · ${language?.nativeName ?? selectedLocale}`}
              viewports={viewports}
              dnd={{ behavior: "fluid" }}
              overrides={puckOverrides}
              onAction={(_action, state) => {
                const width = state.ui.viewports.current.width;
                setActiveViewport(viewportFromWidth(width));
              }}
              height="100%"
            />
          </EditorErrorBoundary>
        </div>

        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {language?.nativeName ?? selectedLocale} page settings
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <label className="block space-y-1.5 text-xs font-medium">
                <span>Page title</span>
                <Input
                  value={localeDetails.title}
                  onChange={(event) =>
                    setLocaleDetails((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="block space-y-1.5 text-xs font-medium">
                <span>Localized address</span>
                <Input
                  value={localeDetails.slug}
                  onChange={(event) =>
                    setLocaleDetails((current) => ({
                      ...current,
                      slug: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="block space-y-1.5 text-xs font-medium">
                <span>SEO title</span>
                <Input
                  value={localeDetails.seoTitle}
                  onChange={(event) =>
                    setLocaleDetails((current) => ({
                      ...current,
                      seoTitle: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="block space-y-1.5 text-xs font-medium">
                <span>SEO description</span>
                <Textarea
                  value={localeDetails.seoDescription}
                  onChange={(event) =>
                    setLocaleDetails((current) => ({
                      ...current,
                      seoDescription: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="block space-y-1.5 text-xs font-medium">
                <span>Open Graph image URL</span>
                <Input
                  value={localeDetails.ogImage}
                  onChange={(event) =>
                    setLocaleDetails((current) => ({
                      ...current,
                      ogImage: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <DialogFooter>
              <button
                type="button"
                className="h-9 px-3 text-xs"
                onClick={() => setDetailsOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-9 bg-foreground px-4 text-xs font-medium text-background"
                onClick={async () => {
                  try {
                    await updateLocaleDetails({
                      orgId: props.orgId,
                      pageSlug: props.pageSlug,
                      localeCode: selectedLocale,
                      localizedSlug: localeDetails.slug,
                      title: localeDetails.title,
                      seo: {
                        title: localeDetails.seoTitle || undefined,
                        description: localeDetails.seoDescription || undefined,
                        ogImage: localeDetails.ogImage || undefined,
                      },
                    });
                    setDetailsOpen(false);
                    toast.success("Localized page settings saved");
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Could not save settings",
                    );
                  }
                }}
              >
                Save settings
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
