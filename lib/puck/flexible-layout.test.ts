import { describe, expect, it } from "vitest";

import {
  cssLength,
  pixelsToFlexibleLength,
  updateComponentLayout,
} from "./flexible-layout";

describe("flexible Puck layout", () => {
  it("normalizes numeric and supported CSS lengths", () => {
    expect(cssLength(320)).toBe("320px");
    expect(cssLength("62.5%")).toBe("62.5%");
    expect(cssLength("calc(100% - 2rem)", "auto")).toBe("auto");
  });

  it("preserves the selected unit when resizing", () => {
    expect(
      pixelsToFlexibleLength(600, "50%", "width", {
        parentWidth: 1200,
        parentHeight: 800,
        viewportWidth: 1440,
        viewportHeight: 900,
        rootFontSize: 16,
        fontSize: 16,
      }),
    ).toBe("50%");
  });

  it("updates nested slot components without changing siblings", () => {
    const data = {
      root: { props: { id: "root" } },
      content: [
        {
          type: "Section",
          props: {
            id: "section-1",
            content: [{ type: "Text", props: { id: "text-1", text: "Hello" } }],
          },
        },
      ],
    };
    const next = updateComponentLayout(data as any, "text-1", { width: "40%" });
    const section = next.content[0];
    expect(section.props.content[0].props.layout).toEqual({ width: "40%" });
    expect(section.props.id).toBe("section-1");
  });
});
