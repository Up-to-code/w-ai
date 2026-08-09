import { describe, expect, it } from "vitest";

import {
  cssLength,
  flexibleLayoutStyle,
  initialFlexibleLengthAmount,
  pixelsToFlexibleLength,
  updateComponentLayout,
  withFlexibleLayoutDefaults,
} from "./flexible-layout";

describe("flexible Puck layout", () => {
  it("uses visible defaults when changing auto sizing to a numeric unit", () => {
    expect(initialFlexibleLengthAmount("%", "width")).toBe(100);
    expect(initialFlexibleLengthAmount("px", "width")).toBe(320);
    expect(initialFlexibleLengthAmount("px", "height")).toBe(240);
  });
  it("shows auto sizing for old components without layout data", () => {
    expect(withFlexibleLayoutDefaults(undefined)).toMatchObject({
      width: "auto",
      height: "auto",
      align: "start",
    });
    expect(withFlexibleLayoutDefaults({ width: "50%" })).toMatchObject({
      width: "50%",
      height: "auto",
      maxWidth: "none",
    });
  });
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

  it("centers a sized child inside its parent without absolute positioning", () => {
    expect(
      flexibleLayoutStyle({ width: "50%", align: "center" }),
    ).toMatchObject({
      width: "50%",
      marginInlineStart: "auto",
      marginInlineEnd: "auto",
    });
  });
});
