"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

/**
 * Sets `lang` and `dir` on <html> from a nested layout without
 * rendering a second <html> tag (which causes hydration errors).
 */
export function HtmlDirSetter({ lang, dir, children }: { lang: string; dir: string; children?: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  return <>{children}</>;
}
