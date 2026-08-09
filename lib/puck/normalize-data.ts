import type { Data } from "@puckeditor/core";

/**
 * Puck 0.23 requires every component to carry a stable `props.id`.
 * Our Convex templates / older rows store blocks without ids, which
 * crashes the editor (`Cannot read properties of null (reading 'position')`)
 * during drag-and-drop setup.
 */
function newId(type: string) {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${type}-${rand}`;
}

function normalizeItem(item: unknown): unknown {
  if (!item || typeof item !== "object") return item;
  const block = item as {
    type?: string;
    props?: Record<string, unknown>;
  };
  const type = typeof block.type === "string" ? block.type : "Block";
  const props =
    block.props && typeof block.props === "object" ? { ...block.props } : {};

  if (typeof props.id !== "string" || !props.id) {
    props.id = newId(type);
  }

  // Nested slot/array content may also hold component trees.
  for (const [key, value] of Object.entries(props)) {
    if (Array.isArray(value) && value.some(isComponentLike)) {
      props[key] = value.map(normalizeItem);
    }
  }

  return { ...block, type, props };
}

function isComponentLike(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    "type" in (value as object) &&
    "props" in (value as object)
  );
}

export function normalizePuckData(input: unknown): Data {
  const raw = (input && typeof input === "object" ? input : {}) as {
    root?: { props?: Record<string, unknown> } | Record<string, unknown>;
    content?: unknown[];
    zones?: Record<string, unknown[]>;
  };

  const rootProps =
    raw.root && typeof raw.root === "object"
      ? "props" in raw.root && raw.root.props && typeof raw.root.props === "object"
        ? { ...(raw.root.props as Record<string, unknown>) }
        : { ...(raw.root as Record<string, unknown>) }
      : {};

  // Root also needs an id in newer Puck versions.
  if (typeof rootProps.id !== "string" || !rootProps.id) {
    rootProps.id = "root";
  }

  const content = Array.isArray(raw.content)
    ? raw.content.map(normalizeItem)
    : [];

  const zones: Record<string, unknown[]> = {};
  if (raw.zones && typeof raw.zones === "object") {
    for (const [zoneId, items] of Object.entries(raw.zones)) {
      zones[zoneId] = Array.isArray(items) ? items.map(normalizeItem) : [];
    }
  }

  return {
    root: { props: rootProps },
    content,
    ...(Object.keys(zones).length > 0 ? { zones } : {}),
  } as Data;
}
