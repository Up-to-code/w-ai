"use client";

import type { ReactNode } from "react";
import type { FieldProps } from "@puckeditor/core";

import {
  DEFAULT_FLEXIBLE_LAYOUT,
  withFlexibleLayoutDefaults,
  type FlexibleLayout,
} from "@/lib/puck/flexible-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { LayoutLengthControl } from "./layout-length-control";

const ALIGNMENTS = ["start", "center", "end", "stretch"] as const;

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </div>
  );
}

export function LayoutInspectorControl({
  value,
  onChange,
}: Pick<FieldProps, "value" | "onChange">) {
  const layout = withFlexibleLayoutDefaults(value);
  const update = (patch: Partial<FlexibleLayout>) =>
    onChange({ ...layout, ...patch });

  return (
    <div className="space-y-3 rounded-lg border bg-background p-3">
      <div>
        <SectionTitle>Size</SectionTitle>
        <div className="space-y-1.5">
          <LayoutLengthControl
            label="Width"
            value={layout.width}
            onChange={(width) => update({ width })}
          />
          <LayoutLengthControl
            label="Height"
            value={layout.height}
            onChange={(height) => update({ height })}
          />
        </div>
      </div>

      <div>
        <SectionTitle>Align in parent</SectionTitle>
        <div className="grid grid-cols-4 gap-1 rounded-md bg-muted p-1">
          {ALIGNMENTS.map((alignment) => (
            <Button
              key={alignment}
              type="button"
              size="sm"
              variant={layout.align === alignment ? "secondary" : "ghost"}
              className="h-7 px-1 text-[10px] capitalize"
              onClick={() => update({ align: alignment })}
            >
              {alignment}
            </Button>
          ))}
        </div>
      </div>

      <details className="group border-t pt-2">
        <summary className="cursor-pointer list-none text-xs font-medium marker:hidden">
          Constraints
          <span className="float-end text-muted-foreground group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <div className="mt-2 space-y-1.5">
          <LayoutLengthControl
            label="Min W"
            value={layout.minWidth}
            onChange={(minWidth) => update({ minWidth })}
          />
          <LayoutLengthControl
            label="Max W"
            value={layout.maxWidth}
            onChange={(maxWidth) => update({ maxWidth })}
          />
          <LayoutLengthControl
            label="Min H"
            value={layout.minHeight}
            onChange={(minHeight) => update({ minHeight })}
          />
          <LayoutLengthControl
            label="Max H"
            value={layout.maxHeight}
            onChange={(maxHeight) => update({ maxHeight })}
          />
        </div>
      </details>

      <details className="group border-t pt-2">
        <summary className="cursor-pointer list-none text-xs font-medium marker:hidden">
          Position & flex
          <span className="float-end text-muted-foreground group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <div className="mt-2 space-y-1.5">
          <LayoutLengthControl
            label="X"
            value={layout.offsetX}
            onChange={(offsetX) => update({ offsetX })}
          />
          <LayoutLengthControl
            label="Y"
            value={layout.offsetY}
            onChange={(offsetY) => update({ offsetY })}
          />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <label className="space-y-1 text-[11px] text-muted-foreground">
              Grow
              <Input
                type="number"
                min={0}
                step={1}
                value={layout.grow ?? 0}
                onChange={(event) =>
                  update({ grow: Number(event.target.value) })
                }
                className="h-8 text-xs"
              />
            </label>
            <label className="space-y-1 text-[11px] text-muted-foreground">
              Shrink
              <Input
                type="number"
                min={0}
                step={1}
                value={layout.shrink ?? 1}
                onChange={(event) =>
                  update({ shrink: Number(event.target.value) })
                }
                className="h-8 text-xs"
              />
            </label>
          </div>
        </div>
      </details>

      <div className="grid grid-cols-3 gap-1 border-t pt-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[10px]"
          onClick={() => update({ width: "auto", height: "auto", grow: 0 })}
        >
          Fit
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[10px]"
          onClick={() => update({ width: "100%", height: "auto", grow: 1 })}
        >
          Fill
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[10px]"
          onClick={() => onChange({ ...DEFAULT_FLEXIBLE_LAYOUT })}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
