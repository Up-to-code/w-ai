import type { CSSProperties, ReactNode } from "react";
import type { Data } from "@puckeditor/core";

export const LENGTH_UNITS = ["px", "%", "vw", "vh", "rem", "em"] as const;
export type LengthUnit = (typeof LENGTH_UNITS)[number];
export type FlexibleLength = string | number;

export function initialFlexibleLengthAmount(
  unit: LengthUnit,
  axis: "width" | "height",
): number {
  if (unit === "%" || unit === "vw" || unit === "vh") return 100;
  if (unit === "rem" || unit === "em") return axis === "height" ? 15 : 20;
  return axis === "height" ? 240 : 320;
}

export type FlexibleLayout = {
  width?: FlexibleLength;
  height?: FlexibleLength;
  minWidth?: FlexibleLength;
  minHeight?: FlexibleLength;
  maxWidth?: FlexibleLength;
  maxHeight?: FlexibleLength;
  offsetX?: FlexibleLength;
  offsetY?: FlexibleLength;
  grow?: number;
  shrink?: number;
  align?: "start" | "center" | "end" | "stretch";
};

export const DEFAULT_FLEXIBLE_LAYOUT: FlexibleLayout = {
  width: "auto",
  height: "auto",
  minWidth: "0px",
  minHeight: "0px",
  maxWidth: "none",
  maxHeight: "none",
  offsetX: "0px",
  offsetY: "0px",
  grow: 0,
  shrink: 1,
  align: "start",
};

export function withFlexibleLayoutDefaults(value: unknown): FlexibleLayout {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_FLEXIBLE_LAYOUT };
  }
  return {
    ...DEFAULT_FLEXIBLE_LAYOUT,
    ...(value as Partial<FlexibleLayout>),
  };
}

const KEYWORDS = new Set([
  "auto",
  "none",
  "fit-content",
  "min-content",
  "max-content",
]);

export function cssLength(
  value: unknown,
  fallback?: string,
): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (KEYWORDS.has(trimmed)) return trimmed;
  if (/^-?\d+(?:\.\d+)?(?:px|%|vw|vh|rem|em)$/.test(trimmed)) return trimmed;
  return fallback;
}

export function parseFlexibleLength(
  value: unknown,
  fallbackUnit: LengthUnit = "px",
): { amount: number; unit: LengthUnit; keyword?: string } {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { amount: value, unit: "px" };
  }
  const normalized = typeof value === "string" ? value.trim() : "";
  if (KEYWORDS.has(normalized))
    return { amount: 0, unit: fallbackUnit, keyword: normalized };
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(px|%|vw|vh|rem|em)$/);
  if (!match) return { amount: 0, unit: fallbackUnit };
  return { amount: Number(match[1]), unit: match[2] as LengthUnit };
}

export function pixelsToFlexibleLength(
  pixels: number,
  current: unknown,
  axis: "width" | "height",
  context: {
    parentWidth?: number;
    parentHeight?: number;
    viewportWidth: number;
    viewportHeight: number;
    rootFontSize: number;
    fontSize: number;
  },
): string {
  const parsed = parseFlexibleLength(current);
  if (parsed.keyword || parsed.unit === "px") return `${Math.round(pixels)}px`;
  const base =
    parsed.unit === "%"
      ? axis === "width"
        ? context.parentWidth
        : context.parentHeight
      : parsed.unit === "vw"
        ? context.viewportWidth
        : parsed.unit === "vh"
          ? context.viewportHeight
          : parsed.unit === "rem"
            ? context.rootFontSize
            : context.fontSize;
  if (!base) return `${Math.round(pixels)}px`;
  const multiplier =
    parsed.unit === "%" || parsed.unit === "vw" || parsed.unit === "vh"
      ? 100
      : 1;
  const amount = Math.round((pixels / base) * multiplier * 100) / 100;
  return `${amount}${parsed.unit}`;
}

export function flexibleLayoutStyle(
  layout: FlexibleLayout | undefined,
): CSSProperties {
  if (!layout) return {};
  const offsetX = cssLength(layout.offsetX, "0px");
  const offsetY = cssLength(layout.offsetY, "0px");
  const alignment = layout.align ?? "start";
  return {
    width: cssLength(layout.width),
    height: cssLength(layout.height),
    minWidth: cssLength(layout.minWidth),
    minHeight: cssLength(layout.minHeight),
    maxWidth: cssLength(layout.maxWidth),
    maxHeight: cssLength(layout.maxHeight),
    position: offsetX !== "0px" || offsetY !== "0px" ? "relative" : undefined,
    insetInlineStart: offsetX !== "0px" ? offsetX : undefined,
    top: offsetY !== "0px" ? offsetY : undefined,
    flexGrow: layout.grow,
    flexShrink: layout.shrink,
    alignSelf: alignment === "stretch" ? "stretch" : undefined,
    marginInlineStart:
      alignment === "center" || alignment === "end" ? "auto" : undefined,
    marginInlineEnd:
      alignment === "center" || alignment === "start" ? "auto" : undefined,
  };
}

export function FlexibleLayoutBox({
  layout,
  children,
}: {
  layout?: FlexibleLayout;
  children: ReactNode;
}) {
  return (
    <div data-wai-flexible-layout style={flexibleLayoutStyle(layout)}>
      {children}
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function updateValue(
  value: unknown,
  componentId: string,
  patch: Partial<FlexibleLayout>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => updateValue(item, componentId, patch));
  }
  if (!isRecord(value)) return value;
  if (typeof value.type === "string" && isRecord(value.props)) {
    const props = value.props;
    const id = props.id;
    if (id === componentId) {
      const previous = isRecord(props.layout) ? props.layout : {};
      const layout = { ...previous };
      for (const [key, next] of Object.entries(patch)) {
        if (next === undefined) delete layout[key];
        else layout[key] = next;
      }
      return { ...value, props: { ...props, layout } };
    }
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      updateValue(child, componentId, patch),
    ]),
  );
}

export function updateComponentLayout(
  data: Data,
  componentId: string,
  patch: Partial<FlexibleLayout>,
): Data {
  return updateValue(data, componentId, patch) as Data;
}
