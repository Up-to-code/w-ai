export type LegacyPuckBlock = {
  type: string;
  props: Record<string, unknown>;
};

export type LegacyPuckPageData = {
  root: { props: Record<string, unknown> };
  content: LegacyPuckBlock[];
};

export function isLegacyPuckPageData(
  value: unknown,
): value is LegacyPuckPageData {
  if (!value || typeof value !== "object") return false;

  const page = value as Partial<LegacyPuckPageData>;
  return (
    !!page.root &&
    typeof page.root === "object" &&
    Array.isArray(page.content) &&
    page.content.every(
      (block) =>
        !!block &&
        typeof block === "object" &&
        typeof block.type === "string" &&
        !!block.props &&
        typeof block.props === "object",
    )
  );
}

export function localizedText(value: unknown, locale: "ar" | "en"): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const localized = value as Record<string, unknown>;
  const preferred = localized[locale];
  if (typeof preferred === "string") return preferred;

  const fallback = locale === "ar" ? localized.en : localized.ar;
  return typeof fallback === "string" ? fallback : "";
}

export function legacyPageKey(value: unknown): string {
  if (!isLegacyPuckPageData(value)) return "starter";

  return value.content
    .map((block, index) => {
      const id = block.props.id;
      return typeof id === "string" ? id : `${block.type}-${index}`;
    })
    .join("|");
}
