"use client";

import { Editor, Frame } from "@craftjs/core";
import { Render } from "@puckeditor/core";

import { buildPuckConfig } from "@/lib/puck/config";
import type { QentrahLocale } from "@/lib/puck/localized";
import { isQentrahPageData } from "@/lib/qentrah/page-data";

import { QENTRAH_RESOLVER, QentrahViewportProvider } from "./editor-nodes";

export function PageRenderer({
  data,
  locale,
}: {
  data: unknown;
  locale: QentrahLocale;
}) {
  if (isQentrahPageData(data)) {
    return (
      <Editor enabled={false} resolver={QENTRAH_RESOLVER}>
        <QentrahViewportProvider>
          <Frame data={data.serialized} />
        </QentrahViewportProvider>
      </Editor>
    );
  }

  return <Render config={buildPuckConfig(locale)} data={data as never} />;
}
