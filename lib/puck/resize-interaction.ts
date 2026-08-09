export function screenDeltaToCanvasDelta(
  screenDelta: number,
  layoutPixels: number,
  screenPixels: number,
): number {
  if (!Number.isFinite(screenPixels) || screenPixels <= 0) return screenDelta;
  return screenDelta * (layoutPixels / screenPixels);
}

export function resolveResizeTarget(componentRoot: HTMLElement): HTMLElement {
  return (
    componentRoot.querySelector<HTMLElement>("[data-wai-flexible-layout]") ??
    componentRoot
  );
}
