export type QentrahLocale = string;

export type Localized = string;

/** Resolves legacy localized values; v2 documents normally store strings. */
export function pick(
  value: string | Record<string, string> | undefined,
  locale: QentrahLocale,
): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object")
    return value[locale] ?? value.en ?? Object.values(value)[0] ?? "";
  return "";
}

/** v2 fields are scalar; locale differences live in sparse page overrides. */
export function localizedField(label: string) {
  return {
    type: "text" as const,
    label,
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
      keys.every((k) => /^[a-z]{2,5}(?:-[a-z0-9]{2,8})?$/.test(k)) &&
      keys.every((k) => typeof source[k] === "string");
    if (isLocalized) {
      return (source[locale] ?? source.en ?? Object.values(source)[0] ?? "") as T;
    }
    return Object.fromEntries(
      Object.entries(source).map(([k, v]) => [k, resolveLocalizedData(v, locale)]),
    ) as T;
  }
  return data;
}
