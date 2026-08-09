"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { registerOverlayPortal, usePuck } from "@puck-editor";
import { AlignCenter, Maximize2, Minimize2, RotateCcw } from "lucide-react";

import {
  pixelsToFlexibleLength,
  updateComponentLayout,
  type FlexibleLayout,
} from "@/lib/puck/flexible-layout";
import {
  resolveResizeTarget,
  screenDeltaToCanvasDelta,
} from "@/lib/puck/resize-interaction";

type ResizeDirection = -1 | 0 | 1;

const RESET_PATCH: Partial<FlexibleLayout> = {
  width: undefined,
  height: undefined,
  minWidth: undefined,
  minHeight: undefined,
  maxWidth: undefined,
  maxHeight: undefined,
  offsetX: undefined,
  offsetY: undefined,
  grow: undefined,
  shrink: undefined,
  align: undefined,
};

export function PuckResizableOverlay({
  children,
  componentId,
  isSelected,
  snapEnabled,
}: {
  children: ReactNode;
  componentId: string;
  componentType: string;
  hover: boolean;
  isSelected: boolean;
  snapEnabled: boolean;
}) {
  const { dispatch, getItemById } = usePuck();
  const [measurement, setMeasurement] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const commit = useCallback(
    (patch: Partial<FlexibleLayout>) => {
      dispatch({
        type: "setData",
        data: (current) => updateComponentLayout(current, componentId, patch),
      });
    },
    [componentId, dispatch],
  );

  const startResize = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      xDirection: ResizeDirection,
      yDirection: ResizeDirection,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      cleanupRef.current?.();

      const handle = event.currentTarget;
      const ownerDocument = handle.ownerDocument;
      const ownerWindow = ownerDocument.defaultView;
      if (!ownerWindow) return;
      const escapedId = ownerWindow.CSS?.escape
        ? ownerWindow.CSS.escape(componentId)
        : componentId.replace(/["\\]/g, "\\$&");
      const componentRoot = ownerDocument.querySelector<HTMLElement>(
        `[data-puck-component="${escapedId}"]`,
      );
      if (!componentRoot) return;
      // Puck owns the outer selection wrapper. FlexibleLayoutBox owns the
      // persisted size. Previewing a resize on the wrapper and saving it on
      // the inner box causes the element to jump back on pointer release.
      const target = resolveResizeTarget(componentRoot);

      const component = getItemById(componentId);
      const layout = (component?.props.layout ?? {}) as FlexibleLayout;
      const rect = target.getBoundingClientRect();
      const parent = target.parentElement;
      const parentRect = parent?.getBoundingClientRect();
      const computed = ownerWindow.getComputedStyle(target);
      const rootFontSize = Number.parseFloat(
        ownerWindow.getComputedStyle(ownerDocument.documentElement).fontSize,
      );
      const context = {
        parentWidth: parentRect?.width,
        parentHeight: parentRect?.height,
        viewportWidth: ownerWindow.innerWidth,
        viewportHeight: ownerWindow.innerHeight,
        rootFontSize,
        fontSize: Number.parseFloat(computed.fontSize) || rootFontSize,
      };
      const start = {
        x: event.clientX,
        y: event.clientY,
        width: target.offsetWidth,
        height: target.offsetHeight,
        offsetX: Number.parseFloat(computed.insetInlineStart) || 0,
        offsetY: Number.parseFloat(computed.top) || 0,
      };
      const original = {
        width: target.style.width,
        height: target.style.height,
        insetInlineStart: target.style.insetInlineStart,
        top: target.style.top,
        transition: target.style.transition,
      };
      const siblings = parent
        ? Array.from(parent.children)
            .filter(
              (item): item is HTMLElement =>
                item instanceof ownerWindow.HTMLElement && item !== target,
            )
            .map((item) => ({
              width: item.offsetWidth,
              height: item.offsetHeight,
            }))
        : [];
      const guides = {
        width: [
          parent?.clientWidth,
          ...siblings.map((item) => item.width),
        ].filter(
          (value): value is number => typeof value === "number" && value > 0,
        ),
        height: [
          parent?.clientHeight,
          ...siblings.map((item) => item.height),
        ].filter(
          (value): value is number => typeof value === "number" && value > 0,
        ),
      };
      let lockedWidth: number | null = null;
      let lockedHeight: number | null = null;
      let pending: Partial<FlexibleLayout> = {};

      const snap = (
        value: number,
        axis: "width" | "height",
        altKey: boolean,
      ) => {
        if (!snapEnabled || altKey) return value;
        const locked = axis === "width" ? lockedWidth : lockedHeight;
        if (locked !== null && Math.abs(locked - value) <= 14) return locked;
        if (axis === "width") lockedWidth = null;
        else lockedHeight = null;
        const nearest = guides[axis].reduce<number | null>((best, guide) => {
          if (Math.abs(guide - value) > 6) return best;
          return best === null ||
            Math.abs(guide - value) < Math.abs(best - value)
            ? guide
            : best;
        }, null);
        if (axis === "width") lockedWidth = nearest;
        else lockedHeight = nearest;
        return nearest ?? value;
      };

      target.style.transition = "none";
      ownerDocument.body.style.userSelect = "none";
      handle.setPointerCapture?.(event.pointerId);

      const move = (moveEvent: PointerEvent) => {
        const next: Partial<FlexibleLayout> = {};
        let width = start.width;
        let height = start.height;
        if (xDirection !== 0) {
          width = snap(
            Math.max(
              24,
              Math.round(
                start.width +
                  screenDeltaToCanvasDelta(
                    moveEvent.clientX - start.x,
                    target.offsetWidth,
                    rect.width,
                  ) *
                    xDirection,
              ),
            ),
            "width",
            moveEvent.altKey,
          );
          next.width = pixelsToFlexibleLength(
            width,
            layout.width,
            "width",
            context,
          );
          target.style.width = `${width}px`;
          if (xDirection < 0) {
            const offsetX = start.offsetX + start.width - width;
            next.offsetX = `${Math.round(offsetX)}px`;
            target.style.insetInlineStart = `${offsetX}px`;
          }
        }
        if (yDirection !== 0) {
          height = snap(
            Math.max(
              16,
              Math.round(
                start.height +
                  screenDeltaToCanvasDelta(
                    moveEvent.clientY - start.y,
                    target.offsetHeight,
                    rect.height,
                  ) *
                    yDirection,
              ),
            ),
            "height",
            moveEvent.altKey,
          );
          next.height = pixelsToFlexibleLength(
            height,
            layout.height,
            "height",
            context,
          );
          target.style.height = `${height}px`;
          if (yDirection < 0) {
            const offsetY = start.offsetY + start.height - height;
            next.offsetY = `${Math.round(offsetY)}px`;
            target.style.top = `${offsetY}px`;
          }
        }
        pending = next;
        setMeasurement(`${Math.round(width)} × ${Math.round(height)}`);
      };

      const finish = () => {
        ownerWindow.removeEventListener("pointermove", move);
        ownerWindow.removeEventListener("pointerup", finish);
        ownerWindow.removeEventListener("pointercancel", finish);
        ownerDocument.body.style.userSelect = "";
        target.style.transition = original.transition;
        if (Object.keys(pending).length > 0) commit(pending);
        else {
          target.style.width = original.width;
          target.style.height = original.height;
          target.style.insetInlineStart = original.insetInlineStart;
          target.style.top = original.top;
        }
        setMeasurement(null);
        cleanupRef.current = null;
      };

      cleanupRef.current = finish;
      ownerWindow.addEventListener("pointermove", move);
      ownerWindow.addEventListener("pointerup", finish, { once: true });
      ownerWindow.addEventListener("pointercancel", finish, { once: true });
    },
    [commit, componentId, getItemById, snapEnabled],
  );

  if (!isSelected) return <>{children}</>;

  const handles = [
    [-1, -1, "top left"],
    [1, -1, "top right"],
    [-1, 1, "bottom left"],
    [1, 1, "bottom right"],
  ] as const;
  const edges = [
    [0, -1, "top"],
    [1, 0, "right"],
    [0, 1, "bottom"],
    [-1, 0, "left"],
  ] as const;

  return (
    <>
      {children}
      {handles.map(([x, y, label]) => (
        <button
          key={label}
          ref={(node) => registerOverlayPortal(node, { disableDrag: true })}
          type="button"
          aria-label={`Resize ${label}`}
          onPointerDown={(event) => startResize(event, x, y)}
          className="pointer-events-auto absolute size-3 rounded-[3px] border-2 border-white bg-blue-600 shadow-sm"
          style={{
            left: x < 0 ? -6 : undefined,
            right: x > 0 ? -6 : undefined,
            top: y < 0 ? -6 : undefined,
            bottom: y > 0 ? -6 : undefined,
            cursor: x === y ? "nwse-resize" : "nesw-resize",
          }}
        />
      ))}
      {edges.map(([x, y, label]) => (
        <button
          key={label}
          ref={(node) => registerOverlayPortal(node, { disableDrag: true })}
          type="button"
          aria-label={`Resize ${label} edge`}
          onPointerDown={(event) => startResize(event, x, y)}
          className={`pointer-events-auto absolute bg-transparent ${x === 0 ? "h-3 cursor-ns-resize" : "w-3 cursor-ew-resize"}`}
          style={{
            left: x < 0 ? -6 : x > 0 ? undefined : 10,
            right: x > 0 ? -6 : x < 0 ? undefined : 10,
            top: y < 0 ? -6 : y > 0 ? undefined : 10,
            bottom: y > 0 ? -6 : y < 0 ? undefined : 10,
          }}
        />
      ))}
      <div
        ref={(node) => registerOverlayPortal(node, { disableDrag: true })}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        className="pointer-events-auto absolute -top-10 left-0 flex items-center rounded-md border border-black/10 bg-white p-0.5 text-zinc-700 shadow-sm"
      >
        <button
          type="button"
          onClick={() =>
            commit({
              width: "auto",
              height: "auto",
              offsetX: "0px",
              offsetY: "0px",
            })
          }
          className="grid size-7 place-items-center rounded hover:bg-zinc-100"
          aria-label="Fit component to content"
          title="Fit to content"
        >
          <Minimize2 className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() =>
            commit({ width: "100%", offsetX: "0px", align: "stretch" })
          }
          className="grid size-7 place-items-center rounded hover:bg-zinc-100"
          aria-label="Fill parent width"
          title="Fill parent width"
        >
          <Maximize2 className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => commit({ align: "center", offsetX: "0px" })}
          className="grid size-7 place-items-center rounded hover:bg-zinc-100"
          aria-label="Center in parent"
          title="Center in parent"
        >
          <AlignCenter className="size-3.5" />
        </button>
        <span className="mx-0.5 h-4 w-px bg-zinc-200" />
        <button
          type="button"
          onClick={() => commit(RESET_PATCH)}
          className="grid size-7 place-items-center rounded hover:bg-zinc-100"
          aria-label="Reset component size"
          title="Reset component size"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>
      {measurement ? (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded bg-zinc-950 px-2 py-1 font-mono text-[10px] text-white shadow-sm">
          {measurement}
        </div>
      ) : null}
    </>
  );
}
