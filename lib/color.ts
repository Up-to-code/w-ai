function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

/** Converts a hex color (#RRGGBB) to an HSL triplet for shadcn CSS variables. */
export function hexToHslTriplet(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return `${0} ${0}% ${Math.round(l * 100)}%`;

  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        h = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
    }
    h *= 60;
  }

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Linear-blends two hex colors and returns #rrggbb. */
export function blendHex(a: string, b: string, t: number): string | null {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return null;
  const lerp = (x: number, y: number) => Math.round(x + (y - x) * t);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(lerp(ca.r, cb.r))}${toHex(lerp(ca.g, cb.g))}${toHex(lerp(ca.b, cb.b))}`;
}

/** Relative luminance (WCAG) of a hex color; >0.5 means a light color. */
export function isLightColor(hex: string): boolean | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const l = 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  return l > 0.45;
}


