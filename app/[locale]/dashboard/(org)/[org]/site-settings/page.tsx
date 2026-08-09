"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Check, FileImage, FileVideo2, Globe2, Plus, Trash2, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { FormSkeleton } from "@/components/dashboard/loading-state";
import { useOrg } from "@/components/dashboard/org-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QentrahColorPicker } from "@/components/qentrah/color-picker-field";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type NavLink = { label: { ar: string; en: string }; href: string };

export type SiteSettingsSection = "head-footer" | "branding" | "media" | "meta" | "localization";

export function SiteSettingsPage({
  section,
}: {
  section?: SiteSettingsSection;
} = {}) {
  const t = useTranslations("dashboard.siteSettings");
  const { orgId, orgName, orgSlug } = useOrg();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const data = useQuery(api.settings.get, isAuthenticated ? { orgId } : "skip");
  const languages = useQuery(api.languages.list, isAuthenticated ? { orgId } : "skip");
  const assets = useQuery(api.assets.list, isAuthenticated && section === "media" ? { orgId } : "skip");

  const updateNav = useMutation(api.settings.updateNavigation);
  const updateMeta = useMutation(api.settings.updateMeta);
  const updateLogo = useMutation(api.settings.updateLogo);
  const updateTheme = useMutation(api.settings.updateTheme);
  const updateCustomCode = useMutation(api.settings.updateCustomCode);
  const generateUploadUrl = useMutation(api.assets.generateUploadUrl);
  const saveAsset = useMutation(api.assets.save);
  const addLanguage = useMutation(api.languages.add);
  const removeLanguage = useMutation(api.languages.remove);
  const setDefaultLanguage = useMutation(api.languages.setDefault);

  const [mainLinks, setMainLinks] = useState<NavLink[]>([]);
  const [sticky, setSticky] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [ctaLabelAr, setCtaLabelAr] = useState("");
  const [ctaLabelEn, setCtaLabelEn] = useState("");
  const [ctaHref, setCtaHref] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [descAr, setDescAr] = useState("");
  const [descEn, setDescEn] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoAlt, setLogoAlt] = useState("");
  const [primary, setPrimary] = useState("#111111");
  const [secondary, setSecondary] = useState("#F2F2F2");
  const [accent, setAccent] = useState("#2563EB");
  const [background, setBackground] = useState("#FFFFFF");
  const [foreground, setForeground] = useState("#111111");
  const [brandFont, setBrandFont] = useState("system");
  const [brandMode, setBrandMode] = useState<"light" | "dark" | "system">("light");
  const [radius, setRadius] = useState(8);
  const [headCode, setHeadCode] = useState("");
  const [footerCode, setFooterCode] = useState("");
  const [keywordsAr, setKeywordsAr] = useState("");
  const [keywordsEn, setKeywordsEn] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [languageName, setLanguageName] = useState("");
  const [languageCode, setLanguageCode] = useState("");
  const [languageRtl, setLanguageRtl] = useState(false);
  const [activeTab, setActiveTab] = useState<SiteSettingsSection>(section ?? "head-footer");
  const selectTab = (next: string) => {
    if (!["head-footer", "branding", "media", "meta", "localization"].includes(next)) return;
    setActiveTab(next as SiteSettingsSection);
    window.history.replaceState(null, "", `#${next}`);
  };

  useEffect(() => {
    if (section) {
      setActiveTab(section);
      return;
    }
    const selectFromHash = () => {
      const next = window.location.hash.slice(1);
      if (["head-footer", "branding", "media", "meta", "localization"].includes(next)) {
        setActiveTab(next as SiteSettingsSection);
      }
    };
    selectFromHash();
    window.addEventListener("hashchange", selectFromHash);
    return () => window.removeEventListener("hashchange", selectFromHash);
  }, [section]);

  async function createLanguage() {
    if (!languageName.trim() || !languageCode.trim()) return;
    try {
      await addLanguage({ orgId, name: languageName.trim(), code: languageCode.trim().toLowerCase(), rtl: languageRtl, enabled: true });
      setLanguageName(""); setLanguageCode(""); setLanguageRtl(false);
      toast.success("Language added");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add language"); }
  }

  useEffect(() => {
    if (!data?.settings) return;
    const s = data.settings;
    setMainLinks(
      s.navigation.mainLinks.map((l) => ({
        label: { ar: l.label["ar"] ?? "", en: l.label["en"] ?? "" },
        href: l.href,
      })),
    );
    setSticky(s.navigation.sticky);
    setShowLogo(s.navigation.showLogo);
    setCtaLabelAr(s.navigation.ctaLabel?.["ar"] ?? "");
    setCtaLabelEn(s.navigation.ctaLabel?.["en"] ?? "");
    setCtaHref(s.navigation.ctaHref ?? "");
    setTitleAr(s.meta.title?.["ar"] ?? "");
    setTitleEn(s.meta.title?.["en"] ?? "");
    setDescAr(s.meta.description?.["ar"] ?? "");
    setDescEn(s.meta.description?.["en"] ?? "");
    setLogoUrl(s.logo.image ?? "");
    setLogoAlt(s.logo.altText?.["en"] ?? "");
    setHeadCode(s.customCode?.head ?? "");
    setFooterCode(s.customCode?.footer ?? "");
    setKeywordsAr(s.meta.keywords?.["ar"] ?? "");
    setKeywordsEn(s.meta.keywords?.["en"] ?? "");
    setOgImage(s.meta.ogImage ?? "");
    if (data.theme) {
      setPrimary(data.theme.primary);
      setSecondary(data.theme.secondary ?? "#F2F2F2");
      setAccent(data.theme.accent ?? "#2563EB");
      setBackground(data.theme.background ?? "#FFFFFF");
      setForeground(data.theme.foreground ?? "#111111");
      setBrandFont(data.theme.font ?? "system");
      setBrandMode(data.theme.mode);
      setRadius(data.theme.radius ?? 8);
    }
  }, [data]);

  async function saveNav() {
    if (!orgId) return;
    setSaving(true);
    try {
      await updateNav({
        orgId,
        mainLinks: mainLinks.map((l) => ({ label: l.label, href: l.href })),
        sticky,
        showLogo,
        ctaLabel:
          ctaLabelAr || ctaLabelEn
            ? { ar: ctaLabelAr, en: ctaLabelEn }
            : undefined,
        ctaHref: ctaHref || undefined,
      });
      toast.success(t("saved"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function saveMeta() {
    if (!orgId) return;
    setSaving(true);
    try {
      await updateMeta({
        orgId,
        title: titleAr || titleEn ? { ar: titleAr, en: titleEn } : undefined,
        description:
          descAr || descEn ? { ar: descAr, en: descEn } : undefined,
        keywords: keywordsAr || keywordsEn ? { ar: keywordsAr, en: keywordsEn } : undefined,
        ogImage: ogImage || undefined,
      });
      toast.success(t("saved"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function saveCustomCode() {
    setSaving(true);
    try {
      await updateCustomCode({ orgId, head: headCode || undefined, footer: footerCode || undefined });
      toast.success("Head and footer code saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save custom code");
    } finally {
      setSaving(false);
    }
  }

  async function uploadMedia(file: File) {
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({ orgId });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed");
      const { storageId } = (await response.json()) as { storageId: string };
      await saveAsset({ orgId, storageId, name: file.name, type: file.type, size: file.size });
      toast.success("Media uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload media");
    } finally {
      setUploading(false);
    }
  }

  async function saveLogo() {
    if (!orgId) return;
    setSaving(true);
    try {
      await Promise.all([
        updateLogo({ orgId, image: logoUrl || undefined, altText: logoAlt ? { en: logoAlt } : undefined }),
        updateTheme({ orgId, primary, secondary, accent, background, foreground, font: brandFont, mode: brandMode, radius }),
      ]);
      toast.success(t("saved"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || data === undefined) {
    return <FormSkeleton rows={6} />;
  }

  const sectionCopy: Record<SiteSettingsSection, { title: string; description: string }> = {
    "head-footer": { title: "Head & footer code", description: "Add verified scripts, structured data, analytics, and footer integrations." },
    branding: { title: "Brand", description: "Control the identity, color palette, typography, and visual behavior of this site." },
    media: { title: "Media library", description: "Upload and reuse images, videos, and documents across the site." },
    meta: { title: "SEO & metadata", description: "Shape search results, social previews, and page discovery." },
    localization: { title: "Localization", description: "Choose the default language and add localized versions when you need them." },
  };
  const currentCopy = sectionCopy[activeTab];

  return (
    <main className="flex-1 overflow-y-auto">
      <PageHeader title={currentCopy.title} />

      <div className="p-6 md:p-8">
        <nav className="mb-7 flex max-w-4xl flex-wrap gap-1 border-b border-border" aria-label="Site settings sections">
          {([
            ["branding", "Brand"],
            ["meta", "SEO"],
            ["media", "Media"],
            ["head-footer", "Code"],
            ["localization", "Localization"],
          ] as const).map(([key, label]) => {
            const path = key === "meta" ? "metadata" : key;
            return <Link key={key} href={{ pathname: (`/dashboard/[org]/site-settings/${path}`) as "/dashboard/[org]/site-settings/branding", params: { org: orgSlug } }} className={cn("border-b-2 px-3 py-2.5 text-xs transition-colors", activeTab === key ? "border-black font-medium text-black" : "border-transparent text-black/45 hover:text-black")}>{label}</Link>;
          })}
        </nav>
        <Tabs value={activeTab} onValueChange={selectTab} className="max-w-4xl">
          {!section ? <TabsList className="mb-6 h-10 rounded-xl bg-black/[0.045] p-1">
            <TabsTrigger value="head-footer" className="rounded-lg text-xs">
              Head & footer
            </TabsTrigger>
            <TabsTrigger value="branding" className="rounded-lg text-xs">
              Branding
            </TabsTrigger>
            <TabsTrigger value="media" className="rounded-lg text-xs">Media</TabsTrigger>
            <TabsTrigger value="meta" className="rounded-lg text-xs">
              {t("meta")}
            </TabsTrigger>
            <TabsTrigger value="localization" className="rounded-lg text-xs">Localization</TabsTrigger>
          </TabsList> : null}

          <TabsContent value="head-footer" className="space-y-5">
            <section className="border border-border bg-card p-5">
              <p className="label-meta">HEAD CODE</p>
              <p className="mb-4 mt-1 text-xs text-muted-foreground">Analytics, verification, structured data, and scripts inserted before the closing head tag.</p>
              <Textarea value={headCode} onChange={(event) => setHeadCode(event.target.value)} placeholder={'<meta name="..." content="..." />'} className="min-h-52 rounded-sm font-mono text-xs" spellCheck={false} />
            </section>
            <section className="border border-border bg-card p-5">
              <p className="label-meta">FOOTER CODE</p>
              <p className="mb-4 mt-1 text-xs text-muted-foreground">Scripts and widgets inserted immediately before the closing body tag.</p>
              <Textarea value={footerCode} onChange={(event) => setFooterCode(event.target.value)} placeholder="<script>...</script>" className="min-h-52 rounded-sm font-mono text-xs" spellCheck={false} />
            </section>
            <button type="button" onClick={saveCustomCode} disabled={saving} className="inline-flex h-9 items-center rounded-sm bg-foreground px-4 text-xs font-medium text-background disabled:opacity-50">{saving ? "…" : "Save code"}</button>
          </TabsContent>

          <TabsContent value="branding" className="space-y-4">
            <section className="grid gap-5 border border-border bg-card p-5 md:grid-cols-[160px_1fr]">
              <div><p className="text-sm font-medium">Identity</p><p className="mt-1 text-xs text-muted-foreground">Logo and accessible brand name.</p></div>
              <div className="space-y-4"><div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Logo URL</Label><Input dir="ltr" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="rounded-sm font-mono text-xs" /></div><div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Logo alt text</Label><Input value={logoAlt} onChange={(event) => setLogoAlt(event.target.value)} placeholder={orgName} className="rounded-sm" /></div>{logoUrl ? <img src={logoUrl} alt={logoAlt || "Logo preview"} className="h-14 w-auto border border-border object-contain p-2" /> : null}</div>
            </section>
            <section className="grid gap-5 border border-border bg-card p-5 md:grid-cols-[160px_1fr]">
              <div><p className="text-sm font-medium">Color system</p><p className="mt-1 text-xs text-muted-foreground">Semantic tokens used by every published component.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">{([
                ["Primary", primary, setPrimary], ["Secondary", secondary, setSecondary], ["Accent", accent, setAccent], ["Background", background, setBackground], ["Text", foreground, setForeground],
              ] as const).map(([label, value, setter]) => <div key={label} className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label><QentrahColorPicker label={`${label} color`} value={value} onChange={setter} /></div>)}</div>
            </section>
            <section className="grid gap-5 border border-border bg-card p-5 md:grid-cols-[160px_1fr]">
              <div><p className="text-sm font-medium">Typography & shape</p><p className="mt-1 text-xs text-muted-foreground">Set the site-wide voice and geometry.</p></div>
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Font family</Label><Select value={brandFont} onValueChange={setBrandFont}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="system">System / San Francisco</SelectItem><SelectItem value="Inter">Inter</SelectItem><SelectItem value="Manrope">Manrope</SelectItem><SelectItem value="IBM Plex Sans">IBM Plex Sans</SelectItem><SelectItem value="Cairo">Cairo</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Appearance</Label><Select value={brandMode} onValueChange={(value) => setBrandMode(value as typeof brandMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="system">Follow device</SelectItem></SelectContent></Select></div><div className="space-y-1.5 sm:col-span-2"><div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Corner radius</Label><span className="font-mono text-xs text-muted-foreground">{radius}px</span></div><input type="range" min="0" max="32" value={radius} onChange={(event) => setRadius(Number(event.target.value))} className="w-full accent-black" /></div></div>
            </section>
            <div className="sticky bottom-0 flex justify-end border-t border-border bg-white/90 py-3 backdrop-blur"><button type="button" onClick={saveLogo} disabled={saving} className="inline-flex h-9 items-center rounded-sm bg-foreground px-4 text-xs font-medium text-background disabled:opacity-50">{saving ? "Saving…" : "Save brand"}</button></div>
          </TabsContent>

          <TabsContent value="media" className="space-y-5">
            <label className="flex cursor-pointer items-center justify-between border border-dashed border-black/20 bg-white p-5 transition-colors hover:border-black/40 hover:bg-black/[0.015]">
              <span><span className="block text-sm font-medium">Upload media</span><span className="mt-1 block text-xs text-muted-foreground">Images, MP4, WebM, or PDF up to 20 MB.</span></span>
              <span className="inline-flex h-9 items-center gap-2 rounded-sm bg-black px-3 text-xs text-white"><UploadCloud className="size-4" />{uploading ? "Uploading…" : "Choose file"}</span>
              <input type="file" accept="image/*,video/mp4,video/webm,application/pdf" className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file); event.currentTarget.value = ""; }} />
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(assets ?? []).map((asset) => <article key={asset._id} className="overflow-hidden border border-border bg-white">
                <div className="grid aspect-video place-items-center bg-black/[0.035]">
                  {asset.type.startsWith("image/") ? <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" /> : asset.type.startsWith("video/") ? <video src={asset.url} className="h-full w-full object-cover" controls /> : <FileImage className="size-7 text-black/30" />}
                </div>
                <div className="flex items-center gap-2 p-3">{asset.type.startsWith("video/") ? <FileVideo2 className="size-3.5" /> : <FileImage className="size-3.5" />}<span className="min-w-0 flex-1 truncate text-xs">{asset.name}</span><span className="text-[10px] text-muted-foreground">{(asset.size / 1024 / 1024).toFixed(1)} MB</span></div>
              </article>)}
            </div>
          </TabsContent>

          <TabsContent value="navigation" className="hidden space-y-6">
            <section className="border border-border bg-card p-5">
              <p className="label-meta mb-4">{t("mainLinks")}</p>
              <div className="space-y-3">
                {mainLinks.map((link, i) => (
                  <div
                    key={i}
                    className="grid gap-2 border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        {t("labelAr")}
                      </Label>
                      <Input
                        dir="rtl"
                        value={link.label.ar}
                        className="rounded-sm"
                        onChange={(e) =>
                          setMainLinks((ls) =>
                            ls.map((l, j) =>
                              j === i
                                ? {
                                    ...l,
                                    label: { ...l.label, ar: e.target.value },
                                  }
                                : l,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        {t("labelEn")}
                      </Label>
                      <Input
                        value={link.label.en}
                        className="rounded-sm"
                        onChange={(e) =>
                          setMainLinks((ls) =>
                            ls.map((l, j) =>
                              j === i
                                ? {
                                    ...l,
                                    label: { ...l.label, en: e.target.value },
                                  }
                                : l,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        {t("href")}
                      </Label>
                      <Input
                        dir="ltr"
                        value={link.href}
                        className="rounded-sm font-mono text-xs"
                        onChange={(e) =>
                          setMainLinks((ls) =>
                            ls.map((l, j) =>
                              j === i ? { ...l, href: e.target.value } : l,
                            ),
                          )
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="mt-auto inline-flex size-9 items-center justify-center rounded-sm text-w-red transition-brand hover:bg-w-red-soft"
                      onClick={() =>
                        setMainLinks((ls) => ls.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setMainLinks((ls) => [
                      ...ls,
                      { label: { ar: "", en: "" }, href: "/" },
                    ])
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border px-3 text-xs transition-brand hover:bg-w-canvas"
                >
                  <Plus className="size-3.5" strokeWidth={1.5} />
                  {t("addLink")}
                </button>
              </div>
            </section>

            <section className="space-y-3 border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <Switch checked={sticky} onCheckedChange={setSticky} id="sticky" />
                <Label htmlFor="sticky" className="text-sm">
                  {t("sticky")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={showLogo}
                  onCheckedChange={setShowLogo}
                  id="showLogo"
                />
                <Label htmlFor="showLogo" className="text-sm">
                  {t("showLogo")}
                </Label>
              </div>
            </section>

            <section className="border border-border bg-card p-5">
              <p className="label-meta mb-4">CTA</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    {t("labelAr")}
                  </Label>
                  <Input
                    dir="rtl"
                    value={ctaLabelAr}
                    onChange={(e) => setCtaLabelAr(e.target.value)}
                    className="rounded-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    {t("labelEn")}
                  </Label>
                  <Input
                    value={ctaLabelEn}
                    onChange={(e) => setCtaLabelEn(e.target.value)}
                    className="rounded-sm"
                  />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  {t("href")}
                </Label>
                <Input
                  dir="ltr"
                  value={ctaHref}
                  onChange={(e) => setCtaHref(e.target.value)}
                  placeholder="/contact"
                  className="rounded-sm font-mono text-xs"
                />
              </div>
            </section>

            <button
              type="button"
              onClick={saveNav}
              disabled={saving}
              className="inline-flex h-9 items-center rounded-sm bg-foreground px-4 text-xs font-medium text-background transition-brand hover:bg-w-carbon disabled:opacity-50"
            >
              {saving ? "…" : t("save")}
            </button>
          </TabsContent>

          <TabsContent value="logo" className="hidden space-y-4">
            <section className="border border-border bg-card p-5">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("logoUrl")}
                </Label>
                <Input
                  dir="ltr"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="rounded-sm font-mono text-xs"
                />
              </div>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="mt-4 h-12 w-auto border border-border object-contain p-2"
                />
              ) : null}
            </section>
            <button
              type="button"
              onClick={saveLogo}
              disabled={saving}
              className="inline-flex h-9 items-center rounded-sm bg-foreground px-4 text-xs font-medium text-background transition-brand hover:bg-w-carbon disabled:opacity-50"
            >
              {saving ? "…" : t("save")}
            </button>
          </TabsContent>

          <TabsContent value="meta" className="space-y-4">
            <Tabs defaultValue="seo" className="space-y-5">
              <TabsList className="h-9 rounded-lg bg-black/[0.045] p-1"><TabsTrigger value="seo" className="rounded-md text-xs">SEO</TabsTrigger><TabsTrigger value="social" className="rounded-md text-xs">Social image</TabsTrigger><TabsTrigger value="preview" className="rounded-md text-xs">Preview</TabsTrigger></TabsList>
              <TabsContent value="seo"><section className="space-y-3 border border-border bg-card p-5">
              {(
                [
                  { label: t("titleMetaAr"), value: titleAr, set: setTitleAr, dir: "rtl" as const },
                  { label: t("titleMetaEn"), value: titleEn, set: setTitleEn, dir: "ltr" as const },
                  { label: t("descMetaAr"), value: descAr, set: setDescAr, dir: "rtl" as const },
                  { label: t("descMetaEn"), value: descEn, set: setDescEn, dir: "ltr" as const },
                  { label: "Keywords (Arabic)", value: keywordsAr, set: setKeywordsAr, dir: "rtl" as const },
                  { label: "Keywords (English)", value: keywordsEn, set: setKeywordsEn, dir: "ltr" as const },
                ]
              ).map((field) => (
                <div key={field.label} className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    {field.label}
                  </Label>
                  <Input
                    dir={field.dir}
                    value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                    className="rounded-sm"
                  />
                </div>
              ))}
              </section></TabsContent>
              <TabsContent value="social"><section className="space-y-3 border border-border bg-card p-5"><Label className="text-xs text-muted-foreground">Open Graph image URL</Label><Input value={ogImage} onChange={(event) => setOgImage(event.target.value)} placeholder="https://..." className="rounded-sm font-mono text-xs" />{ogImage ? <img src={ogImage} alt="Social preview" className="aspect-[1.91/1] w-full border border-border object-cover" /> : null}</section></TabsContent>
              <TabsContent value="preview"><section className="border border-border bg-white p-5"><div className="mx-auto max-w-lg rounded-lg border border-black/10 bg-white p-4"><p className="text-xs text-emerald-700">w-ai.online</p><p className="mt-1 text-lg text-blue-700">{titleEn || "Your page title"}</p><p className="mt-1 text-sm text-black/60">{descEn || "Your page description appears here in search and social previews."}</p></div></section></TabsContent>
            </Tabs>
            <button
              type="button"
              onClick={saveMeta}
              disabled={saving}
              className="inline-flex h-9 items-center rounded-sm bg-foreground px-4 text-xs font-medium text-background transition-brand hover:bg-w-carbon disabled:opacity-50"
            >
              {saving ? "…" : t("save")}
            </button>
          </TabsContent>

          <TabsContent value="localization" id="localization" className="space-y-5">
            <section className="rounded-2xl border border-black/10 bg-white p-6">
              <div className="flex items-start gap-3"><span className="grid size-9 place-items-center rounded-xl bg-black text-white"><Globe2 className="size-4" /></span><div><h2 className="text-sm font-semibold">Site languages</h2><p className="mt-1 text-xs text-black/45">The default language is used everywhere. Extra localized fields appear only for enabled languages.</p></div></div>
              <div className="mt-6 divide-y divide-black/10 border-y border-black/10">
                {(languages ?? []).map((language) => <div key={language._id} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{language.name}</p><p className="text-[11px] uppercase text-black/40">{language.code}{language.rtl ? " · RTL" : " · LTR"}</p></div>{language.isDefault ? <span className="inline-flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[10px] text-white"><Check className="size-3"/>Default</span> : <><button onClick={() => void setDefaultLanguage({ orgId, code: language.code })} className="rounded-lg px-2.5 py-1.5 text-xs text-black/50 hover:bg-black/5 hover:text-black">Make default</button><button aria-label={`Remove ${language.name}`} onClick={() => void removeLanguage({ orgId, code: language.code })} className="grid size-8 place-items-center rounded-lg text-black/35 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-3.5"/></button></>}</div>)}
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_110px_auto]">
                <Input value={languageName} onChange={(event) => setLanguageName(event.target.value)} placeholder="Language name" className="h-11 rounded-xl border-black/10 shadow-none" />
                <Input value={languageCode} onChange={(event) => setLanguageCode(event.target.value)} placeholder="en" className="h-11 rounded-xl border-black/10 font-mono shadow-none" />
                <button type="button" onClick={() => void createLanguage()} disabled={!languageName.trim() || !languageCode.trim()} className="h-11 rounded-xl bg-black px-4 text-xs font-medium text-white hover:bg-black/80 disabled:opacity-35"><Plus className="me-1.5 inline size-3.5"/>Add language</button>
              </div>
              <label className="mt-3 inline-flex items-center gap-2 text-xs text-black/50"><Switch checked={languageRtl} onCheckedChange={setLanguageRtl}/>Right-to-left language</label>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

export default function SiteSettingsIndexPage() {
  return <SiteSettingsPage />;
}
