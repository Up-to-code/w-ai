export type QentrahLocale = "ar" | "en";

export type Localized = { ar: string; en: string };

/** Resolves a localized value to the active locale (falls back to ar). */
export function pick(
  value: string | Record<string, string> | undefined,
  locale: QentrahLocale,
): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return value[locale] ?? value.ar ?? "";
  return "";
}

/** Field definition for localized text (the editor stores { ar, en }). */
export function localizedField(label: string) {
  return {
    type: "object" as const,
    label,
    objectFields: {
      ar: { type: "text" as const },
      en: { type: "text" as const },
    },
  };
}

/** Picks localized values out of a raw Puck data tree (used by RSC render). */
export function resolveLocalizedData<T>(data: T, locale: QentrahLocale): T {
  if (Array.isArray(data)) {
    return data.map((item) => resolveLocalizedData(item, locale)) as T;
  }
  if (data && typeof data === "object") {
    const source = data as Record<string, unknown>;
    const keys = Object.keys(source);
    const isLocalized =
      keys.length >= 1 &&
      keys.length <= 2 &&
      keys.every((k) => k === "ar" || k === "en") &&
      keys.every((k) => typeof source[k] === "string");
    if (isLocalized) {
      return (source[locale] ?? source.ar ?? "") as T;
    }
    return Object.fromEntries(
      Object.entries(source).map(([k, v]) => [k, resolveLocalizedData(v, locale)]),
    ) as T;
  }
  return data;
}
