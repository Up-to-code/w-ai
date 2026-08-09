import type { Data } from "@puckeditor/core";

import { normalizePuckData } from "./normalize-data";

export const PUCK_DOCUMENT_VERSION = 2 as const;

export type Viewport = "desktop" | "tablet" | "mobile";

export type CmsBinding = {
  kind: "cms-field" | "cms-collection";
  collectionId: string;
  fieldKey: string;
  entryId?: string;
  source: "selected-entry" | "collection-context";
};

export type NodeOverrides = {
  viewport?: Partial<Record<Viewport, Record<string, unknown>>>;
  locale?: Record<string, Record<string, unknown>>;
  localeViewport?: Record<
    string,
    Partial<Record<Viewport, Record<string, unknown>>>
  >;
  hiddenByLocale?: Record<string, boolean>;
};

export type PageDocumentV2 = {
  builder: "puck";
  version: typeof PUCK_DOCUMENT_VERSION;
  data: Data;
  overrides: Record<string, NodeOverrides>;
  bindings: Record<string, Record<string, CmsBinding>>;
};

type ComponentLike = {
  type: string;
  props: Record<string, unknown>;
};

type CraftNode = {
  type?: { resolvedName?: string } | string;
  props?: Record<string, unknown>;
  nodes?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function localizedCodes(value: unknown, result = new Set<string>()) {
  if (Array.isArray(value)) {
    for (const item of value) localizedCodes(item, result);
    return result;
  }
  if (!isRecord(value)) return result;
  const entries = Object.entries(value);
  if (
    entries.length > 0 &&
    entries.every(([code, item]) =>
      /^[a-z]{2,5}(?:-[a-z0-9]{2,8})?$/.test(code) &&
      typeof item === "string",
    )
  ) {
    for (const [code] of entries) result.add(code);
    return result;
  }
  for (const item of Object.values(value)) localizedCodes(item, result);
  return result;
}

function resolveLegacyLocale(value: unknown, locale: string): unknown {
  if (Array.isArray(value)) return value.map((item) => resolveLegacyLocale(item, locale));
  if (!isRecord(value)) return value;
  const entries = Object.entries(value);
  if (
    entries.length > 0 &&
    entries.every(([code, item]) =>
      /^[a-z]{2,5}(?:-[a-z0-9]{2,8})?$/.test(code) &&
      typeof item === "string",
    )
  ) {
    return value[locale] ?? value.en ?? Object.values(value)[0] ?? "";
  }
  return Object.fromEntries(
    entries.map(([key, item]) => [key, resolveLegacyLocale(item, locale)]),
  );
}

/** Extracts old `{ ar, en }` values into the same sparse override model. */
function extractLegacyLocalizedOverrides(data: Data) {
  const overrides: Record<string, NodeOverrides> = {};
  const visit = (value: unknown, fallback: string): unknown => {
    if (Array.isArray(value)) return value.map((item, index) => visit(item, `${fallback}-${index}`));
    if (!isRecord(value)) return value;
    if (typeof value.type !== "string" || !isRecord(value.props)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, visit(item, `${fallback}-${key}`)]),
      );
    }
    const id = nodeId(value as ComponentLike, fallback);
    const props: Record<string, unknown> = {};
    for (const [property, raw] of Object.entries(value.props)) {
      const codes = [...localizedCodes(raw)];
      props[property] = resolveLegacyLocale(raw, "en");
      for (const code of codes) {
        if (code === "en") continue;
        const node = (overrides[id] ??= {});
        const locales = (node.locale ??= {});
        const localeProps = (locales[code] ??= {});
        localeProps[property] = resolveLegacyLocale(raw, code);
      }
      props[property] = visit(props[property], `${id}-${property}`);
    }
    return { ...value, props };
  };
  return { data: normalizePuckData(visit(data, "root")), overrides };
}

export function isPageDocumentV2(value: unknown): value is PageDocumentV2 {
  if (!isRecord(value)) return false;
  return (
    value.builder === "puck" &&
    value.version === PUCK_DOCUMENT_VERSION &&
    isRecord(value.data) &&
    isRecord(value.overrides) &&
    isRecord(value.bindings)
  );
}

export function createPageDocumentV2(data: unknown): PageDocumentV2 {
  const normalized = normalizePuckData(data);
  return {
    builder: "puck",
    version: PUCK_DOCUMENT_VERSION,
    data: normalized,
    overrides: {},
    bindings: deriveCmsBindings(normalized),
  };
}

function nodeId(component: ComponentLike, fallback: string) {
  return typeof component.props.id === "string" && component.props.id
    ? component.props.id
    : fallback;
}

function mergeProps(
  props: Record<string, unknown>,
  node: NodeOverrides | undefined,
  locale: string,
  viewport: Viewport,
) {
  return {
    ...props,
    ...(node?.viewport?.[viewport] ?? {}),
    ...(node?.locale?.[locale] ?? {}),
    ...(node?.localeViewport?.[locale]?.[viewport] ?? {}),
  };
}

function resolveComponent(
  value: unknown,
  document: PageDocumentV2,
  locale: string,
  viewport: Viewport,
  fallbackId: string,
): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item, index) =>
        resolveComponent(item, document, locale, viewport, `${fallbackId}-${index}`),
      )
      .filter(Boolean);
  }
  if (!isRecord(value)) return value;

  if (typeof value.type !== "string" || !isRecord(value.props)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        resolveComponent(child, document, locale, viewport, `${fallbackId}-${key}`),
      ]),
    );
  }

  const component = value as ComponentLike;
  const id = nodeId(component, fallbackId);
  const node = document.overrides[id];
  if (node?.hiddenByLocale?.[locale]) return null;

  const props = mergeProps(component.props, node, locale, viewport);
  return {
    ...component,
    props: Object.fromEntries(
      Object.entries(props).map(([key, child]) => [
        key,
        resolveComponent(child, document, locale, viewport, `${id}-${key}`),
      ]),
    ),
  };
}

/** Materializes sparse locale/viewport overrides into renderable Puck data. */
export function resolvePageDocument(
  document: PageDocumentV2,
  locale: string,
  viewport: Viewport = "desktop",
): Data {
  const resolved = resolveComponent(
    document.data,
    document,
    locale,
    viewport,
    "root",
  );
  return normalizePuckData(resolved);
}

export function setNodeOverride(
  document: PageDocumentV2,
  nodeId: string,
  property: string,
  value: unknown,
  options: { locale?: string; viewport?: Viewport } = {},
): PageDocumentV2 {
  const overrides = structuredClone(document.overrides);
  const node = (overrides[nodeId] ??= {});
  const { locale, viewport } = options;

  if (locale && viewport) {
    const localeViewport = (node.localeViewport ??= {});
    const viewports = (localeViewport[locale] ??= {});
    const props = (viewports[viewport] ??= {});
    props[property] = value;
  } else if (locale) {
    const locales = (node.locale ??= {});
    const props = (locales[locale] ??= {});
    props[property] = value;
  } else if (viewport) {
    const viewports = (node.viewport ??= {});
    const props = (viewports[viewport] ??= {});
    props[property] = value;
  }

  return { ...document, overrides };
}

export function relinkNodeOverride(
  document: PageDocumentV2,
  nodeId: string,
  property: string,
  options: { locale?: string; viewport?: Viewport } = {},
): PageDocumentV2 {
  const overrides = structuredClone(document.overrides);
  const node = overrides[nodeId];
  if (!node) return document;
  const { locale, viewport } = options;

  if (locale && viewport) {
    delete node.localeViewport?.[locale]?.[viewport]?.[property];
  } else if (locale) {
    delete node.locale?.[locale]?.[property];
  } else if (viewport) {
    delete node.viewport?.[viewport]?.[property];
  }

  return { ...document, overrides };
}

/** Relinks every detached property for one locale without touching the others. */
export function relinkLocaleOverrides(
  document: PageDocumentV2,
  locale: string,
): PageDocumentV2 {
  const overrides = structuredClone(document.overrides);
  for (const [id, node] of Object.entries(overrides)) {
    delete node.locale?.[locale];
    delete node.localeViewport?.[locale];
    if (node.hiddenByLocale) delete node.hiddenByLocale[locale];
    if (
      !node.viewport &&
      (!node.locale || Object.keys(node.locale).length === 0) &&
      (!node.localeViewport || Object.keys(node.localeViewport).length === 0) &&
      (!node.hiddenByLocale || Object.keys(node.hiddenByLocale).length === 0)
    ) {
      delete overrides[id];
    }
  }
  return { ...document, overrides };
}

function componentMap(value: unknown, map = new Map<string, ComponentLike>()) {
  if (Array.isArray(value)) {
    for (const item of value) componentMap(item, map);
    return map;
  }
  if (!isRecord(value)) return map;
  if (typeof value.type === "string" && isRecord(value.props)) {
    const component = value as ComponentLike;
    const id = nodeId(component, `component-${map.size}`);
    map.set(id, component);
  }
  for (const item of Object.values(value)) componentMap(item, map);
  return map;
}

function componentSequence(value: unknown, ids: string[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) componentSequence(item, ids);
    return ids;
  }
  if (!isRecord(value)) return ids;
  if (typeof value.type === "string" && isRecord(value.props)) {
    ids.push(nodeId(value as ComponentLike, `component-${ids.length}`));
  }
  for (const item of Object.values(value)) componentSequence(item, ids);
  return ids;
}

function containsComponent(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsComponent);
  if (!isRecord(value)) return false;
  if (typeof value.type === "string" && isRecord(value.props)) return true;
  return Object.values(value).some(containsComponent);
}

/**
 * Applies additions, deletion and ordering globally while retaining the shared
 * scalar props for existing nodes. This prevents a secondary locale or tablet
 * canvas from accidentally baking its resolved overrides into the base tree.
 */
function reconcileSharedStructure(base: Data, edited: Data): Data {
  const baseComponents = componentMap(base);
  const visit = (value: unknown, fallbackId: string): unknown => {
    if (Array.isArray(value)) {
      return value.map((item, index) => visit(item, `${fallbackId}-${index}`));
    }
    if (!isRecord(value)) return value;
    if (typeof value.type !== "string" || !isRecord(value.props)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [
          key,
          visit(child, `${fallbackId}-${key}`),
        ]),
      );
    }

    const component = value as ComponentLike;
    const id = nodeId(component, fallbackId);
    const shared = baseComponents.get(id);
    if (!shared) {
      return {
        ...component,
        props: Object.fromEntries(
          Object.entries(component.props).map(([key, child]) => [
            key,
            visit(child, `${id}-${key}`),
          ]),
        ),
      };
    }

    return {
      ...component,
      props: Object.fromEntries(
        Object.entries(component.props).map(([key, child]) => [
          key,
          containsComponent(child)
            ? visit(child, `${id}-${key}`)
            : key in shared.props
              ? shared.props[key]
              : child,
        ]),
      ),
    };
  };
  return normalizePuckData(visit(edited, "root"));
}

function equalValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Applies Puck edits without duplicating a locale tree. Default-locale edits
 * update global data; secondary-locale edits detach only changed properties.
 */
export function applyPuckEdit(
  document: PageDocumentV2,
  editedData: Data,
  options: {
    locale: string;
    defaultLocale: string;
    viewport?: Viewport;
  },
): PageDocumentV2 {
  const edited = normalizePuckData(editedData);
  const viewport = options.viewport ?? "desktop";
  if (options.locale === options.defaultLocale && viewport === "desktop") {
    return { ...document, data: edited, bindings: deriveCmsBindings(edited) };
  }

  const current = componentMap(
    resolvePageDocument(document, options.locale, viewport),
  );
  const next = componentMap(edited);
  const structureChanged = !equalValue(
    componentSequence(document.data),
    componentSequence(edited),
  );
  let result = structureChanged
    ? { ...document, data: reconcileSharedStructure(document.data, edited) }
    : document;
  for (const [id, component] of next) {
    const previous = current.get(id);
    if (!previous) continue;
    for (const [property, value] of Object.entries(component.props)) {
      if (property === "id" || equalValue(value, previous.props[property])) continue;
      result = setNodeOverride(result, id, property, value, {
        ...(options.locale === options.defaultLocale
          ? {}
          : { locale: options.locale }),
        ...(viewport === "desktop" ? {} : { viewport }),
      });
    }
  }
  return { ...result, bindings: deriveCmsBindings(result.data) };
}

/** Derives CMS references from Puck blocks; values remain in CMS snapshots. */
export function deriveCmsBindings(data: Data) {
  const bindings: PageDocumentV2["bindings"] = {};
  for (const [id, component] of componentMap(data)) {
    if (component.type !== "CmsCollection" && component.type !== "CmsField")
      continue;
    const collectionId = component.props.collectionId;
    if (typeof collectionId !== "string" || !collectionId) continue;
    const property = component.type === "CmsField" ? "value" : "collection";
    bindings[id] = {
      [property]: {
        kind: component.type === "CmsField" ? "cms-field" : "cms-collection",
        collectionId,
        fieldKey: String(component.props.titleField ?? "title"),
        source: "collection-context",
      },
    };
  }
  return bindings;
}

function craftName(node: CraftNode) {
  return typeof node.type === "string" ? node.type : node.type?.resolvedName ?? "";
}

function craftId(prefix: string, id: string) {
  return `${prefix}-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

/**
 * Converts the previous Craft envelope into editable Puck blocks. Layout nodes
 * are flattened while their content, links and visual section boundaries are
 * preserved. The original envelope is retained in page revisions before use.
 */
export function convertCraftDocument(serialized: string): Data {
  let nodes: Record<string, CraftNode>;
  try {
    nodes = JSON.parse(serialized) as Record<string, CraftNode>;
  } catch {
    return createPageDocumentV2({}).data;
  }

  const visit = (id: string): ComponentLike[] => {
    const node = nodes[id];
    if (!node) return [];
    const name = craftName(node);
    const props = node.props ?? {};
    const children = (node.nodes ?? []).flatMap(visit);

    if (name === "QText") {
      const heading = ["h1", "h2", "h3", "h4"].includes(String(props.as));
      return [
        {
          type: heading ? "HeadingBlock" : "ParagraphBlock",
          props: {
            id: craftId(heading ? "heading" : "paragraph", id),
            text: String(props.text ?? ""),
            ...(heading ? { level: String(props.as).slice(1) || "2" } : {}),
            align: props.align === "center" ? "center" : "start",
          },
        },
      ];
    }
    if (name === "QButton") {
      return [
        {
          type: "ButtonBlock",
          props: {
            id: craftId("button", id),
            label: String(props.text ?? "Button"),
            href: String(props.href ?? "#"),
            align: "start",
          },
        },
      ];
    }
    if (name === "QSection") {
      return [
        {
          type: "Section",
          props: {
            id: craftId("section", id),
            content: children,
            contentWidth: "wide",
            padding: "large",
            minHeight: "auto",
            verticalAlign: "center",
            backgroundType: "color",
            backgroundColor: String(props.background ?? "#ffffff"),
            overlay: "rgba(0,0,0,0)",
          },
        },
      ];
    }
    return children;
  };

  const root = nodes.ROOT;
  const content = (root?.nodes ?? []).flatMap(visit);
  return normalizePuckData({ root: { props: { id: "root" } }, content });
}

export function normalizePageDocument(value: unknown): PageDocumentV2 {
  if (isPageDocumentV2(value)) {
    const data = normalizePuckData(value.data);
    return {
      ...value,
      data,
      bindings:
        Object.keys(value.bindings).length > 0
          ? value.bindings
          : deriveCmsBindings(data),
    };
  }
  if (isRecord(value) && value.builder === "qentrah" && typeof value.serialized === "string") {
    return createPageDocumentV2(convertCraftDocument(value.serialized));
  }
  const normalized = normalizePuckData(value);
  const extracted = extractLegacyLocalizedOverrides(normalized);
  return {
    builder: "puck",
    version: PUCK_DOCUMENT_VERSION,
    data: extracted.data,
    overrides: extracted.overrides,
    bindings: deriveCmsBindings(extracted.data),
  };
}
