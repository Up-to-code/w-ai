import { describe, expect, it } from "vitest";
import type { Data } from "@puckeditor/core";

import {
  convertCraftDocument,
  applyPuckEdit,
  createPageDocumentV2,
  relinkLocaleOverrides,
  relinkNodeOverride,
  resolvePageDocument,
  setNodeOverride,
} from "./page-document";

describe("Puck page document v2", () => {
  const data = {
    root: { props: { id: "root" } },
    content: [
      { type: "HeadingBlock", props: { id: "heading-1", text: "English" } },
    ],
  };

  it("resolves global, viewport, locale and locale+viewport in order", () => {
    let document = createPageDocumentV2(data);
    document = setNodeOverride(document, "heading-1", "text", "Tablet", {
      viewport: "tablet",
    });
    document = setNodeOverride(document, "heading-1", "text", "العربية", {
      locale: "ar",
    });
    document = setNodeOverride(document, "heading-1", "text", "عربي جوال", {
      locale: "ar",
      viewport: "mobile",
    });

    expect(resolvePageDocument(document, "en", "desktop").content[0].props.text).toBe("English");
    expect(resolvePageDocument(document, "en", "tablet").content[0].props.text).toBe("Tablet");
    expect(resolvePageDocument(document, "ar", "desktop").content[0].props.text).toBe("العربية");
    expect(resolvePageDocument(document, "ar", "mobile").content[0].props.text).toBe("عربي جوال");
  });

  it("relinks by deleting the sparse override", () => {
    const localized = setNodeOverride(
      createPageDocumentV2(data),
      "heading-1",
      "text",
      "العربية",
      { locale: "ar" },
    );
    const linked = relinkNodeOverride(localized, "heading-1", "text", {
      locale: "ar",
    });
    expect(resolvePageDocument(linked, "ar").content[0].props.text).toBe("English");
  });

  it("relinks a locale without changing another locale", () => {
    let localized = createPageDocumentV2(data);
    localized = setNodeOverride(localized, "heading-1", "text", "العربية", {
      locale: "ar",
    });
    localized = setNodeOverride(localized, "heading-1", "text", "Français", {
      locale: "fr",
    });
    const linked = relinkLocaleOverrides(localized, "ar");
    expect(resolvePageDocument(linked, "ar").content[0].props.text).toBe("English");
    expect(resolvePageDocument(linked, "fr").content[0].props.text).toBe("Français");
  });

  it("converts Craft text without introducing fragment resolver nodes", () => {
    const converted = convertCraftDocument(
      JSON.stringify({
        ROOT: { type: { resolvedName: "QBody" }, nodes: ["section"] },
        section: {
          type: { resolvedName: "QSection" },
          props: { background: "#fff" },
          nodes: ["text"],
        },
        text: {
          type: { resolvedName: "QText" },
          props: { as: "h2", text: "Preserved" },
          nodes: [],
        },
      }),
    );
    const serialized = JSON.stringify(converted);
    expect(serialized).toContain("Preserved");
    expect(serialized).not.toContain("react.fragment");
  });

  it("preserves legacy Arabic as a sparse opt-in override", async () => {
    const { normalizePageDocument } = await import("./page-document");
    const document = normalizePageDocument({
      root: { props: { id: "root" } },
      content: [
        {
          type: "HeadingBlock",
          props: { id: "heading-1", text: { en: "English", ar: "العربية" } },
        },
      ],
    });
    expect(resolvePageDocument(document, "en").content[0].props.text).toBe("English");
    expect(resolvePageDocument(document, "ar").content[0].props.text).toBe("العربية");
  });

  it("detaches only the edited property for a secondary locale", () => {
    const document = createPageDocumentV2(data);
    const edited = structuredClone(data);
    edited.content[0].props.text = "العربية";
    const next = applyPuckEdit(document, edited as Data, {
      locale: "ar",
      defaultLocale: "en",
    });
    expect(resolvePageDocument(next, "en").content[0].props.text).toBe("English");
    expect(resolvePageDocument(next, "ar").content[0].props.text).toBe("العربية");
  });

  it("keeps default-locale tablet edits out of desktop", () => {
    const document = createPageDocumentV2(data);
    const edited = structuredClone(data);
    edited.content[0].props.text = "Tablet only";
    const next = applyPuckEdit(document, edited as Data, {
      locale: "en",
      defaultLocale: "en",
      viewport: "tablet",
    });
    expect(resolvePageDocument(next, "en", "desktop").content[0].props.text).toBe("English");
    expect(resolvePageDocument(next, "en", "tablet").content[0].props.text).toBe("Tablet only");
  });

  it("adds and reorders components globally from a secondary locale without leaking translated props", () => {
    const document = createPageDocumentV2({
      ...data,
      content: [
        ...data.content,
        { type: "ParagraphBlock", props: { id: "paragraph-1", text: "Shared paragraph" } },
      ],
    });
    const edited = structuredClone(resolvePageDocument(document, "ar"));
    edited.content[0].props.text = "العربية";
    edited.content = [
      edited.content[1],
      edited.content[0],
      { type: "ButtonBlock", props: { id: "button-1", label: "New global button" } },
    ];
    const next = applyPuckEdit(document, edited, {
      locale: "ar",
      defaultLocale: "en",
    });

    expect(next.data.content.map((component) => component.props.id)).toEqual([
      "paragraph-1",
      "heading-1",
      "button-1",
    ]);
    expect(resolvePageDocument(next, "en").content[1].props.text).toBe("English");
    expect(resolvePageDocument(next, "ar").content[1].props.text).toBe("العربية");
  });

  it("deletes components globally from a secondary locale", () => {
    const document = createPageDocumentV2({
      ...data,
      content: [
        ...data.content,
        { type: "ParagraphBlock", props: { id: "paragraph-1", text: "Remove me" } },
      ],
    });
    const edited = structuredClone(resolvePageDocument(document, "fr"));
    edited.content = edited.content.slice(0, 1);
    const next = applyPuckEdit(document, edited, {
      locale: "fr",
      defaultLocale: "en",
    });

    expect(resolvePageDocument(next, "en").content).toHaveLength(1);
    expect(resolvePageDocument(next, "fr").content).toHaveLength(1);
  });
});
