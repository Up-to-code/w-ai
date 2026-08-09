import { describe, expect, it } from "vitest";

import {
  resolveResizeTarget,
  screenDeltaToCanvasDelta,
} from "./resize-interaction";

describe("Puck resize interaction", () => {
  it("converts pointer movement through the editor zoom", () => {
    expect(screenDeltaToCanvasDelta(24, 1000, 480)).toBe(50);
    expect(screenDeltaToCanvasDelta(-24, 1000, 480)).toBe(-50);
  });

  it("previews on the persisted flexible-layout element", () => {
    const layoutTarget = { id: "layout" } as HTMLElement;
    const componentRoot = {
      querySelector: () => layoutTarget,
    } as unknown as HTMLElement;
    expect(resolveResizeTarget(componentRoot)).toBe(layoutTarget);
  });

  it("falls back to the component root for non-flexible legacy content", () => {
    const componentRoot = {
      querySelector: () => null,
    } as unknown as HTMLElement;
    expect(resolveResizeTarget(componentRoot)).toBe(componentRoot);
  });
});
