"use client";

import { Render } from "@puckeditor/core";

import { buildPuckConfig } from "@/lib/puck/config";
import type { QentrahLocale } from "@/lib/puck/localized";
import {
  normalizePageDocument,
  resolvePageDocument,
} from "@/lib/puck/page-document";

import { EditorErrorBoundary } from "./editor-error-boundary";

export function PageRenderer({
  data,
  locale,
  direction = "ltr",
  preferredFont,
  cmsEntry,
}: {
  data: unknown;
  locale: QentrahLocale;
  direction?: "ltr" | "rtl";
  preferredFont?: string;
  cmsEntry?: {
    collectionId: string;
    values: Record<string, unknown>;
  };
}) {
  const document = normalizePageDocument(data);
  const resolved = resolvePageDocument(document, locale, "desktop");
  return (
    <EditorErrorBoundary documentKey={`public:${locale}`}>
      <Render
        config={buildPuckConfig(
          locale,
          { direction, preferredFont },
          { cmsEntry },
        )}
        data={resolved}
      />
    </EditorErrorBoundary>
  );
}
