"use client";

import dynamic from "next/dynamic";

/**
 * Browser-only Puck entry.
 *
 * Do not import the editor from `@puckeditor/core` in App Router client
 * files that may be analyzed with the `react-server` export condition —
 * that resolves to `rsc.mjs` (no <Puck> UI).
 *
 * This module is only imported from `"use client"` editor code and points
 * at the concrete browser bundle via the `@puck-editor` alias in next.config.
 */
export const Puck = dynamic(
  async () => {
    // @ts-expect-error alias defined in next.config.js (browser build)
    const browserModule = await import("@puck-editor");
    return browserModule.Puck;
  },
  { ssr: false },
) as typeof import("@puckeditor/core").Puck;
