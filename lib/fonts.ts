import { Tajawal } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

/**
 * Tajawal — Arabic-first body/UI font.
 * Used as the primary sans-serif for all Arabic + Latin copy in the CMS dashboard
 * and tenant sites. Matches W-AI's clean geometric character.
 */
export const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-tajawal",
  display: "swap",
});

/**
 * Geist Sans — W-AI primary typeface for English-dominant contexts.
 * Use for display text, headings, and UI chrome on the marketing site.
 */
export const geistSans = GeistSans;

/**
 * Geist Mono — technical metadata, coordinates, code snippets.
 * Used for the brand's metadata label pattern:
 *   WEB / CMS / REAL ESTATE
 *   31.9539° N  /  35.9106° E
 */
export const geistMono = GeistMono;
