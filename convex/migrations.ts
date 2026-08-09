import { Migrations } from "@convex-dev/migrations";

import { components } from "./_generated/api";
import schema from "./schema";

export const migrations = new Migrations(components.migrations, { schema });

function componentId(type: string, seed: string) {
  return `${type}-${seed.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function normalizeLegacyPuck(data: any) {
  const normalize = (item: any, index: number): any => {
    if (!item || typeof item !== "object") return item;
    const type = typeof item.type === "string" ? item.type : "Block";
    const props = { ...(item.props ?? {}) };
    props.id ||= componentId(type, String(index));
    for (const [key, value] of Object.entries(props)) {
      if (Array.isArray(value)) props[key] = value.map(normalize);
    }
    return { ...item, type, props };
  };
  return {
    root: { props: { ...(data?.root?.props ?? data?.root ?? {}), id: "root" } },
    content: Array.isArray(data?.content) ? data.content.map(normalize) : [],
    ...(data?.zones ? { zones: data.zones } : {}),
  };
}

function convertCraft(serialized: string) {
  let nodes: Record<string, any> = {};
  try {
    nodes = JSON.parse(serialized);
  } catch {
    return normalizeLegacyPuck({});
  }
  const visit = (id: string): any[] => {
    const node = nodes[id];
    if (!node) return [];
    const name =
      typeof node.type === "string" ? node.type : node.type?.resolvedName ?? "";
    const props = node.props ?? {};
    const children = (node.nodes ?? []).flatMap(visit);
    if (name === "QText") {
      const heading = ["h1", "h2", "h3", "h4"].includes(String(props.as));
      return [{
        type: heading ? "HeadingBlock" : "ParagraphBlock",
        props: {
          id: componentId(heading ? "heading" : "paragraph", id),
          text: String(props.text ?? ""),
          ...(heading ? { level: String(props.as).slice(1) || "2" } : {}),
          align: props.align === "center" ? "center" : "start",
        },
      }];
    }
    if (name === "QButton") return [{
      type: "ButtonBlock",
      props: {
        id: componentId("button", id),
        label: String(props.text ?? "Button"),
        href: String(props.href ?? "#"),
        align: "start",
      },
    }];
    if (name === "QSection") return [{
      type: "Section",
      props: {
        id: componentId("section", id),
        content: children,
        contentWidth: "wide",
        padding: "large",
        minHeight: "auto",
        verticalAlign: "center",
        backgroundType: "color",
        backgroundColor: String(props.background ?? "#ffffff"),
        overlay: "rgba(0,0,0,0)",
      },
    }];
    return children;
  };
  return normalizeLegacyPuck({
    root: { props: { id: "root" } },
    content: (nodes.ROOT?.nodes ?? []).flatMap(visit),
  });
}

function toPuckV2(data: any) {
  if (data?.builder === "puck" && data?.version === 2) return data;
  const puck =
    data?.builder === "qentrah" && typeof data.serialized === "string"
      ? convertCraft(data.serialized)
      : normalizeLegacyPuck(data);
  return { builder: "puck", version: 2, data: puck, overrides: {}, bindings: {} };
}

/** Adds explicit language profiles without deleting any existing locale. */
export const addLanguageProfiles = migrations.define({
  table: "languages",
  migrateOne: (_ctx, language) => ({
    nativeName: language.nativeName ?? language.name,
    direction: language.direction ?? (language.rtl ? "rtl" : "ltr"),
    preferredFont:
      language.preferredFont ??
      (language.rtl ? "Noto Sans Arabic" : "system-ui"),
  }),
});

/** Marks existing editor documents for compatibility reads before v2 writes. */
export const markEditorVersions = migrations.define({
  table: "pages",
  migrateOne: (_ctx, page) => ({
    editorVersion:
      page.editorVersion ??
      (page.data?.builder === "puck" && page.data?.version === 2 ? 2 : 1),
  }),
});

/**
 * Immutable backup + idempotent v2 conversion + English/default publication
 * pointer. Existing Arabic language rows and values are never deleted.
 */
export const migratePagesToPuckV2 = migrations.define({
  table: "pages",
  migrateOne: async (ctx, page) => {
    if (page.editorVersion === 2 && page.data?.builder === "puck") return;
    const languages = await ctx.db
      .query("languages")
      .withIndex("by_org", (q) => q.eq("orgId", page.orgId))
      .collect();
    const defaultLocale = languages.find((language) => language.isDefault)?.code ?? "en";
    const backup = await ctx.db.insert("pageRevisions", {
      orgId: page.orgId,
      pageId: page._id,
      localeCode: defaultLocale,
      data: page.data,
      source: "migration",
      createdAt: Date.now(),
    });
    const data = toPuckV2(page.data);
    await ctx.db.patch(page._id, { data, editorVersion: 2, updatedAt: Date.now() });
    const existingLocale = await ctx.db
      .query("pageLocales")
      .withIndex("by_page_locale", (q) =>
        q.eq("pageId", page._id).eq("localeCode", defaultLocale),
      )
      .unique();
    if (!existingLocale) {
      const revisionId = page.published
        ? await ctx.db.insert("pageRevisions", {
            orgId: page.orgId,
            pageId: page._id,
            localeCode: defaultLocale,
            data,
            source: "publish",
            createdAt: Date.now(),
          })
        : undefined;
      await ctx.db.insert("pageLocales", {
        orgId: page.orgId,
        pageId: page._id,
        localeCode: defaultLocale,
        slug: page.slug,
        title:
          page.title[defaultLocale] ?? page.title.en ?? Object.values(page.title)[0] ?? page.slug,
        status: page.published ? "published" : "draft",
        publishedRevisionId: revisionId,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      });
    }
    void backup;
  },
});

export const run = migrations.runner();
