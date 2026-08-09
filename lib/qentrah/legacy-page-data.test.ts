import { describe, expect, it } from "vitest";

import {
  isLegacyPuckPageData,
  legacyPageKey,
  localizedText,
} from "./legacy-page-data";

const page = {
  root: { props: { id: "root" } },
  content: [
    {
      type: "SectionHeading",
      props: {
        id: "heading-1",
        title: { ar: "من نحن", en: "About us" },
      },
    },
  ],
};

describe("legacy Puck page compatibility", () => {
  it("recognizes stored Puck documents", () => {
    expect(isLegacyPuckPageData(page)).toBe(true);
    expect(isLegacyPuckPageData({ content: [] })).toBe(false);
  });

  it("resolves the active locale with a fallback", () => {
    expect(localizedText(page.content[0].props.title, "en")).toBe("About us");
    expect(localizedText({ ar: "العربية" }, "en")).toBe("العربية");
    expect(localizedText("Shared", "ar")).toBe("Shared");
  });

  it("builds a stable editor key from stored block ids", () => {
    expect(legacyPageKey(page)).toBe("heading-1");
    expect(legacyPageKey(null)).toBe("starter");
  });
});
