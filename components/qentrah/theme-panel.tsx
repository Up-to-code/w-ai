"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditor } from "@craftjs/core";
import { Check, Loader2, Search, Type } from "lucide-react";

import { QentrahColorPicker } from "./color-picker-field";

const FALLBACK_FONTS = [
  "Inter",
  "Manrope",
  "DM Sans",
  "Plus Jakarta Sans",
  "Space Grotesk",
  "IBM Plex Sans",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Playfair Display",
  "Merriweather",
  "Noto Sans Arabic",
  "Cairo",
  "Tajawal",
];

const PALETTES = [
  {
    name: "Qentrah Blue",
    primary: "#2563eb",
    secondary: "#7c3aed",
    background: "#ffffff",
    text: "#18181b",
  },
  {
    name: "Graphite",
    primary: "#18181b",
    secondary: "#52525b",
    background: "#fafafa",
    text: "#18181b",
  },
  {
    name: "Emerald",
    primary: "#059669",
    secondary: "#0f766e",
    background: "#f8fafc",
    text: "#0f172a",
  },
  {
    name: "Sunset",
    primary: "#ea580c",
    secondary: "#db2777",
    background: "#fffaf5",
    text: "#292524",
  },
];

export function ThemePanel({ query }: { query: string }) {
  const [fonts, setFonts] = useState(FALLBACK_FONTS);
  const [loadingFonts, setLoadingFonts] = useState(true);
  const { bodyId, bodyProps, actions, nodes } = useEditor((state) => {
    const body = Object.values(state.nodes).find(
      (node) => node.data.displayName === "Body",
    );
    return {
      bodyId: body?.id,
      bodyProps: (body?.data.props ?? {}) as Record<string, unknown>,
      nodes: state.nodes,
    };
  });

  useEffect(() => {
    let active = true;
    fetch("/api/google-fonts")
      .then((response) => response.json() as Promise<{ fonts?: string[] }>)
      .then((payload) => {
        const available = payload.fonts ?? [];
        if (active && available.length > 0) setFonts(available);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingFonts(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const primary = String(bodyProps.themePrimary ?? "#2563eb");
  const secondary = String(bodyProps.themeSecondary ?? "#7c3aed");
  const background = String(bodyProps.themeBackground ?? "#ffffff");
  const text = String(bodyProps.themeText ?? "#18181b");
  const bodyFont = String(bodyProps.fontFamily ?? "Inter");
  const headingFont = String(bodyProps.headingFontFamily ?? bodyFont);
  const filteredFonts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return fonts.slice(0, 80);
    return fonts
      .filter((font) => font.toLowerCase().includes(term))
      .slice(0, 100);
  }, [fonts, query]);

  const updateBody = (updates: Record<string, unknown>) => {
    if (!bodyId) return;
    actions.setProp(bodyId, (draft: Record<string, unknown>) => {
      Object.assign(draft, updates);
    });
  };

  const applyPrimary = (color: string) => {
    updateBody({ themePrimary: color });
    Object.values(nodes).forEach((node) => {
      if (node.data.displayName !== "Button") return;
      const buttonBackground = String(node.data.props.background ?? "#2563eb");
      if (buttonBackground !== primary && buttonBackground !== "#2563eb")
        return;
      actions.setProp(node.id, (draft: Record<string, unknown>) => {
        draft.background = color;
      });
    });
  };

  const applyText = (color: string) => {
    updateBody({ themeText: color });
    Object.values(nodes).forEach((node) => {
      if (node.data.displayName !== "Text") return;
      const nodeColor = String(node.data.props.color ?? "#18181b");
      if (nodeColor !== text && nodeColor !== "#18181b") return;
      actions.setProp(node.id, (draft: Record<string, unknown>) => {
        draft.color = color;
      });
    });
  };

  const applyPalette = (palette: (typeof PALETTES)[number]) => {
    updateBody({
      themePrimary: palette.primary,
      themeSecondary: palette.secondary,
      themeBackground: palette.background,
      themeText: palette.text,
      background: palette.background,
    });
    Object.values(nodes).forEach((node) => {
      if (node.data.displayName === "Button") {
        actions.setProp(node.id, (draft: Record<string, unknown>) => {
          draft.background = palette.primary;
          draft.color = "#ffffff";
        });
      }
      if (node.data.displayName === "Text") {
        actions.setProp(node.id, (draft: Record<string, unknown>) => {
          draft.color = palette.text;
        });
      }
    });
  };

  return (
    <div className="space-y-5 p-3">
      <section className="space-y-2">
        <div>
          <p className="text-xs font-semibold text-zinc-900">Color system</p>
          <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">
            Sets page tokens and the default styling of system buttons.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PALETTES.map((palette) => {
            const selected = palette.primary === primary;
            return (
              <button
                key={palette.name}
                type="button"
                onClick={() => applyPalette(palette)}
                className={`rounded-lg border p-2 text-left ${selected ? "border-blue-500 bg-blue-50" : "border-zinc-200 hover:border-zinc-300"}`}
              >
                <span className="mb-2 flex gap-1">
                  {[palette.primary, palette.secondary, palette.background].map(
                    (color) => (
                      <span
                        key={color}
                        className="size-5 rounded-full border border-black/10"
                        style={{ backgroundColor: color }}
                      />
                    ),
                  )}
                  {selected ? (
                    <Check className="ml-auto size-3.5 text-blue-600" />
                  ) : null}
                </span>
                <span className="text-[11px] font-medium text-zinc-800">
                  {palette.name}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Primary", primary, applyPrimary],
            [
              "Secondary",
              secondary,
              (value: string) => updateBody({ themeSecondary: value }),
            ],
            [
              "Background",
              background,
              (value: string) =>
                updateBody({ themeBackground: value, background: value }),
            ],
            ["Text", text, applyText],
          ].map(([label, value, change]) => (
            <div
              key={String(label)}
              className="flex items-center justify-between rounded-md border border-zinc-200 px-2.5 py-2"
            >
              <span className="text-[11px] font-medium text-zinc-700">
                {String(label)}
              </span>
              <QentrahColorPicker
                compact
                label={String(label)}
                value={String(value)}
                onChange={change as (color: string) => void}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2 border-t border-zinc-200 pt-4">
        <div className="flex items-center gap-2">
          <Type className="size-3.5 text-zinc-500" />
          <div>
            <p className="text-xs font-semibold text-zinc-900">Typography</p>
            <p className="text-[11px] text-zinc-500">
              Body: {bodyFont} · Headings: {headingFont}
            </p>
          </div>
          {loadingFonts ? (
            <Loader2 className="ml-auto size-3.5 animate-spin" />
          ) : null}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <p className="h-8 rounded-md bg-zinc-50 pl-8 pr-2 text-[11px] leading-8 text-zinc-500">
            Use the panel search to filter Google Fonts
          </p>
        </div>
        <div className="max-h-80 divide-y divide-zinc-100 overflow-y-auto rounded-md border border-zinc-200">
          {filteredFonts.map((font) => (
            <div key={font} className="flex items-center gap-1 p-1.5">
              <button
                type="button"
                onClick={() => updateBody({ fontFamily: font })}
                className={`min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-xs ${bodyFont === font ? "bg-blue-50 text-blue-700" : "hover:bg-zinc-50"}`}
                style={{ fontFamily: `"${font}", sans-serif` }}
              >
                {font}
              </button>
              <button
                type="button"
                title="Use for headings"
                onClick={() => updateBody({ headingFontFamily: font })}
                className={`rounded px-2 py-1.5 text-[10px] font-medium ${headingFont === font ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
              >
                H
              </button>
            </div>
          ))}
          {filteredFonts.length === 0 ? (
            <p className="p-4 text-center text-xs text-zinc-500">
              No fonts match this search.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
