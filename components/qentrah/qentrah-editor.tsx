"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/routing";
import {
  Element as CraftElement,
  Editor,
  Frame,
  useEditor,
  useNode,
} from "@craftjs/core";
import { Layers } from "@craftjs/layers";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Columns3,
  Database,
  Eye,
  Globe2,
  GripVertical,
  Layers3,
  LayoutGrid,
  LayoutTemplate,
  Library,
  Link2,
  Loader2,
  Magnet,
  Minus,
  Monitor,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Smartphone,
  Tablet,
  Trash2,
  Type,
  Undo2,
  Unlink2,
  UploadCloud,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import {
  isLegacyPuckPageData,
  legacyPageKey,
} from "@/lib/qentrah/legacy-page-data";
import {
  createQentrahPageData,
  isQentrahPageData,
} from "@/lib/qentrah/page-data";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { QentrahColorPicker } from "@/components/qentrah/color-picker-field";
import { LegacyPageAdapter } from "@/components/qentrah/legacy-page-adapter";
import { ThemePanel } from "@/components/qentrah/theme-panel";

import {
  QBody,
  QButton,
  QContainer,
  QENTRAH_RESOLVER,
  QentrahViewportProvider,
  QSection,
  QText,
  type QentrahDevice,
} from "./editor-nodes";

type Device = QentrahDevice;
type EditScope = "all" | Device;
type SidebarArea =
  "elements" | "collections" | "libraries" | "theme" | "layers";
const DEVICE_WIDTHS: Record<Device, number> = {
  desktop: 1200,
  tablet: 768,
  mobile: 390,
};

type EditorLabels = {
  back: string;
  save: string;
  preview: string;
  publish: string;
  unpublish: string;
  saved: string;
  saveError: string;
  saving: string;
  notFound: string;
};

type PageEditorProps = {
  locale: "ar" | "en";
  orgId: Id<"organizations">;
  orgSlug: string;
  pageSlug: string;
  initialTitle: Record<string, string>;
  initialPublished: boolean;
  initialData: unknown;
  labels: EditorLabels;
};

function StarterPage({ title, slug }: { title: string; slug: string }) {
  return (
    <CraftElement
      is={QBody}
      canvas
      background="#ffffff"
      minHeight="100vh"
      custom={{ displayName: "Body" }}
    >
      <CraftElement
        is={QSection}
        canvas
        background="#ffffff"
        padding={0}
        gap={0}
        minHeight={620}
        responsive={{
          tablet: { padding: 0, gap: 0, minHeight: "auto" },
          mobile: { padding: 0, gap: 0, minHeight: "auto" },
        }}
        custom={{ displayName: "Hero section" }}
      >
        <CraftElement
          is={QContainer}
          canvas
          layout="container"
          maxWidth="1200px"
          paddingTop={64}
          paddingRight={64}
          paddingBottom={64}
          paddingLeft={64}
          gap={28}
          minHeight={620}
          responsive={{
            tablet: {
              paddingTop: 40,
              paddingRight: 40,
              paddingBottom: 40,
              paddingLeft: 40,
              gap: 22,
              minHeight: "auto",
            },
            mobile: {
              paddingTop: 24,
              paddingRight: 20,
              paddingBottom: 24,
              paddingLeft: 20,
              gap: 18,
              minHeight: "auto",
            },
          }}
          custom={{ displayName: "Hero container" }}
        >
          <QText
            as="h1"
            text={title}
            fontSize={52}
            weight={700}
            responsive={{ tablet: { fontSize: 42 }, mobile: { fontSize: 34 } }}
          />
          <QText
            text={`/${slug}`}
            fontSize={20}
            color="#52525b"
            responsive={{ mobile: { fontSize: 17 } }}
          />
          <QButton text="Add your first section" href="#start" />
          <CraftElement
            is={QContainer}
            canvas
            layout="grid"
            columns="repeat(3, minmax(0, 1fr))"
            maxWidth="100%"
            paddingTop={16}
            paddingRight={16}
            paddingBottom={16}
            paddingLeft={16}
            gap={16}
            responsive={{
              tablet: { columns: "repeat(2, minmax(0, 1fr))" },
              mobile: { columns: "minmax(0, 1fr)" },
            }}
            custom={{ displayName: "Feature grid" }}
          >
            <QText
              as="h3"
              text="Start with structure"
              fontSize={18}
              weight={650}
            />
            <QText as="h3" text="Add your content" fontSize={18} weight={650} />
            <QText
              as="h3"
              text="Publish when ready"
              fontSize={18}
              weight={650}
            />
          </CraftElement>
        </CraftElement>
      </CraftElement>
    </CraftElement>
  );
}

const InspectorDeviceContext = createContext<{
  device: Device;
  setDevice: (device: Device) => void;
  scope: EditScope;
  setScope: (scope: EditScope) => void;
  snapEnabled: boolean;
  setSnapEnabled: (enabled: boolean) => void;
} | null>(null);

function setScopedPropsDraft(
  draft: Record<string, unknown>,
  scope: EditScope,
  updates: Record<string, unknown>,
) {
  if (scope === "all") {
    Object.assign(draft, updates);
    const responsive = {
      ...((draft.responsive ?? {}) as Partial<
        Record<Device, Record<string, unknown>>
      >),
    };
    for (const device of ["desktop", "tablet", "mobile"] as const) {
      const deviceValues = { ...(responsive[device] ?? {}) };
      for (const key of Object.keys(updates)) delete deviceValues[key];
      if (Object.keys(deviceValues).length > 0)
        responsive[device] = deviceValues;
      else delete responsive[device];
    }
    draft.responsive = responsive;
    return;
  }
  const responsive = {
    ...((draft.responsive ?? {}) as Partial<
      Record<Device, Record<string, unknown>>
    >),
  };
  responsive[scope] = {
    ...(responsive[scope] ?? {}),
    ...updates,
  };
  draft.responsive = responsive;
}

function QuickNode({ render }: { render: ReactElement }) {
  const { id, connectors, actions: nodeActions } = useNode();
  const responsiveContext = useContext(InspectorDeviceContext);
  const scope = responsiveContext?.scope ?? "all";
  const snapEnabled = responsiveContext?.snapEnabled ?? true;
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const outlineRef = useRef<HTMLDivElement | null>(null);
  const naturalSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [edgeZone, setEdgeZone] = useState<"top" | "bottom" | null>(null);
  const {
    selected,
    hovered,
    dom,
    name,
    componentType,
    parent,
    deletable,
    draggable,
    enabled,
    hasSelection,
    quickColor,
    quickColorKey,
    currentWidth,
    currentMinHeight,
    currentOffsetX,
    currentOffsetY,
    actions,
    query,
  } = useEditor((state, query) => {
    const node = state.nodes[id];
    const nodeProps = (node?.data.props ?? {}) as Record<string, unknown>;
    const responsive = (nodeProps.responsive ?? {}) as Partial<
      Record<Device, Record<string, unknown>>
    >;
    const effectiveProps =
      scope === "all"
        ? nodeProps
        : { ...nodeProps, ...(responsive[scope] ?? {}) };
    return {
      selected: state.events.selected.has(id),
      hovered: state.events.hovered.has(id),
      dom: node?.dom,
      name:
        node?.data.custom?.displayName || node?.data.displayName || "Component",
      componentType: node?.data.displayName || "Component",
      parent: node?.data.parent,
      deletable: query.node(id).isDeletable(),
      draggable: query.node(id).isDraggable(),
      enabled: state.options.enabled,
      hasSelection: state.events.selected.size > 0,
      quickColorKey: Object.prototype.hasOwnProperty.call(
        nodeProps,
        "background",
      )
        ? "background"
        : Object.prototype.hasOwnProperty.call(nodeProps, "color")
          ? "color"
          : null,
      quickColor: String(
        effectiveProps.background ?? effectiveProps.color ?? "#ffffff",
      ),
      currentWidth: effectiveProps.width,
      currentMinHeight: effectiveProps.minHeight,
      currentOffsetX: effectiveProps.offsetX,
      currentOffsetY: effectiveProps.offsetY,
    };
  });
  const visible = enabled && (selected || (hovered && !hasSelection));

  const position = useCallback(() => {
    if (!dom) return;
    const rect = dom.getBoundingClientRect();
    if (toolbarRef.current) {
      toolbarRef.current.style.left = `${Math.max(8, rect.left)}px`;
      toolbarRef.current.style.top =
        edgeZone === "bottom"
          ? `${Math.min(window.innerHeight - 40, rect.bottom + 6)}px`
          : `${Math.max(8, rect.top - 34)}px`;
    }
    if (outlineRef.current) {
      outlineRef.current.style.left = `${rect.left}px`;
      outlineRef.current.style.top = `${rect.top}px`;
      outlineRef.current.style.width = `${rect.width}px`;
      outlineRef.current.style.height = `${rect.height}px`;
    }
  }, [dom, edgeZone]);

  const startResize = (
    event: React.PointerEvent<HTMLButtonElement>,
    xDirection: -1 | 0 | 1,
    yDirection: -1 | 0 | 1,
  ) => {
    if (!dom) return;
    event.preventDefault();
    event.stopPropagation();
    const resizeHandle = event.currentTarget;
    resizeHandle.setPointerCapture?.(event.pointerId);
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = dom.offsetWidth;
    const startHeight = dom.offsetHeight;
    const originalInline = {
      width: dom.style.width,
      minHeight: dom.style.minHeight,
      left: dom.style.left,
      top: dom.style.top,
      transition: dom.style.transition,
    };
    const scaleX = startWidth / Math.max(1, dom.getBoundingClientRect().width);
    const scaleY =
      startHeight / Math.max(1, dom.getBoundingClientRect().height);
    const parentDom = parent ? query.node(parent).get()?.dom : null;
    const parentComputedStyle = parentDom ? getComputedStyle(parentDom) : null;
    const parentContentWidth = parentDom
      ? Math.max(
          0,
          parentDom.clientWidth -
            Number.parseFloat(parentComputedStyle?.paddingLeft || "0") -
            Number.parseFloat(parentComputedStyle?.paddingRight || "0"),
        )
      : undefined;
    const parentContentHeight = parentDom
      ? Math.max(
          0,
          parentDom.clientHeight -
            Number.parseFloat(parentComputedStyle?.paddingTop || "0") -
            Number.parseFloat(parentComputedStyle?.paddingBottom || "0"),
        )
      : undefined;
    const siblingSizes = parent
      ? (query
          .node(parent)
          .get()
          ?.data.nodes.filter((nodeId) => nodeId !== id)
          .map((nodeId) => query.node(nodeId).get()?.dom)
          .filter((node): node is HTMLElement => Boolean(node)) ?? [])
      : [];
    const widthGuides = [
      parentContentWidth,
      ...siblingSizes.map((node) => node.offsetWidth),
    ].filter((value): value is number => typeof value === "number");
    const heightGuides = [
      parentContentHeight,
      ...siblingSizes.map((node) => node.offsetHeight),
    ].filter((value): value is number => typeof value === "number");
    let snappedWidth: number | null = null;
    let snappedHeight: number | null = null;
    const snap = (
      value: number,
      guides: number[],
      axis: "width" | "height",
    ) => {
      if (!snapEnabled) return value;
      const locked = axis === "width" ? snappedWidth : snappedHeight;
      // Once a guide captures the handle, keep it captured until the pointer
      // clearly leaves the guide. A single threshold makes the value oscillate
      // on/off at the boundary and feels like the component is fighting back.
      if (locked !== null && Math.abs(locked - value) <= 14) return locked;
      if (axis === "width") snappedWidth = null;
      else snappedHeight = null;
      const nearest = guides.reduce<number | null>((best, guide) => {
        if (Math.abs(guide - value) > 6) return best;
        return best === null || Math.abs(guide - value) < Math.abs(best - value)
          ? guide
          : best;
      }, null);
      if (axis === "width") snappedWidth = nearest;
      else snappedHeight = nearest;
      return nearest ?? value;
    };
    const preserveUnit = (
      pixels: number,
      current: unknown,
      axis: "width" | "height",
    ): LengthValue => {
      const parsed = parseLength(current);
      if (parsed.keyword || parsed.unit === "px") return pixels;
      const base =
        parsed.unit === "%"
          ? axis === "width"
            ? parentContentWidth
            : parentContentHeight
          : parsed.unit === "vw"
            ? window.innerWidth
            : parsed.unit === "vh"
              ? window.innerHeight
              : Number.parseFloat(
                  getComputedStyle(document.documentElement).fontSize,
                );
      return base
        ? `${Math.round((pixels / base) * (parsed.unit === "%" || parsed.unit === "vw" || parsed.unit === "vh" ? 10000 : 100)) / 100}${parsed.unit}`
        : pixels;
    };

    const lengthToPixels = (current: unknown, axis: "width" | "height") => {
      const parsed = parseLength(current);
      if (parsed.keyword) return 0;
      if (parsed.unit === "px") return parsed.amount;
      const base =
        parsed.unit === "%"
          ? axis === "width"
            ? parentContentWidth
            : parentContentHeight
          : parsed.unit === "vw"
            ? window.innerWidth
            : parsed.unit === "vh"
              ? window.innerHeight
              : Number.parseFloat(
                  getComputedStyle(document.documentElement).fontSize,
                );
      if (!base) return 0;
      return (
        (parsed.amount * base) /
        (parsed.unit === "%" || parsed.unit === "vw" || parsed.unit === "vh"
          ? 100
          : 1)
      );
    };

    const startOffsetX = lengthToPixels(currentOffsetX, "width");
    const startOffsetY = lengthToPixels(currentOffsetY, "height");
    let pendingUpdates: Record<string, unknown> = {};
    let pendingFinalUpdates: Record<string, unknown> = {};
    dom.style.transition = "none";
    document.body.style.userSelect = "none";

    const move = (moveEvent: PointerEvent) => {
      const updates: Record<string, unknown> = {};
      const finalUpdates: Record<string, unknown> = {};
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      if (xDirection !== 0 && Math.abs(deltaX) >= 2) {
        const widthPixels = snap(
          Math.max(48, Math.round(startWidth + deltaX * xDirection * scaleX)),
          widthGuides,
          "width",
        );
        // Pixels are the stable interaction unit. Converting to percentages on
        // every pointermove makes React and the direct preview round each other
        // differently, producing visible back-and-forth movement.
        updates.width = widthPixels;
        finalUpdates.width = preserveUnit(widthPixels, currentWidth, "width");
        dom.style.width = `${widthPixels}px`;
        if (xDirection < 0) {
          const offsetX = startOffsetX + (startWidth - widthPixels);
          updates.offsetX = offsetX;
          finalUpdates.offsetX = offsetX;
          dom.style.left = `${offsetX}px`;
        }
      }
      if (yDirection !== 0 && Math.abs(deltaY) >= 4) {
        const heightPixels = snap(
          Math.max(24, Math.round(startHeight + deltaY * yDirection * scaleY)),
          heightGuides,
          "height",
        );
        updates.minHeight = heightPixels;
        finalUpdates.minHeight = preserveUnit(
          heightPixels,
          currentMinHeight,
          "height",
        );
        dom.style.minHeight = `${heightPixels}px`;
        if (yDirection < 0) {
          const offsetY = startOffsetY + (startHeight - heightPixels);
          updates.offsetY = offsetY;
          finalUpdates.offsetY = offsetY;
          dom.style.top = `${offsetY}px`;
        }
      }
      pendingUpdates = updates;
      pendingFinalUpdates = finalUpdates;
      // Keep Craft's node state synchronized with the live preview throughout
      // the gesture. The history throttle keeps this as one undo step. This
      // removes the fragile second source of truth that previously existed
      // between pointermove and pointerup.
      nodeActions.setProp((props: Record<string, unknown>) => {
        setScopedPropsDraft(props, scope, updates);
      }, 750);
      position();
    };
    const restorePreview = () => {
      dom.style.width = originalInline.width;
      dom.style.minHeight = originalInline.minHeight;
      dom.style.left = originalInline.left;
      dom.style.top = originalInline.top;
      dom.style.transition = originalInline.transition;
      document.body.style.userSelect = "";
    };
    const finishPreview = () => {
      // Keep the previewed geometry in place while Craft commits the same values.
      // Restoring width/height here creates a visible collapse between pointerup
      // and React's next render, especially at a non-100% browser zoom.
      dom.style.transition = originalInline.transition;
      document.body.style.userSelect = "";
    };
    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", cancel);
      if (resizeHandle.hasPointerCapture?.(pointerId))
        resizeHandle.releasePointerCapture(pointerId);
      if (commit && Object.keys(pendingUpdates).length > 0) {
        nodeActions.setProp((props: Record<string, unknown>) => {
          setScopedPropsDraft(props, scope, pendingFinalUpdates);
        }, 750);
        finishPreview();
      } else {
        restorePreview();
      }
    };
    // The last pointermove already represents the geometry visible to the user.
    // Pointerup/pointercancel coordinates can be remapped when the portal handle
    // moves inside a zoomed canvas; recalculating from them caused the width to
    // jump back toward the parent's 100% width on release.
    const stop = () => finish(true);
    // A moving portal handle can receive pointercancel in some browsers when it
    // crosses a zoomed canvas boundary. Preserve the last intentional preview
    // instead of treating that browser cancellation as an undo.
    const cancel = () => finish(true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
  };

  useEffect(() => {
    if (!visible || !dom) return;
    naturalSizeRef.current ??= {
      width: dom.offsetWidth,
      height: dom.offsetHeight,
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(dom);
    document.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      observer.disconnect();
      document.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [dom, position, visible]);

  useEffect(() => {
    if (!selected || !dom) {
      setEdgeZone(null);
      return;
    }
    const trackEdgeProximity = (event: PointerEvent) => {
      if (quickAddOpen || renaming) return;
      const rect = dom.getBoundingClientRect();
      const insideX = event.clientX >= rect.left && event.clientX <= rect.right;
      const topLimit = rect.top + rect.height * 0.2;
      const bottomLimit = rect.bottom - rect.height * 0.2;
      if (
        insideX &&
        event.clientY >= rect.top - 44 &&
        event.clientY <= topLimit
      )
        setEdgeZone("top");
      else if (
        insideX &&
        event.clientY >= bottomLimit &&
        event.clientY <= rect.bottom + 44
      )
        setEdgeZone("bottom");
      else setEdgeZone(null);
    };
    document.addEventListener("pointermove", trackEdgeProximity);
    return () =>
      document.removeEventListener("pointermove", trackEdgeProximity);
  }, [dom, quickAddOpen, renaming, selected]);

  useEffect(() => {
    if (
      !dom ||
      !enabled ||
      (componentType !== "Text" && componentType !== "Button")
    )
      return;
    const enterInlineEditing = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      actions.selectNode(id);
      const originalText = dom.textContent ?? "";
      const draggableAncestors = Array.from(
        dom.parentElement?.querySelectorAll<HTMLElement>(
          "[draggable='true']",
        ) ?? [],
      ).filter((element) => element.contains(dom));
      draggableAncestors.forEach((element) =>
        element.setAttribute("draggable", "false"),
      );
      dom.contentEditable = "true";
      dom.dataset.qentrahEditing = "true";
      dom.focus();
      const selection = window.getSelection();
      if (selection) {
        const range = document.caretRangeFromPoint(
          event.clientX,
          event.clientY,
        );
        selection.removeAllRanges();
        if (range && dom.contains(range.startContainer)) {
          selection.addRange(range);
          selection.modify("move", "backward", "word");
          selection.modify("extend", "forward", "word");
        } else {
          const fallbackRange = document.createRange();
          fallbackRange.selectNodeContents(dom);
          selection.addRange(fallbackRange);
        }
      }
      let finished = false;
      const finish = (save: boolean) => {
        if (finished) return;
        finished = true;
        const nextText = save ? (dom.textContent ?? "") : originalText;
        dom.removeEventListener("keydown", onKeyDown);
        dom.removeEventListener("blur", onBlur);
        dom.textContent = nextText;
        dom.contentEditable = "false";
        delete dom.dataset.qentrahEditing;
        draggableAncestors.forEach((element) =>
          element.setAttribute("draggable", "true"),
        );
        if (save) {
          actions.setProp(id, (draft: Record<string, unknown>) => {
            setScopedPropsDraft(draft, scope, { text: nextText });
          });
        }
      };
      function onKeyDown(keyEvent: KeyboardEvent) {
        if (keyEvent.key === "Escape") {
          keyEvent.preventDefault();
          finish(false);
          dom.blur();
        }
        if (
          componentType === "Button" &&
          keyEvent.key === "Enter" &&
          !keyEvent.shiftKey
        ) {
          keyEvent.preventDefault();
          finish(true);
          dom.blur();
        }
      }
      function onBlur() {
        finish(true);
      }
      dom.addEventListener("keydown", onKeyDown, { once: false });
      dom.addEventListener("blur", onBlur, { once: true });
    };
    dom.addEventListener("dblclick", enterInlineEditing);
    return () => dom.removeEventListener("dblclick", enterInlineEditing);
  }, [actions, componentType, dom, enabled, id, scope]);

  useEffect(() => {
    if (!dom || !enabled || !selected || !draggable || !parent) return;
    if (["Text", "Button", "Image", "Video"].includes(componentType)) return;
    const startCanvasMove = (event: PointerEvent) => {
      if (event.button !== 0 || dom.dataset.qentrahEditing === "true") return;
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "[contenteditable='true'], input, textarea, select, a, button, img, video, picture, p, h1, h2, h3, h4, h5, h6",
        )
      )
        return;
      const startX = event.clientX;
      const startY = event.clientY;
      let moving = false;
      let drop: ReturnType<typeof query.getDropPlaceholder> | null | undefined;
      const findTargetNode = (x: number, y: number) => {
        const nodes = query.getNodes();
        let element = document.elementFromPoint(x, y) as HTMLElement | null;
        while (element) {
          const match = Object.values(nodes).find(
            (candidate) => candidate.id !== id && candidate.dom === element,
          );
          if (match) return match.id;
          element = element.parentElement;
        }
        return parent;
      };
      const move = (moveEvent: PointerEvent) => {
        if (
          !moving &&
          Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6
        )
          return;
        if (!moving) {
          moving = true;
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
        }
        moveEvent.preventDefault();
        const targetId = findTargetNode(moveEvent.clientX, moveEvent.clientY);
        if (!targetId) return;
        drop = query.getDropPlaceholder(id, targetId, {
          x: moveEvent.clientX,
          y: moveEvent.clientY,
        });
        actions.setIndicator(drop ?? null);
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        actions.setIndicator(null);
        if (moving && drop && !drop.error) {
          actions.move(
            id,
            drop.placement.parent.id,
            drop.placement.index + (drop.placement.where === "after" ? 1 : 0),
          );
        }
      };
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", stop, { once: true });
    };
    dom.addEventListener("pointerdown", startCanvasMove);
    return () => dom.removeEventListener("pointerdown", startCanvasMove);
  }, [
    actions,
    componentType,
    dom,
    draggable,
    enabled,
    id,
    parent,
    query,
    selected,
  ]);

  useEffect(() => {
    if (!dom || !enabled) return;
    const beginRename = (event: Event) => {
      if (componentType === "Text" || componentType === "Button") return;
      event.preventDefault();
      event.stopPropagation();
      actions.selectNode(id);
      setDraftName(name);
      setRenaming(true);
    };
    dom.addEventListener("dblclick", beginRename);
    return () => dom.removeEventListener("dblclick", beginRename);
  }, [actions, componentType, dom, enabled, id, name]);

  const commitName = () => {
    actions.setCustom(id, (custom) => {
      custom.displayName = draftName.trim() || name;
    });
    setRenaming(false);
  };

  const insertQuick = (kind: "section" | "container" | "text" | "button") => {
    const candidates = [id, ...query.node(id).ancestors()];
    const bodyId = candidates.find(
      (candidate) => query.node(candidate).get()?.data.displayName === "Body",
    );
    const canvasId = candidates.find(
      (candidate) => query.node(candidate).get()?.data.isCanvas,
    );
    const targetId = kind === "section" ? bodyId : canvasId;
    if (!targetId) return;
    const element =
      kind === "section" ? (
        <CraftElement
          is={QSection}
          canvas
          padding={48}
          gap={20}
          minHeight={180}
          custom={{ displayName: "New section" }}
        />
      ) : kind === "container" ? (
        <CraftElement
          is={QContainer}
          canvas
          padding={24}
          minHeight={100}
          custom={{ displayName: "Container" }}
        />
      ) : kind === "text" ? (
        <QText text="New text" />
      ) : (
        <QButton text="Button" href="#" />
      );
    const tree = query.parseReactElement(element).toNodeTree();
    const targetNode = query.node(targetId).get();
    const siblingIndex = targetNode.data.nodes.indexOf(id);
    const insertionIndex =
      kind === "section" && siblingIndex >= 0
        ? siblingIndex + 1
        : targetNode.data.nodes.length;
    actions.addNodeTree(tree, targetId, insertionIndex);
    actions.selectNode(tree.rootNodeId);
    setQuickAddOpen(false);
  };

  return (
    <>
      {render}
      {visible && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                ref={outlineRef}
                className={`pointer-events-none fixed z-[80] border-2 ${selected ? "border-blue-600" : "border-dashed border-blue-400/70"}`}
              >
                {selected
                  ? (
                      [
                        [-1, -1],
                        [1, -1],
                        [-1, 1],
                        [1, 1],
                      ] as const
                    ).map(([x, y]) => (
                      <button
                        key={`${x}-${y}`}
                        type="button"
                        aria-label={`Resize ${x < 0 ? "left" : "right"} ${y < 0 ? "top" : "bottom"}`}
                        onPointerDown={(event) => startResize(event, x, y)}
                        className="pointer-events-auto absolute size-3 rounded-sm border-2 border-white bg-blue-600 shadow-sm"
                        style={{
                          left: x < 0 ? -7 : undefined,
                          right: x > 0 ? -7 : undefined,
                          top: y < 0 ? -7 : undefined,
                          bottom: y > 0 ? -7 : undefined,
                          cursor: x === y ? "nwse-resize" : "nesw-resize",
                        }}
                      />
                    ))
                  : null}
                {selected
                  ? (
                      [
                        [0, -1, "top"],
                        [1, 0, "right"],
                        [0, 1, "bottom"],
                        [-1, 0, "left"],
                      ] as const
                    ).map(([x, y, edge]) => (
                      <button
                        key={edge}
                        type="button"
                        aria-label={`Resize ${edge} edge`}
                        onPointerDown={(event) => startResize(event, x, y)}
                        className={`pointer-events-auto absolute bg-transparent ${x === 0 ? "h-3 cursor-ns-resize" : "w-3 cursor-ew-resize"}`}
                        style={{
                          left: x < 0 ? -6 : x > 0 ? undefined : 12,
                          right: x > 0 ? -6 : x < 0 ? undefined : 12,
                          top: y < 0 ? -6 : y > 0 ? undefined : 12,
                          bottom: y > 0 ? -6 : y < 0 ? undefined : 12,
                        }}
                      />
                    ))
                  : null}
                <div
                  className={`absolute left-1/2 -translate-x-1/2 ${edgeZone === "bottom" ? "bottom-0 translate-y-1/2" : "top-0 -translate-y-1/2"} ${edgeZone || quickAddOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
                >
                  <button
                    type="button"
                    onClick={() => setQuickAddOpen((value) => !value)}
                    aria-label="Add after this component"
                    className="grid size-6 place-items-center rounded-full border-2 border-white bg-blue-600 text-white shadow-sm"
                  >
                    <Plus className="size-3" />
                  </button>
                  {quickAddOpen ? (
                    <div className="absolute left-1/2 top-7 z-[120] grid w-40 -translate-x-1/2 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 text-zinc-800 shadow-lg">
                      {(
                        [
                          ["section", "Section"],
                          ["container", "Container"],
                          ["text", "Text"],
                          ["button", "Button"],
                        ] as const
                      ).map(([kind, label]) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => insertQuick(kind)}
                          className="h-8 px-3 text-left text-xs hover:bg-blue-50 hover:text-blue-700"
                        >
                          Add {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div
                ref={toolbarRef}
                className={`fixed z-[90] flex h-8 items-center rounded-md bg-zinc-950 text-xs text-white shadow-lg transition-opacity ${selected && !edgeZone && !renaming ? "pointer-events-none opacity-0" : "opacity-100"}`}
              >
                {renaming ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={commitName}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitName();
                      if (event.key === "Escape") setRenaming(false);
                    }}
                    aria-label="Component name"
                    className="h-8 w-32 bg-transparent px-2.5 text-xs font-medium text-white outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() => {
                      setDraftName(name);
                      setRenaming(true);
                    }}
                    title="Double-click to rename"
                    className="max-w-40 truncate px-2.5 font-medium"
                  >
                    {name}
                  </button>
                )}
                {parent ? (
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center border-l border-white/15 hover:bg-white/10"
                    onClick={() => actions.selectNode(parent)}
                    aria-label="Select parent"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                ) : null}
                {deletable ? (
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center border-l border-white/15 hover:bg-red-500"
                    onClick={() => actions.delete(id)}
                    aria-label="Delete component"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
                {quickColorKey ? (
                  <span className="mx-1.5">
                    <QentrahColorPicker
                      compact
                      value={quickColor}
                      label={`Quick ${quickColorKey === "background" ? "background" : "text"} color`}
                      onChange={(color) =>
                        actions.setProp(
                          id,
                          (props: Record<string, unknown>) => {
                            setScopedPropsDraft(props, scope, {
                              [quickColorKey]: color,
                            });
                          },
                        )
                      }
                    />
                  </span>
                ) : null}
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center border-l border-white/15 hover:bg-white/10"
                  onClick={() => {
                    const natural = naturalSizeRef.current;
                    if (!natural) return;
                    actions.setProp(id, (props: Record<string, unknown>) => {
                      setScopedPropsDraft(props, scope, {
                        width: natural.width,
                        minHeight: natural.height,
                        offsetX: 0,
                        offsetY: 0,
                      });
                    });
                  }}
                  aria-label="Reset component size"
                  title="Reset component to its original size"
                >
                  <RotateCcw className="size-3.5" />
                </button>
                {draggable ? (
                  <button
                    ref={(node) => {
                      if (node) connectors.drag(node);
                    }}
                    type="button"
                    className="grid h-8 w-8 cursor-grab place-items-center border-l border-white/15 hover:bg-white/10 active:cursor-grabbing"
                    aria-label="Drag component"
                  >
                    <GripVertical className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

function ComponentPreview({ label }: { label: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5 };
  const normalized = label.toLowerCase();
  if (normalized.includes("hero")) {
    return (
      <svg viewBox="0 0 72 52" className="h-12 w-full" aria-hidden="true">
        <rect x="4" y="4" width="64" height="44" rx="3" {...common} />
        <path d="M12 15h29M12 21h20M12 30h15" {...common} />
        <rect x="12" y="35" width="17" height="6" rx="2" {...common} />
      </svg>
    );
  }
  if (normalized.includes("feature")) {
    return (
      <svg viewBox="0 0 72 52" className="h-12 w-full" aria-hidden="true">
        <path d="M8 9h31M8 15h20" {...common} />
        <rect x="7" y="24" width="17" height="20" rx="2" {...common} />
        <rect x="28" y="24" width="17" height="20" rx="2" {...common} />
        <rect x="49" y="24" width="17" height="20" rx="2" {...common} />
      </svg>
    );
  }
  if (normalized.includes("section")) {
    return (
      <svg viewBox="0 0 72 52" className="h-12 w-full" aria-hidden="true">
        <rect x="5" y="8" width="62" height="36" rx="2" {...common} />
        <path d="M5 20h62M11 14h15" {...common} />
      </svg>
    );
  }
  if (label === "Container") {
    return (
      <svg viewBox="0 0 72 52" className="h-12 w-full" aria-hidden="true">
        <rect x="7" y="6" width="58" height="40" rx="3" {...common} />
        <rect x="17" y="12" width="38" height="28" rx="2" {...common} />
      </svg>
    );
  }
  if (label === "Grid") {
    return (
      <svg viewBox="0 0 72 52" className="h-12 w-full" aria-hidden="true">
        <rect x="6" y="7" width="60" height="38" rx="2" {...common} />
        <path d="M26 7v38M46 7v38M6 26h60" {...common} />
      </svg>
    );
  }
  if (label === "Text") {
    return (
      <svg viewBox="0 0 72 52" className="h-12 w-full" aria-hidden="true">
        <path d="M12 13h48M12 21h37M12 30h44M12 38h27" {...common} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 72 52" className="h-12 w-full" aria-hidden="true">
      <rect x="15" y="13" width="42" height="26" rx="5" {...common} />
      <path d="M29 26h14M39 22l4 4-4 4" {...common} />
    </svg>
  );
}

function ToolboxItem({
  label,
  element,
}: {
  label: string;
  icon?: ReactElement;
  element: ReactElement;
}) {
  const { connectors } = useEditor();
  return (
    <button
      ref={(node) => {
        if (node) connectors.create(node, element);
      }}
      type="button"
      className="group relative flex min-w-0 cursor-grab flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-blue-400 active:cursor-grabbing"
    >
      <span className="grid h-20 w-full place-items-center bg-zinc-50 px-2 text-zinc-500 transition group-hover:bg-blue-50 group-hover:text-blue-600">
        <ComponentPreview label={label} />
      </span>
      <span className="flex w-full items-center gap-1 border-t border-zinc-100 px-2 py-2">
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-zinc-700">
          {label}
        </span>
        <GripVertical className="size-3 shrink-0 text-zinc-400" />
      </span>
    </button>
  );
}

function ToolboxGroup({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-full items-center justify-between rounded-md px-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
        aria-expanded={open}
      >
        {title}
        {open ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
      </button>
      {open ? (
        <div className="grid grid-cols-2 gap-2 pt-1">{children}</div>
      ) : null}
    </section>
  );
}

function Toolbox({ query = "" }: { query?: string }) {
  const matches = (label: string) =>
    label.toLowerCase().includes(query.toLowerCase());
  return (
    <div className="space-y-3 p-3">
      <ToolboxGroup title="Structure">
        {matches("Section") ? (
          <ToolboxItem
            label="Section"
            icon={<LayoutGrid className="size-4" />}
            element={<CraftElement is={QSection} canvas />}
          />
        ) : null}
        {matches("Container") ? (
          <ToolboxItem
            label="Container"
            icon={<Columns3 className="size-4" />}
            element={<CraftElement is={QContainer} canvas />}
          />
        ) : null}
        {matches("Grid") ? (
          <ToolboxItem
            label="Grid"
            icon={<LayoutGrid className="size-4" />}
            element={
              <CraftElement
                is={QContainer}
                canvas
                layout="grid"
                columns="repeat(3, minmax(0, 1fr))"
              />
            }
          />
        ) : null}
      </ToolboxGroup>
      <ToolboxGroup title="Typography">
        {matches("Text") ? (
          <ToolboxItem
            label="Text"
            icon={<Type className="size-4" />}
            element={<QText />}
          />
        ) : null}
      </ToolboxGroup>
      <ToolboxGroup title="Actions">
        {matches("Button") ? (
          <ToolboxItem
            label="Button"
            icon={<Plus className="size-4" />}
            element={<QButton />}
          />
        ) : null}
      </ToolboxGroup>
    </div>
  );
}

function SectionsPanel({ query }: { query: string }) {
  const matches = (label: string) =>
    label.toLowerCase().includes(query.toLowerCase());
  return (
    <div className="space-y-3 p-3">
      <ToolboxGroup title="Page sections">
        {matches("Navbar") ? (
          <ToolboxItem
            label="Navbar"
            icon={<LayoutTemplate className="size-4" />}
            element={
              <CraftElement
                is={QSection}
                canvas
                padding={0}
                minHeight="auto"
                custom={{ displayName: "Navbar section" }}
              >
                <CraftElement
                  is={QContainer}
                  canvas
                  layout="container"
                  direction="row"
                  align="center"
                  justify="space-between"
                  minHeight={72}
                  custom={{ displayName: "Navbar container" }}
                >
                  <QText as="h3" text="Brand" fontSize={18} weight={700} />
                  <CraftElement
                    is={QContainer}
                    canvas
                    layout="flex"
                    direction="row"
                    align="center"
                    width="auto"
                    maxWidth="100%"
                    padding={0}
                    gap={20}
                  >
                    <QText text="Home" fontSize={14} width="auto" />
                    <QText text="About" fontSize={14} width="auto" />
                    <QButton text="Contact" />
                  </CraftElement>
                </CraftElement>
              </CraftElement>
            }
          />
        ) : null}
        {matches("Blank section") ? (
          <ToolboxItem
            label="Blank section"
            icon={<LayoutTemplate className="size-4" />}
            element={
              <CraftElement
                is={QSection}
                canvas
                minHeight={240}
                custom={{ displayName: "Section" }}
              />
            }
          />
        ) : null}
        {matches("Hero structure") ? (
          <ToolboxItem
            label="Hero structure"
            icon={<LayoutTemplate className="size-4" />}
            element={
              <CraftElement
                is={QSection}
                canvas
                minHeight={480}
                padding={64}
                gap={20}
                custom={{ displayName: "Hero section" }}
              >
                <QText
                  as="h1"
                  text="New hero heading"
                  fontSize={48}
                  weight={700}
                />
                <QText
                  text="Add supporting copy for this section."
                  color="#52525b"
                />
                <QButton text="Call to action" />
              </CraftElement>
            }
          />
        ) : null}
        {matches("Feature grid") ? (
          <ToolboxItem
            label="Feature grid"
            icon={<LayoutGrid className="size-4" />}
            element={
              <CraftElement
                is={QSection}
                canvas
                padding={48}
                custom={{ displayName: "Feature section" }}
              >
                <QText
                  as="h2"
                  text="Feature section"
                  fontSize={36}
                  weight={700}
                />
                <CraftElement
                  is={QContainer}
                  canvas
                  layout="grid"
                  columns="repeat(3, minmax(0, 1fr))"
                />
              </CraftElement>
            }
          />
        ) : null}
      </ToolboxGroup>
    </div>
  );
}

type CollectionPreset = "blank" | "posts" | "products" | "team";

function CollectionsPanel({
  orgId,
  query,
}: {
  orgId: Id<"organizations">;
  query: string;
}) {
  const collections = useQuery(api.cms.listCollections, { orgId });
  const createCollection = useMutation(api.cms.createCollection);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<CollectionPreset>("blank");
  const [submitting, setSubmitting] = useState(false);
  const visible = (collections ?? []).filter((collection) =>
    collection.name.toLowerCase().includes(query.toLowerCase()),
  );

  const submit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createCollection({ orgId, name: name.trim(), preset });
      setName("");
      setPreset("blank");
      setCreating(false);
      toast.success("Collection created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create collection",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-zinc-900">CMS collections</p>
          <p className="text-[10px] text-zinc-500">
            Structured content for this site
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((value) => !value)}
          className="grid size-8 place-items-center rounded-md bg-blue-600 text-white hover:bg-blue-700"
          aria-label="Create collection"
        >
          {creating ? (
            <X className="size-3.5" />
          ) : (
            <Plus className="size-3.5" />
          )}
        </button>
      </div>
      {creating ? (
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            placeholder="Collection name"
            className={inputClass}
          />
          <EditorSelect
            value={preset}
            onChange={(value) => setPreset(value as CollectionPreset)}
            options={[
              { value: "blank", label: "Blank — title field" },
              { value: "posts", label: "Posts" },
              { value: "products", label: "Products" },
              { value: "team", label: "Team members" },
            ]}
          />
          <button
            type="button"
            disabled={submitting || !name.trim()}
            onClick={() => void submit()}
            className="h-9 w-full rounded-md bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {submitting ? "Creating…" : "Create collection"}
          </button>
        </div>
      ) : null}
      {collections === undefined ? (
        <div className="h-20 animate-pulse rounded-lg bg-zinc-100" />
      ) : visible.length ? (
        <div className="space-y-1.5">
          {visible.map((collection) => (
            <button
              key={collection._id}
              type="button"
              className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 text-left hover:border-blue-200 hover:bg-blue-50"
            >
              <span className="grid size-8 place-items-center rounded-md bg-zinc-100 text-zinc-600">
                <Database className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-zinc-900">
                  {collection.name}
                </span>
                <span className="block text-[10px] text-zinc-500">
                  {collection.fields.length} fields · /{collection.slug}
                </span>
              </span>
              <ChevronRight className="size-3.5 text-zinc-400" />
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-[11px] leading-4 text-zinc-500">
          Create a collection to define reusable content fields.
        </p>
      )}
    </div>
  );
}

function LibrariesPanel({ query }: { query: string }) {
  const [selected, setSelected] = useState(true);
  return (
    <div>
      <div className="border-b border-zinc-100 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Installed libraries
        </p>
        <button
          type="button"
          onClick={() => setSelected((value) => !value)}
          className={`mt-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left ${
            selected
              ? "border-blue-200 bg-blue-50"
              : "border-zinc-200 hover:border-zinc-300"
          }`}
        >
          <span className="grid size-9 place-items-center rounded-md bg-blue-600 text-white">
            <Library className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-zinc-900">
              Basic
            </span>
            <span className="block text-[10px] text-zinc-500">
              Platform library · Included
            </span>
          </span>
          <ChevronDown
            className={`size-3.5 text-zinc-400 transition-transform ${selected ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {selected ? <SectionsPanel query={query} /> : null}
    </div>
  );
}

const SIDEBAR_AREAS: Array<{
  id: SidebarArea;
  label: string;
  icon: React.ElementType;
}> = [
  { id: "elements", label: "Elements", icon: Plus },
  { id: "collections", label: "Collections", icon: Database },
  { id: "libraries", label: "Libraries", icon: Library },
  { id: "theme", label: "Theme", icon: Palette },
  { id: "layers", label: "Layers", icon: Layers3 },
];

function EditorSidebar({
  orgId,
  area,
  setArea,
  open,
  setOpen,
  panelWidth,
  onResizeStart,
}: {
  orgId: Id<"organizations">;
  area: SidebarArea;
  setArea: (area: SidebarArea) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  panelWidth: number;
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const [query, setQuery] = useState("");
  const selectArea = (next: SidebarArea) => {
    if (next === area) setOpen(!open);
    else {
      setArea(next);
      setOpen(true);
      setQuery("");
    }
  };
  const panelTitle =
    SIDEBAR_AREAS.find((item) => item.id === area)?.label ?? "Elements";
  return (
    <div
      className="relative grid min-h-0"
      style={{
        gridTemplateColumns: open ? `52px ${panelWidth}px` : "52px",
      }}
    >
      <nav
        className="flex min-h-0 flex-col items-center gap-1 border-r border-zinc-200 bg-zinc-50 py-2"
        aria-label="Editor tools"
      >
        <button
          type="button"
          onClick={() => setOpen(open ? false : true)}
          aria-label={open ? "Close tool panel" : "Open tool panel"}
          className="mb-1 grid size-10 place-items-center rounded-lg text-zinc-500 hover:bg-white hover:text-zinc-950"
        >
          {open ? (
            <PanelLeftClose className="size-4" />
          ) : (
            <PanelLeftOpen className="size-4" />
          )}
        </button>
        {SIDEBAR_AREAS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            title={label}
            onClick={() => selectArea(id)}
            className={`grid size-10 place-items-center rounded-lg ${area === id && open ? "bg-blue-600 text-white" : "text-zinc-500 hover:bg-white hover:text-zinc-950"}`}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </nav>
      {open ? (
        <aside className="flex min-h-0 flex-col border-r border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-900">
                {panelTitle}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close tool panel"
                className="grid size-7 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${panelTitle.toLowerCase()}`}
                className="h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-8 pr-2 text-xs outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {area === "elements" ? <Toolbox query={query} /> : null}
            {area === "layers" ? (
              <div className="p-2">
                <Layers expandRootOnLoad />
              </div>
            ) : null}
            {area === "collections" ? (
              <CollectionsPanel orgId={orgId} query={query} />
            ) : null}
            {area === "libraries" ? <LibrariesPanel query={query} /> : null}
            {area === "theme" ? <ThemePanel query={query} /> : null}
          </div>
        </aside>
      ) : null}
      {open ? (
        <button
          type="button"
          aria-label="Resize tool panel"
          onPointerDown={onResizeStart}
          className="absolute inset-y-0 right-0 z-30 w-1 cursor-col-resize hover:bg-blue-500/40"
        />
      ) : null}
    </div>
  );
}

function Hint({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          className="border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-white shadow-none"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const PROPERTY_SCOPES = ["all", "desktop", "tablet", "mobile"] as const;

function ScopeIcon({
  scope,
  className,
}: {
  scope: EditScope;
  className?: string;
}) {
  const Icon =
    scope === "all"
      ? Globe2
      : scope === "desktop"
        ? Monitor
        : scope === "tablet"
          ? Tablet
          : Smartphone;
  return <Icon className={className} />;
}

function PropertyScopeControl({ label }: { label: string }) {
  const responsive = useContext(InspectorDeviceContext);
  if (!responsive) return null;
  const activeLabel =
    responsive.scope === "all" ? "All screens" : responsive.scope;
  return (
    <Popover>
      <TooltipProvider delayDuration={250} skipDelayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`${label}: ${activeLabel}`}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-zinc-200 bg-white px-1.5 text-blue-600 outline-none hover:border-blue-300 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-200"
              >
                <ScopeIcon scope={responsive.scope} className="size-3" />
                <ChevronDown className="size-2.5 text-zinc-400" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent className="border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-white shadow-none">
            {`Editing ${label.toLowerCase()} on ${activeLabel.toLowerCase()}`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-48 rounded-lg border-zinc-200 bg-white p-1.5 shadow-none"
      >
        <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Apply property to
        </p>
        {PROPERTY_SCOPES.map((scope) => {
          const title = scope === "all" ? "All screens" : scope;
          const description =
            scope === "all" ? "Use one shared value" : `Override ${scope} only`;
          return (
            <Hint key={scope} label={description} side="right">
              <button
                type="button"
                onClick={() => {
                  responsive.setScope(scope);
                  if (scope !== "all") responsive.setDevice(scope);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left ${responsive.scope === scope ? "bg-blue-50 text-blue-700" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"}`}
              >
                <span className="border-current/15 grid size-7 place-items-center rounded-md border bg-white">
                  <ScopeIcon scope={scope} className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium capitalize">
                    {title}
                  </span>
                  <span className="block text-[10px] text-zinc-400">
                    {description}
                  </span>
                </span>
              </button>
            </Hint>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function Field({ label, children }: { label: string; children: ReactElement }) {
  return (
    <div className="relative grid min-w-0 gap-1.5 text-xs font-medium text-zinc-700">
      <div className="flex min-h-4 items-center justify-between gap-2">
        <span>{label}</span>
        <PropertyScopeControl label={label} />
      </div>
      {children}
    </div>
  );
}

const inputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function EditorSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 rounded-md border-zinc-200 bg-white px-2.5 text-sm focus:ring-blue-200">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72 min-w-60 rounded-md border-zinc-200 bg-white shadow-none">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="rounded-md text-sm focus:bg-blue-50 focus:text-blue-700"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const GRID_PLACEMENT_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "1", label: "Line 1" },
  { value: "2", label: "Line 2" },
  { value: "3", label: "Line 3" },
  { value: "4", label: "Line 4" },
  { value: "span 2", label: "Span 2 tracks" },
  { value: "span 3", label: "Span 3 tracks" },
  { value: "1 / 3", label: "Line 1 → 3" },
  { value: "2 / 4", label: "Line 2 → 4" },
  { value: "1 / -1", label: "Full track" },
  { value: "custom", label: "Custom…" },
];

function GridPlacementControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const isPreset = GRID_PLACEMENT_OPTIONS.some(
    (option) => option.value !== "custom" && option.value === value,
  );
  const [custom, setCustom] = useState(isPreset ? "" : value);
  const selected = isPreset ? value : "custom";
  return (
    <div className="grid gap-1.5">
      <EditorSelect
        value={selected}
        onChange={(next) => {
          if (next === "custom") {
            const nextCustom = custom || (isPreset ? "1 / 2" : value);
            setCustom(nextCustom);
            onChange(nextCustom);
          } else {
            onChange(next);
          }
        }}
        options={GRID_PLACEMENT_OPTIONS}
      />
      {selected === "custom" ? (
        <input
          className={inputClass}
          value={custom}
          aria-label="Custom grid placement"
          placeholder="1 / 3"
          onChange={(event) => {
            setCustom(event.target.value);
            onChange(event.target.value);
          }}
        />
      ) : null}
    </div>
  );
}

function SegmentedButtons({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div
      className="grid rounded-md bg-zinc-100 p-1"
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => (
        <Hint key={option.value} label={option.label}>
          <button
            type="button"
            onClick={() => onChange(option.value)}
            className={`h-8 truncate rounded px-1 text-[11px] font-medium ${
              value === option.value
                ? "bg-white text-zinc-950 ring-1 ring-zinc-200"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {option.label}
          </button>
        </Hint>
      ))}
    </div>
  );
}

function ScrubNumber({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commitDraft = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(max, Math.max(min, parsed));
    setDraft(String(next));
    onChange(next);
  };
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_48px] items-center gap-1.5">
      <Slider
        min={min}
        max={max}
        step={step}
        value={[Math.min(max, Math.max(min, value))]}
        onValueChange={([next]) => {
          if (next !== undefined) onChange(next);
        }}
        className="h-6 min-w-0 cursor-ew-resize px-2.5 [&>span:first-child>span]:rounded-full [&>span:first-child>span]:bg-blue-600 [&>span:first-child]:h-1 [&>span:first-child]:rounded-full [&>span:first-child]:bg-zinc-200 [&_[role=slider]]:size-4 [&_[role=slider]]:border-2 [&_[role=slider]]:border-white [&_[role=slider]]:bg-blue-600 [&_[role=slider]]:shadow-none [&_[role=slider]]:ring-1 [&_[role=slider]]:ring-blue-600 focus-within:[&_[role=slider]]:ring-2 focus-within:[&_[role=slider]]:ring-blue-300"
      />
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(String(value));
            event.currentTarget.blur();
          }
        }}
        className="h-8 w-full min-w-0 rounded-md border border-zinc-200 bg-white px-1.5 text-right text-xs tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

type LengthUnit = "px" | "%" | "vw" | "vh" | "rem" | "em";
type LengthValue = number | string;

function parseLength(value: unknown, fallbackUnit: LengthUnit = "px") {
  if (typeof value === "number" && Number.isFinite(value))
    return { amount: value, unit: fallbackUnit, keyword: null };
  const input = String(value ?? "").trim();
  if (["auto", "none", "fit-content"].includes(input))
    return { amount: 0, unit: fallbackUnit, keyword: input };
  const match = input.match(/^(-?\d*\.?\d+)\s*(px|%|vw|vh|rem|em)?$/i);
  return {
    amount: match ? Number(match[1]) : 0,
    unit: (match?.[2]?.toLowerCase() as LengthUnit | undefined) ?? fallbackUnit,
    keyword: null,
  };
}

function lengthRange(unit: LengthUnit, min: number, max: number) {
  if (unit === "%" || unit === "vw" || unit === "vh")
    return { min: Math.max(-100, min), max: Math.min(200, max), step: 1 };
  if (unit === "rem" || unit === "em")
    return { min: Math.max(-20, min), max: Math.min(100, max), step: 0.25 };
  return { min, max, step: 1 };
}

function LengthControl({
  value,
  onChange,
  min = 0,
  max = 1600,
  allowAuto = false,
  allowNone = false,
  allowFit = false,
  accessory,
  scoped = true,
}: {
  value: unknown;
  onChange: (value: LengthValue) => void;
  min?: number;
  max?: number;
  allowAuto?: boolean;
  allowNone?: boolean;
  allowFit?: boolean;
  accessory?: ReactNode;
  scoped?: boolean;
}) {
  const parsed = parseLength(value);
  const selected = parsed.keyword ?? parsed.unit;
  const range = lengthRange(parsed.unit, min, max);
  const options = [
    { value: "px", label: "px" },
    { value: "%", label: "%" },
    { value: "vw", label: "vw" },
    { value: "vh", label: "vh" },
    { value: "rem", label: "rem" },
    { value: "em", label: "em" },
    ...(allowAuto ? [{ value: "auto", label: "Auto" }] : []),
    ...(allowFit ? [{ value: "fit-content", label: "Fit" }] : []),
    ...(allowNone ? [{ value: "none", label: "None" }] : []),
  ];
  return (
    <div className="grid min-w-0">
      <div
        className={`absolute top-0 flex h-6 items-center justify-end gap-1 ${scoped ? "right-10" : "right-0"}`}
      >
        <Select
          value={selected}
          onValueChange={(next) => {
            if (["auto", "none", "fit-content"].includes(next)) {
              onChange(next);
              return;
            }
            const unit = next as LengthUnit;
            onChange(unit === "px" ? parsed.amount : `${parsed.amount}${unit}`);
          }}
        >
          <SelectTrigger
            aria-label="Value unit"
            className="h-6 w-auto min-w-0 gap-0.5 border-0 bg-transparent px-1 text-[10px] font-semibold text-zinc-500 shadow-none hover:bg-zinc-100 hover:text-zinc-900 focus:ring-0 [&>svg]:size-2.5"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="top"
            align="end"
            sideOffset={4}
            className="min-w-20 shadow-none"
          >
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="text-xs"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {accessory}
      </div>
      {parsed.keyword ? (
        <div className="h-1 rounded-full bg-zinc-200" />
      ) : (
        <ScrubNumber
          value={parsed.amount}
          min={range.min}
          max={range.max}
          step={range.step}
          onChange={(amount) =>
            onChange(parsed.unit === "px" ? amount : `${amount}${parsed.unit}`)
          }
        />
      )}
    </div>
  );
}

function SpacingModeControl({
  split,
  onChange,
  kind = "sides",
}: {
  split: boolean;
  onChange: (split: boolean) => void;
  kind?: "sides" | "axes";
}) {
  const splitLabel = kind === "axes" ? "Row and column" : "Four sides";
  const splitDescription =
    kind === "axes"
      ? "Control row and column gaps separately"
      : "Control top, right, bottom and left";
  return (
    <Hint
      label={
        split
          ? `Use one linked value instead of ${splitDescription.toLowerCase()}`
          : splitDescription
      }
    >
      <button
        type="button"
        aria-label={split ? "Use one linked value" : splitLabel}
        aria-pressed={split}
        onClick={() => onChange(!split)}
        className={`grid size-5 place-items-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 ${split ? "bg-blue-50 text-blue-600" : ""}`}
      >
        {split ? <Unlink2 className="size-3" /> : <Link2 className="size-3" />}
      </button>
    </Hint>
  );
}

type EdgeValue = {
  label: string;
  value: unknown;
  onChange: (value: LengthValue) => void;
};

function MultiValueSpacingControl({
  split,
  onSplitChange,
  kind,
  min,
  max,
  linkedValue,
  onLinkedChange,
  edges,
}: {
  split: boolean;
  onSplitChange: (split: boolean) => void;
  kind: "sides" | "axes";
  min: number;
  max: number;
  linkedValue: unknown;
  onLinkedChange: (value: LengthValue) => void;
  edges: EdgeValue[];
}) {
  if (!split) {
    return (
      <LengthControl
        min={min}
        max={max}
        value={linkedValue}
        onChange={onLinkedChange}
        accessory={
          <SpacingModeControl
            kind={kind}
            split={false}
            onChange={onSplitChange}
          />
        }
      />
    );
  }
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          {kind === "axes" ? "Separate axes" : "Individual edges"}
        </span>
        <SpacingModeControl kind={kind} split onChange={onSplitChange} />
      </div>
      <div className="grid gap-2">
        {edges.map((edge) => (
          <div key={edge.label} className="relative grid gap-1">
            <span className="text-[10px] text-zinc-500">{edge.label}</span>
            <LengthControl
              min={min}
              max={max}
              value={edge.value}
              onChange={edge.onChange}
              scoped={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const BACKGROUND_POSITIONS = [
  ["left top", "Top left"],
  ["center top", "Top center"],
  ["right top", "Top right"],
  ["left center", "Center left"],
  ["center", "Center"],
  ["right center", "Center right"],
  ["left bottom", "Bottom left"],
  ["center bottom", "Bottom center"],
  ["right bottom", "Bottom right"],
] as const;

function BackgroundPositionPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid w-24 grid-cols-3 gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-1.5">
      {BACKGROUND_POSITIONS.map(([position, label]) => (
        <Hint key={position} label={label}>
          <button
            type="button"
            aria-label={label}
            onClick={() => onChange(position)}
            className={`grid size-6 place-items-center rounded ${
              value === position
                ? "bg-blue-600 text-white"
                : "bg-white text-zinc-400 ring-1 ring-zinc-200 hover:text-blue-600"
            }`}
          >
            <span className="size-1.5 rounded-full bg-current" />
          </button>
        </Hint>
      ))}
    </div>
  );
}

const GRID_COLUMN_PRESETS = [
  { value: "minmax(0, 1fr)", label: "1 column" },
  { value: "repeat(2, minmax(0, 1fr))", label: "2 equal columns" },
  { value: "repeat(3, minmax(0, 1fr))", label: "3 equal columns" },
  { value: "repeat(4, minmax(0, 1fr))", label: "4 equal columns" },
  {
    value: "minmax(0, 2fr) minmax(0, 1fr)",
    label: "2 / 1 columns",
  },
  {
    value: "minmax(0, 1fr) minmax(0, 2fr)",
    label: "1 / 2 columns",
  },
];

function InspectorGroup({
  title,
  summary,
  children,
  defaultOpen = true,
}: {
  title: string;
  summary?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-zinc-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-10 w-full items-center gap-2 text-left"
      >
        <span className="flex-1 text-xs font-semibold text-zinc-900">
          {title}
        </span>
        {summary ? (
          <span className="max-w-32 truncate text-[11px] text-zinc-400">
            {summary}
          </span>
        ) : null}
        <ChevronDown
          className={`size-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="space-y-3 pb-4">{children}</div> : null}
    </section>
  );
}

function Inspector({
  orgId,
  device,
  scope,
  onResizeStart,
}: {
  orgId: Id<"organizations">;
  device: Device;
  scope: EditScope;
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const [tab, setTab] = useState<"style" | "animation" | "settings">("style");
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);
  const [splitSpacing, setSplitSpacing] = useState({
    gap: false,
    padding: false,
    margin: false,
  });
  const generateUploadUrl = useMutation(api.assets.generateUploadUrl);
  const saveAsset = useMutation(api.assets.save);
  const { selectedId, node, parentNode, actions, deletable } = useEditor(
    (state, query) => {
      const selectedId = Array.from(state.events.selected)[0];
      const node = selectedId ? state.nodes[selectedId] : null;
      return {
        selectedId,
        node,
        parentNode: node?.data.parent ? state.nodes[node.data.parent] : null,
        deletable: selectedId ? query.node(selectedId).isDeletable() : false,
      };
    },
  );
  const rawProps = (node?.data.props ?? {}) as Record<string, unknown>;
  const responsive = (rawProps.responsive ?? {}) as Partial<
    Record<Device, Record<string, unknown>>
  >;
  const scopeOverrides = scope === "all" ? {} : (responsive[scope] ?? {});
  const props = scope === "all" ? rawProps : { ...rawProps, ...scopeOverrides };
  const parentRawProps = (parentNode?.data.props ?? {}) as Record<
    string,
    unknown
  >;
  const parentResponsive = (parentRawProps.responsive ?? {}) as Partial<
    Record<Device, Record<string, unknown>>
  >;
  const parentProps =
    scope === "all"
      ? parentRawProps
      : { ...parentRawProps, ...(parentResponsive[scope] ?? {}) };
  const parentLayout = String(parentProps.layout ?? "block");
  const columnsValue = String(props.columns ?? "repeat(2, minmax(0, 1fr))");
  const customColumns =
    props.columnsMode === "custom" ||
    !GRID_COLUMN_PRESETS.some((preset) => preset.value === columnsValue);
  const animationType = String(props.animationType ?? "none");
  const hasAnimation = animationType !== "none";
  const updateMany = (updates: Record<string, unknown>) => {
    if (!selectedId) return;
    actions.setProp(selectedId, (draft: Record<string, unknown>) => {
      setScopedPropsDraft(draft, scope, updates);
    });
  };
  const update = (key: string, value: unknown) => updateMany({ [key]: value });
  const name = String(
    node?.data.custom?.displayName || node?.data.displayName || "Page",
  );

  const uploadAsset = async (
    file: File,
    kind: "image" | "video",
    propKey: "backgroundImage" | "backgroundVideo",
  ) => {
    setUploading(kind);
    try {
      const uploadUrl = await generateUploadUrl({ orgId });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed");
      const { storageId } = (await response.json()) as { storageId: string };
      const asset = await saveAsset({
        orgId,
        storageId,
        name: file.name,
        type: file.type,
        size: file.size,
      });
      update(propKey, asset.url);
      toast.success(`${kind === "image" ? "Image" : "Video"} uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  return (
    <aside className="relative flex min-h-0 flex-col border-l border-zinc-200 bg-white">
      <button
        type="button"
        aria-label="Resize inspector"
        onPointerDown={onResizeStart}
        className="absolute inset-y-0 left-0 z-30 w-1 cursor-col-resize hover:bg-blue-500/40"
      />
      <div className="border-b border-zinc-200 px-4 py-3">
        <p className="text-[10px] text-zinc-500">Selected</p>
        <p className="truncate text-sm font-semibold text-zinc-900">{name}</p>
      </div>
      <div className="grid grid-cols-3 border-b border-zinc-200">
        {(["style", "animation", "settings"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`h-10 border-b-2 text-xs font-medium capitalize ${tab === value ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500"}`}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {!node ? (
          <p className="pt-20 text-center text-xs leading-5 text-zinc-500">
            Select a component to edit it.
          </p>
        ) : null}
        {node && tab === "settings" ? (
          <>
            <Field label="Layer name">
              <input
                className={inputClass}
                value={String(node.data.custom?.displayName || "")}
                placeholder={String(node.data.displayName)}
                onChange={(event) =>
                  actions.setCustom(selectedId!, (custom) => {
                    custom.displayName = event.target.value;
                  })
                }
              />
            </Field>
            {deletable ? (
              <button
                type="button"
                onClick={() => actions.delete(selectedId!)}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="size-3.5" /> Delete component
              </button>
            ) : (
              <p className="text-xs text-zinc-500">
                The page root cannot be deleted.
              </p>
            )}
          </>
        ) : null}
        {node && tab === "animation" ? (
          <>
            <InspectorGroup title="Animation" summary={animationType}>
              <Field label="Effect">
                <EditorSelect
                  value={animationType}
                  onChange={(value) => update("animationType", value)}
                  options={[
                    { value: "none", label: "None" },
                    { value: "fade", label: "Fade in" },
                    { value: "slide-up", label: "Enter from bottom" },
                    { value: "slide-down", label: "Enter from top" },
                    { value: "slide-left", label: "Enter from right" },
                    { value: "slide-right", label: "Enter from left" },
                    { value: "scale", label: "Scale in" },
                    { value: "rotate", label: "Rotate in" },
                    { value: "custom", label: "Custom motion" },
                  ]}
                />
              </Field>
              {!hasAnimation ? (
                <p className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] leading-4 text-zinc-500">
                  Choose an effect to reveal its motion and timing controls.
                </p>
              ) : (
                <>
                  <Field label="Trigger">
                    <SegmentedButtons
                      value={String(props.animationTrigger ?? "load")}
                      onChange={(value) => update("animationTrigger", value)}
                      options={[
                        { value: "load", label: "Load" },
                        { value: "in-view", label: "In view" },
                        { value: "hover", label: "Hover" },
                        { value: "click", label: "Click" },
                      ]}
                    />
                  </Field>
                  {animationType === "fade" ? (
                    <Field label="Starting opacity">
                      <ScrubNumber
                        value={Number(props.animationOpacity ?? 0)}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(value) => update("animationOpacity", value)}
                      />
                    </Field>
                  ) : null}
                  {animationType.startsWith("slide-") ? (
                    <>
                      <Field label="Travel distance">
                        <ScrubNumber
                          value={Number(props.animationDistance ?? 40)}
                          min={0}
                          max={400}
                          onChange={(value) =>
                            update("animationDistance", value)
                          }
                        />
                      </Field>
                      <Field label="Starting opacity">
                        <ScrubNumber
                          value={Number(props.animationOpacity ?? 0)}
                          min={0}
                          max={1}
                          step={0.05}
                          onChange={(value) =>
                            update("animationOpacity", value)
                          }
                        />
                      </Field>
                    </>
                  ) : null}
                  {animationType === "scale" ? (
                    <Field label="Starting scale">
                      <ScrubNumber
                        value={Number(props.animationScale ?? 0.85)}
                        min={0}
                        max={2}
                        step={0.05}
                        onChange={(value) => update("animationScale", value)}
                      />
                    </Field>
                  ) : null}
                  {animationType === "rotate" ? (
                    <>
                      <Field label="Starting rotation">
                        <ScrubNumber
                          value={Number(props.animationRotation ?? -8)}
                          min={-360}
                          max={360}
                          onChange={(value) =>
                            update("animationRotation", value)
                          }
                        />
                      </Field>
                      <Field label="Starting scale">
                        <ScrubNumber
                          value={Number(props.animationScale ?? 0.95)}
                          min={0}
                          max={2}
                          step={0.05}
                          onChange={(value) => update("animationScale", value)}
                        />
                      </Field>
                    </>
                  ) : null}
                  {animationType === "custom" ? (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["X", "animationFromX", -600, 600, 0, 1],
                        ["Y", "animationFromY", -600, 600, 24, 1],
                        ["Opacity", "animationFromOpacity", 0, 1, 0, 0.05],
                        ["Scale", "animationFromScale", 0, 3, 1, 0.05],
                        ["Rotation", "animationFromRotation", -360, 360, 0, 1],
                      ].map(([label, key, min, max, fallback, step]) => (
                        <Field key={String(key)} label={String(label)}>
                          <input
                            type="number"
                            min={Number(min)}
                            max={Number(max)}
                            step={Number(step)}
                            className={inputClass}
                            value={Number(props[String(key)] ?? fallback)}
                            onChange={(event) =>
                              update(String(key), Number(event.target.value))
                            }
                          />
                        </Field>
                      ))}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("qentrah:play-animation", {
                          detail: { nodeId: selectedId },
                        }),
                      )
                    }
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Play className="size-3.5 fill-current" /> Play animation
                  </button>
                </>
              )}
            </InspectorGroup>
            {hasAnimation ? (
              <InspectorGroup title="Timing" defaultOpen={false}>
                <Field label="Duration">
                  <ScrubNumber
                    min={0.1}
                    max={20}
                    step={0.1}
                    value={Number(props.animationDuration ?? 0.8)}
                    onChange={(value) => update("animationDuration", value)}
                  />
                </Field>
                <Field label="Delay">
                  <ScrubNumber
                    min={0}
                    max={20}
                    step={0.1}
                    value={Number(props.animationDelay ?? 0)}
                    onChange={(value) => update("animationDelay", value)}
                  />
                </Field>
                <Field label="Easing">
                  <EditorSelect
                    value={String(props.animationEase ?? "power2.out")}
                    onChange={(value) => update("animationEase", value)}
                    options={[
                      { value: "none", label: "Linear" },
                      { value: "power1.out", label: "Power 1 — gentle" },
                      { value: "power2.out", label: "Power 2 — balanced" },
                      { value: "power3.out", label: "Power 3 — strong" },
                      { value: "back.out(1.7)", label: "Back — overshoot" },
                      { value: "elastic.out(1,0.3)", label: "Elastic" },
                      { value: "bounce.out", label: "Bounce" },
                      { value: "custom", label: "Custom GSAP ease…" },
                    ]}
                  />
                </Field>
                {props.animationEase === "custom" ? (
                  <Field label="Custom ease">
                    <input
                      className={inputClass}
                      value={String(props.animationCustomEase ?? "power2.out")}
                      placeholder="power2.out or cubic-bezier-like GSAP ease"
                      onChange={(event) =>
                        update("animationCustomEase", event.target.value)
                      }
                    />
                  </Field>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Repeat">
                    <input
                      type="number"
                      min={-1}
                      max={20}
                      className={inputClass}
                      value={Number(props.animationRepeat ?? 0)}
                      onChange={(event) =>
                        update("animationRepeat", Number(event.target.value))
                      }
                    />
                  </Field>
                  <Field label="Repeat delay">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      step={0.1}
                      className={inputClass}
                      value={Number(props.animationRepeatDelay ?? 0)}
                      onChange={(event) =>
                        update(
                          "animationRepeatDelay",
                          Number(event.target.value),
                        )
                      }
                    />
                  </Field>
                </div>
                <Field label="Yoyo">
                  <SegmentedButtons
                    value={props.animationYoyo ? "yes" : "no"}
                    onChange={(value) =>
                      update("animationYoyo", value === "yes")
                    }
                    options={[
                      { value: "no", label: "No" },
                      { value: "yes", label: "Yes" },
                    ]}
                  />
                </Field>
                <p className="text-[10px] leading-4 text-zinc-500">
                  Use repeat −1 for a continuous loop. Reduced-motion
                  preferences are respected automatically.
                </p>
              </InspectorGroup>
            ) : null}
          </>
        ) : null}
        {node && tab === "style" ? (
          <>
            {"text" in props || "href" in props ? (
              <InspectorGroup title="Content">
                {"text" in props ? (
                  <Field label="Text">
                    <textarea
                      className={`${inputClass} min-h-24 py-2`}
                      value={String(props.text ?? "")}
                      onChange={(event) => update("text", event.target.value)}
                    />
                  </Field>
                ) : null}
                {"href" in props ? (
                  <Field label="Link">
                    <input
                      className={inputClass}
                      value={String(props.href ?? "")}
                      onChange={(event) => update("href", event.target.value)}
                    />
                  </Field>
                ) : null}
              </InspectorGroup>
            ) : null}
            {"layout" in props ? (
              <>
                <InspectorGroup
                  title="Layout"
                  summary={String(props.layout ?? "flex")}
                >
                  <Field label="Display">
                    <SegmentedButtons
                      value={String(props.layout ?? "flex")}
                      onChange={(value) => {
                        if (value === "container") {
                          updateMany({
                            layout: "container",
                            direction: "column",
                            width: "100%",
                            maxWidth: "1200px",
                            marginLeft: "auto",
                            marginRight: "auto",
                          });
                        } else update("layout", value);
                      }}
                      options={[
                        { value: "block", label: "Block" },
                        { value: "container", label: "Container" },
                        { value: "flex", label: "Flex" },
                        { value: "grid", label: "Grid" },
                      ]}
                    />
                  </Field>
                  {["container", "flex"].includes(
                    String(props.layout ?? "flex"),
                  ) ? (
                    <>
                      <Field label="Direction">
                        <SegmentedButtons
                          value={String(props.direction ?? "column")}
                          onChange={(value) => update("direction", value)}
                          options={[
                            { value: "row", label: "Row" },
                            { value: "column", label: "Column" },
                            { value: "row-reverse", label: "Row rev" },
                            {
                              value: "column-reverse",
                              label: "Col rev",
                            },
                          ]}
                        />
                      </Field>
                      <Field label="Wrap">
                        <SegmentedButtons
                          value={String(props.wrap ?? "nowrap")}
                          onChange={(value) => update("wrap", value)}
                          options={[
                            { value: "nowrap", label: "No wrap" },
                            { value: "wrap", label: "Wrap" },
                            { value: "wrap-reverse", label: "Reverse" },
                          ]}
                        />
                      </Field>
                      <Field label="Quick alignment">
                        <SegmentedButtons
                          value={
                            props.align === "center" &&
                            props.justify === "center"
                              ? "center"
                              : props.align === "flex-end" &&
                                  props.justify === "flex-end"
                                ? "end"
                                : props.justify === "space-between"
                                  ? "between"
                                  : "start"
                          }
                          onChange={(value) => {
                            if (value === "center")
                              updateMany({
                                align: "center",
                                justify: "center",
                              });
                            else if (value === "end")
                              updateMany({
                                align: "flex-end",
                                justify: "flex-end",
                              });
                            else if (value === "between")
                              updateMany({
                                align: "center",
                                justify: "space-between",
                              });
                            else
                              updateMany({
                                align: "flex-start",
                                justify: "flex-start",
                              });
                          }}
                          options={[
                            { value: "start", label: "Start" },
                            { value: "center", label: "Center" },
                            { value: "end", label: "End" },
                            { value: "between", label: "Between" },
                          ]}
                        />
                      </Field>
                    </>
                  ) : props.layout === "grid" ? (
                    <>
                      <Field label="Grid columns">
                        <EditorSelect
                          value={customColumns ? "custom" : columnsValue}
                          onChange={(value) => {
                            if (value === "custom")
                              update("columnsMode", "custom");
                            else
                              updateMany({
                                columnsMode: "preset",
                                columns: value,
                              });
                          }}
                          options={[
                            ...GRID_COLUMN_PRESETS,
                            { value: "custom", label: "Custom grid rule…" },
                          ]}
                        />
                      </Field>
                      {customColumns ? (
                        <Field label="Custom columns">
                          <input
                            className={inputClass}
                            value={columnsValue}
                            placeholder="repeat(5, minmax(0, 1fr))"
                            onChange={(event) =>
                              update("columns", event.target.value)
                            }
                          />
                        </Field>
                      ) : null}
                      <Field label="Grid rows">
                        <input
                          className={inputClass}
                          value={String(props.gridRows ?? "auto")}
                          placeholder="auto, repeat(2, 1fr)"
                          onChange={(event) =>
                            update("gridRows", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Auto flow">
                        <SegmentedButtons
                          value={String(props.gridAutoFlow ?? "row")}
                          onChange={(value) => update("gridAutoFlow", value)}
                          options={[
                            { value: "row", label: "Row" },
                            { value: "column", label: "Column" },
                            { value: "row dense", label: "Row dense" },
                            { value: "column dense", label: "Column dense" },
                          ]}
                        />
                      </Field>
                      <Field label="Justify items">
                        <SegmentedButtons
                          value={String(props.justifyItems ?? "stretch")}
                          onChange={(value) => update("justifyItems", value)}
                          options={[
                            { value: "stretch", label: "Stretch" },
                            { value: "start", label: "Start" },
                            { value: "center", label: "Center" },
                            { value: "end", label: "End" },
                          ]}
                        />
                      </Field>
                    </>
                  ) : null}
                  {["container", "flex", "grid"].includes(
                    String(props.layout),
                  ) ? (
                    <>
                      <Field label="Align items">
                        <SegmentedButtons
                          value={String(props.align ?? "stretch")}
                          onChange={(value) => update("align", value)}
                          options={[
                            { value: "stretch", label: "Stretch" },
                            { value: "flex-start", label: "Start" },
                            { value: "center", label: "Center" },
                            { value: "flex-end", label: "End" },
                          ]}
                        />
                      </Field>
                      <Field label="Justify content">
                        <EditorSelect
                          value={String(props.justify ?? "flex-start")}
                          onChange={(value) => update("justify", value)}
                          options={[
                            { value: "flex-start", label: "Start" },
                            { value: "center", label: "Center" },
                            { value: "flex-end", label: "End" },
                            { value: "space-between", label: "Space between" },
                            { value: "space-around", label: "Space around" },
                            { value: "space-evenly", label: "Space evenly" },
                          ]}
                        />
                      </Field>
                    </>
                  ) : null}
                </InspectorGroup>
                <InspectorGroup
                  title="Spacing"
                  summary={`${String(props.padding ?? 0)} padding`}
                  defaultOpen={false}
                >
                  <Field label="Gap">
                    <MultiValueSpacingControl
                      kind="axes"
                      split={splitSpacing.gap}
                      onSplitChange={(gap) =>
                        setSplitSpacing((current) => ({ ...current, gap }))
                      }
                      min={0}
                      max={240}
                      linkedValue={props.gap ?? 0}
                      onLinkedChange={(value) =>
                        updateMany({
                          gap: value,
                          rowGap: value,
                          columnGap: value,
                        })
                      }
                      edges={[
                        {
                          label: "Row",
                          value: props.rowGap ?? props.gap ?? 0,
                          onChange: (value) => update("rowGap", value),
                        },
                        {
                          label: "Column",
                          value: props.columnGap ?? props.gap ?? 0,
                          onChange: (value) => update("columnGap", value),
                        },
                      ]}
                    />
                  </Field>
                  <Field label="Padding">
                    <MultiValueSpacingControl
                      kind="sides"
                      split={splitSpacing.padding}
                      onSplitChange={(padding) =>
                        setSplitSpacing((current) => ({
                          ...current,
                          padding,
                        }))
                      }
                      min={0}
                      max={500}
                      linkedValue={props.padding ?? 0}
                      onLinkedChange={(value) =>
                        updateMany({
                          padding: value,
                          paddingTop: value,
                          paddingRight: value,
                          paddingBottom: value,
                          paddingLeft: value,
                        })
                      }
                      edges={(["Top", "Right", "Bottom", "Left"] as const).map(
                        (side) => ({
                          label: side,
                          value: props[`padding${side}`] ?? props.padding ?? 0,
                          onChange: (value: LengthValue) =>
                            update(`padding${side}`, value),
                        }),
                      )}
                    />
                  </Field>
                  <Field label="Margin">
                    <MultiValueSpacingControl
                      kind="sides"
                      split={splitSpacing.margin}
                      onSplitChange={(margin) =>
                        setSplitSpacing((current) => ({
                          ...current,
                          margin,
                        }))
                      }
                      min={-500}
                      max={500}
                      linkedValue={props.marginTop ?? 0}
                      onLinkedChange={(value) =>
                        updateMany({
                          marginTop: value,
                          marginRight: value,
                          marginBottom: value,
                          marginLeft: value,
                        })
                      }
                      edges={(["Top", "Right", "Bottom", "Left"] as const).map(
                        (side) => ({
                          label: side,
                          value: props[`margin${side}`] ?? 0,
                          onChange: (value: LengthValue) =>
                            update(`margin${side}`, value),
                        }),
                      )}
                    />
                  </Field>
                </InspectorGroup>
                <InspectorGroup title="Size & position" defaultOpen={false}>
                  <Field label="Responsive sizing">
                    <SegmentedButtons
                      value={
                        props.width === "auto" || props.width === "fit-content"
                          ? "fit"
                          : props.maxWidth === "1200px"
                            ? "content"
                            : typeof props.width === "number" ||
                                String(props.width ?? "").endsWith("px")
                              ? "fixed"
                              : "fluid"
                      }
                      onChange={(value) => {
                        if (value === "content")
                          updateMany({
                            width: "100%",
                            maxWidth: "1200px",
                            marginLeft: "auto",
                            marginRight: "auto",
                          });
                        else if (value === "fit")
                          updateMany({
                            width: "fit-content",
                            maxWidth: "100%",
                          });
                        else if (value === "fixed")
                          updateMany({ width: 320, maxWidth: "100%" });
                        else updateMany({ width: "100%", maxWidth: "100%" });
                      }}
                      options={[
                        { value: "fluid", label: "Fluid" },
                        { value: "content", label: "Content" },
                        { value: "fit", label: "Fit" },
                        { value: "fixed", label: "Fixed" },
                      ]}
                    />
                  </Field>
                  <Field label="Width">
                    <LengthControl
                      value={props.width ?? "100%"}
                      onChange={(value) => update("width", value)}
                      allowAuto
                      allowFit
                    />
                  </Field>
                  <Field label="Position">
                    <SegmentedButtons
                      value={String(props.position ?? "relative")}
                      onChange={(value) => update("position", value)}
                      options={[
                        { value: "static", label: "Static" },
                        { value: "relative", label: "Relative" },
                        { value: "absolute", label: "Absolute" },
                        { value: "sticky", label: "Sticky" },
                      ]}
                    />
                  </Field>
                  <Field label="Overflow">
                    <SegmentedButtons
                      value={String(props.overflow ?? "visible")}
                      onChange={(value) => update("overflow", value)}
                      options={[
                        { value: "visible", label: "Visible" },
                        { value: "hidden", label: "Hidden" },
                        { value: "auto", label: "Auto" },
                      ]}
                    />
                  </Field>
                  <Field label="Max width">
                    <LengthControl
                      value={props.maxWidth ?? "100%"}
                      onChange={(value) => update("maxWidth", value)}
                      allowNone
                    />
                  </Field>
                  <Field label="Minimum height">
                    <LengthControl
                      value={props.minHeight ?? "auto"}
                      onChange={(value) => update("minHeight", value)}
                      allowAuto
                    />
                  </Field>
                </InspectorGroup>
                <InspectorGroup title="Item in parent" defaultOpen={false}>
                  {["container", "flex"].includes(parentLayout) ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Grow">
                          <ScrubNumber
                            value={Number(props.flexGrow ?? 0)}
                            min={0}
                            max={10}
                            step={0.1}
                            onChange={(value) => update("flexGrow", value)}
                          />
                        </Field>
                        <Field label="Shrink">
                          <ScrubNumber
                            value={Number(props.flexShrink ?? 1)}
                            min={0}
                            max={10}
                            step={0.1}
                            onChange={(value) => update("flexShrink", value)}
                          />
                        </Field>
                      </div>
                      <Field label="Flex basis">
                        <LengthControl
                          value={props.flexBasis ?? "auto"}
                          onChange={(value) => update("flexBasis", value)}
                          allowAuto
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Order">
                          <input
                            type="number"
                            className={inputClass}
                            value={Number(props.order ?? 0)}
                            onChange={(event) =>
                              update("order", Number(event.target.value))
                            }
                          />
                        </Field>
                        <Field label="Align self">
                          <EditorSelect
                            value={String(props.alignSelf ?? "auto")}
                            onChange={(value) => update("alignSelf", value)}
                            options={[
                              { value: "auto", label: "Auto" },
                              { value: "stretch", label: "Stretch" },
                              { value: "flex-start", label: "Start" },
                              { value: "center", label: "Center" },
                              { value: "flex-end", label: "End" },
                            ]}
                          />
                        </Field>
                      </div>
                    </>
                  ) : parentLayout === "grid" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Grid column">
                        <GridPlacementControl
                          value={String(props.gridColumn ?? "auto")}
                          onChange={(value) => update("gridColumn", value)}
                        />
                      </Field>
                      <Field label="Grid row">
                        <GridPlacementControl
                          value={String(props.gridRow ?? "auto")}
                          onChange={(value) => update("gridRow", value)}
                        />
                      </Field>
                    </div>
                  ) : (
                    <p className="text-[11px] leading-4 text-zinc-500">
                      This parent uses block flow, so flex and grid item
                      controls do not apply.
                    </p>
                  )}
                </InspectorGroup>
              </>
            ) : null}
            {"fontSize" in props || "color" in props ? (
              <InspectorGroup title="Typography" defaultOpen={false}>
                {"as" in props ? (
                  <Field label="Text role">
                    <SegmentedButtons
                      value={String(props.as ?? "p")}
                      onChange={(value) => update("as", value)}
                      options={[
                        { value: "p", label: "Body" },
                        { value: "h1", label: "H1" },
                        { value: "h2", label: "H2" },
                        { value: "h3", label: "H3" },
                      ]}
                    />
                  </Field>
                ) : null}
                {"fontSize" in props ? (
                  <Field label="Font size">
                    <LengthControl
                      min={8}
                      max={200}
                      value={props.fontSize ?? 18}
                      onChange={(value) => update("fontSize", value)}
                    />
                  </Field>
                ) : null}
                {"align" in props ? (
                  <Field label="Text alignment">
                    <SegmentedButtons
                      value={String(props.align ?? "left")}
                      onChange={(value) => update("align", value)}
                      options={[
                        { value: "left", label: "Left" },
                        { value: "center", label: "Center" },
                        { value: "right", label: "Right" },
                        { value: "justify", label: "Justify" },
                      ]}
                    />
                  </Field>
                ) : null}
                {"weight" in props ? (
                  <Field label="Weight">
                    <EditorSelect
                      value={String(props.weight ?? 400)}
                      onChange={(value) => update("weight", Number(value))}
                      options={[
                        { value: "300", label: "Light — 300" },
                        { value: "400", label: "Regular — 400" },
                        { value: "500", label: "Medium — 500" },
                        { value: "600", label: "Semibold — 600" },
                        { value: "700", label: "Bold — 700" },
                        { value: "800", label: "Extra bold — 800" },
                      ]}
                    />
                  </Field>
                ) : null}
                {"lineHeight" in props ? (
                  <Field label="Line height">
                    <LengthControl
                      value={props.lineHeight ?? "1.4em"}
                      min={0}
                      max={200}
                      onChange={(value) => update("lineHeight", value)}
                    />
                  </Field>
                ) : null}
                {"letterSpacing" in props ? (
                  <Field label="Letter spacing">
                    <LengthControl
                      value={props.letterSpacing ?? 0}
                      min={-20}
                      max={80}
                      onChange={(value) => update("letterSpacing", value)}
                    />
                  </Field>
                ) : null}
                {"textTransform" in props ? (
                  <Field label="Capitalization">
                    <SegmentedButtons
                      value={String(props.textTransform ?? "none")}
                      onChange={(value) => update("textTransform", value)}
                      options={[
                        { value: "none", label: "Normal" },
                        { value: "uppercase", label: "Upper" },
                        { value: "capitalize", label: "Title" },
                        { value: "lowercase", label: "Lower" },
                      ]}
                    />
                  </Field>
                ) : null}
                {"color" in props ? (
                  <Field label="Text color">
                    <QentrahColorPicker
                      value={String(props.color ?? "#18181b")}
                      onChange={(color) => update("color", color)}
                      label="Choose text color"
                    />
                  </Field>
                ) : null}
              </InspectorGroup>
            ) : null}
            {"width" in props && !("layout" in props) ? (
              <InspectorGroup title="Size in parent" defaultOpen={false}>
                <Field label="Width">
                  <LengthControl
                    value={props.width ?? "auto"}
                    onChange={(value) => update("width", value)}
                    allowAuto
                    allowFit
                  />
                </Field>
                <Field label="Minimum height">
                  <LengthControl
                    value={props.minHeight ?? "auto"}
                    onChange={(value) => update("minHeight", value)}
                    allowAuto
                  />
                </Field>
                {["container", "flex"].includes(parentLayout) ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Grow">
                        <ScrubNumber
                          value={Number(props.flexGrow ?? 0)}
                          min={0}
                          max={10}
                          step={0.1}
                          onChange={(value) => update("flexGrow", value)}
                        />
                      </Field>
                      <Field label="Shrink">
                        <ScrubNumber
                          value={Number(props.flexShrink ?? 1)}
                          min={0}
                          max={10}
                          step={0.1}
                          onChange={(value) => update("flexShrink", value)}
                        />
                      </Field>
                    </div>
                    <Field label="Basis">
                      <LengthControl
                        value={props.flexBasis ?? "auto"}
                        onChange={(value) => update("flexBasis", value)}
                        allowAuto
                      />
                    </Field>
                    <Field label="Align in parent">
                      <EditorSelect
                        value={String(props.alignSelf ?? "auto")}
                        onChange={(value) => update("alignSelf", value)}
                        options={[
                          { value: "auto", label: "Use parent" },
                          { value: "stretch", label: "Stretch" },
                          { value: "flex-start", label: "Start" },
                          { value: "center", label: "Center" },
                          { value: "flex-end", label: "End" },
                        ]}
                      />
                    </Field>
                  </>
                ) : null}
                <Field label="Order in parent">
                  <ScrubNumber
                    value={Number(props.order ?? 0)}
                    min={-20}
                    max={20}
                    onChange={(value) => update("order", value)}
                  />
                </Field>
                <p className="text-[10px] leading-4 text-zinc-500">
                  Drag this item in the canvas to reorder it. Magnetic layout
                  follows the parent&apos;s flex or grid flow.
                </p>
              </InspectorGroup>
            ) : null}
            {"background" in props ? (
              <InspectorGroup
                title="Background"
                summary={String(props.backgroundType ?? "color")}
                defaultOpen={false}
              >
                <Field label="Background type">
                  <SegmentedButtons
                    value={String(props.backgroundType ?? "color")}
                    onChange={(value) => update("backgroundType", value)}
                    options={[
                      { value: "color", label: "Solid color" },
                      { value: "gradient", label: "Gradient" },
                      { value: "image", label: "Image" },
                      { value: "video", label: "Video" },
                    ]}
                  />
                </Field>
                {(props.backgroundType ?? "color") === "color" ? (
                  <Field label="Color">
                    <QentrahColorPicker
                      value={String(props.background ?? "#ffffff")}
                      onChange={(color) => update("background", color)}
                      label="Choose background color"
                    />
                  </Field>
                ) : null}
                {props.backgroundType === "gradient" ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="From">
                        <QentrahColorPicker
                          value={String(props.gradientFrom ?? "#ffffff")}
                          onChange={(color) => update("gradientFrom", color)}
                          label="Choose gradient start"
                        />
                      </Field>
                      <Field label="To">
                        <QentrahColorPicker
                          value={String(props.gradientTo ?? "#e0e7ff")}
                          onChange={(color) => update("gradientTo", color)}
                          label="Choose gradient end"
                        />
                      </Field>
                    </div>
                    <Field label="Angle">
                      <input
                        type="number"
                        min={0}
                        max={360}
                        className={inputClass}
                        value={Number(props.gradientAngle ?? 135)}
                        onChange={(event) =>
                          update("gradientAngle", Number(event.target.value))
                        }
                      />
                    </Field>
                  </>
                ) : null}
                {props.backgroundType === "image" ? (
                  <>
                    <Field label="Image URL">
                      <input
                        className={inputClass}
                        value={String(props.backgroundImage ?? "")}
                        placeholder="https://…"
                        onChange={(event) =>
                          update("backgroundImage", event.target.value)
                        }
                      />
                    </Field>
                    <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 text-xs font-medium text-zinc-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700">
                      {uploading === "image" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="size-3.5" />
                      )}
                      {uploading === "image"
                        ? "Uploading image…"
                        : "Upload image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={uploading !== null}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file)
                            void uploadAsset(file, "image", "backgroundImage");
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </>
                ) : null}
                {props.backgroundType === "video" ? (
                  <>
                    <Field label="Video URL">
                      <input
                        className={inputClass}
                        value={String(props.backgroundVideo ?? "")}
                        placeholder="MP4 or WebM URL"
                        onChange={(event) =>
                          update("backgroundVideo", event.target.value)
                        }
                      />
                    </Field>
                    <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 text-xs font-medium text-zinc-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700">
                      {uploading === "video" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="size-3.5" />
                      )}
                      {uploading === "video"
                        ? "Uploading video…"
                        : "Upload video"}
                      <input
                        type="file"
                        accept="video/mp4,video/webm"
                        className="sr-only"
                        disabled={uploading !== null}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file)
                            void uploadAsset(file, "video", "backgroundVideo");
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <Field label="Poster URL">
                      <input
                        className={inputClass}
                        value={String(props.backgroundPoster ?? "")}
                        placeholder="Optional preview image"
                        onChange={(event) =>
                          update("backgroundPoster", event.target.value)
                        }
                      />
                    </Field>
                  </>
                ) : null}
                {props.backgroundType === "image" ||
                props.backgroundType === "video" ? (
                  <>
                    <Field label="Fit">
                      <SegmentedButtons
                        value={String(props.backgroundSize ?? "cover")}
                        onChange={(value) => update("backgroundSize", value)}
                        options={
                          props.backgroundType === "video"
                            ? [
                                { value: "cover", label: "Cover" },
                                { value: "contain", label: "Contain" },
                                { value: "fill", label: "Stretch" },
                              ]
                            : [
                                { value: "cover", label: "Cover" },
                                { value: "contain", label: "Contain" },
                                { value: "auto", label: "Original" },
                              ]
                        }
                      />
                    </Field>
                    <Field label="Position">
                      <BackgroundPositionPicker
                        value={String(props.backgroundPosition ?? "center")}
                        onChange={(value) =>
                          update("backgroundPosition", value)
                        }
                      />
                    </Field>
                    {props.backgroundType === "image" ? (
                      <Field label="Repeat">
                        <SegmentedButtons
                          value={String(props.backgroundRepeat ?? "no-repeat")}
                          onChange={(value) =>
                            update("backgroundRepeat", value)
                          }
                          options={[
                            { value: "no-repeat", label: "None" },
                            { value: "repeat", label: "Both" },
                            { value: "repeat-x", label: "X axis" },
                            { value: "repeat-y", label: "Y axis" },
                          ]}
                        />
                      </Field>
                    ) : null}
                  </>
                ) : null}
              </InspectorGroup>
            ) : null}
            {"layout" in props ? (
              <InspectorGroup title="Border & radius" defaultOpen={false}>
                <Field label="Corner radius">
                  <ScrubNumber
                    value={Number(props.borderRadius ?? 0)}
                    min={0}
                    max={200}
                    onChange={(value) => update("borderRadius", value)}
                  />
                </Field>
                <Field label="Border width">
                  <ScrubNumber
                    value={Number(props.borderWidth ?? 0)}
                    min={0}
                    max={32}
                    onChange={(value) => update("borderWidth", value)}
                  />
                </Field>
                {Number(props.borderWidth ?? 0) > 0 ? (
                  <>
                    <Field label="Border style">
                      <SegmentedButtons
                        value={String(props.borderStyle ?? "solid")}
                        onChange={(value) => update("borderStyle", value)}
                        options={[
                          { value: "solid", label: "Solid" },
                          { value: "dashed", label: "Dashed" },
                          { value: "dotted", label: "Dotted" },
                        ]}
                      />
                    </Field>
                    <Field label="Border color">
                      <QentrahColorPicker
                        value={String(props.borderColor ?? "#d4d4d8")}
                        onChange={(color) => update("borderColor", color)}
                        label="Choose border color"
                      />
                    </Field>
                  </>
                ) : null}
              </InspectorGroup>
            ) : null}
            {!("layout" in props) &&
            ["container", "flex"].includes(parentLayout) ? (
              <InspectorGroup title="Item in parent" defaultOpen={false}>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Grow">
                    <ScrubNumber
                      value={Number(props.flexGrow ?? 0)}
                      min={0}
                      max={10}
                      step={0.1}
                      onChange={(value) => update("flexGrow", value)}
                    />
                  </Field>
                  <Field label="Shrink">
                    <ScrubNumber
                      value={Number(props.flexShrink ?? 1)}
                      min={0}
                      max={10}
                      step={0.1}
                      onChange={(value) => update("flexShrink", value)}
                    />
                  </Field>
                </div>
                <Field label="Basis">
                  <input
                    className={inputClass}
                    value={String(props.flexBasis ?? "auto")}
                    placeholder="auto, 240px, 30%"
                    onChange={(event) =>
                      update("flexBasis", event.target.value)
                    }
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Order">
                    <input
                      type="number"
                      className={inputClass}
                      value={Number(props.order ?? 0)}
                      onChange={(event) =>
                        update("order", Number(event.target.value))
                      }
                    />
                  </Field>
                  <Field label="Align self">
                    <EditorSelect
                      value={String(props.alignSelf ?? "auto")}
                      onChange={(value) => update("alignSelf", value)}
                      options={[
                        { value: "auto", label: "Auto" },
                        { value: "stretch", label: "Stretch" },
                        { value: "flex-start", label: "Start" },
                        { value: "center", label: "Center" },
                        { value: "flex-end", label: "End" },
                      ]}
                    />
                  </Field>
                </div>
              </InspectorGroup>
            ) : null}
            {!("layout" in props) && parentLayout === "grid" ? (
              <InspectorGroup title="Item in parent" defaultOpen={false}>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Grid column">
                    <GridPlacementControl
                      value={String(props.gridColumn ?? "auto")}
                      onChange={(value) => update("gridColumn", value)}
                    />
                  </Field>
                  <Field label="Grid row">
                    <GridPlacementControl
                      value={String(props.gridRow ?? "auto")}
                      onChange={(value) => update("gridRow", value)}
                    />
                  </Field>
                </div>
              </InspectorGroup>
            ) : null}
          </>
        ) : null}
      </div>
    </aside>
  );
}

function DeviceButton({
  device,
  current,
  onClick,
}: {
  device: Device;
  current: Device;
  onClick: () => void;
}) {
  const Icon =
    device === "desktop" ? Monitor : device === "tablet" ? Tablet : Smartphone;
  return (
    <Hint label={`${device} canvas`} side="bottom">
      <button
        type="button"
        onClick={onClick}
        aria-label={`${device} canvas`}
        className={`grid size-8 place-items-center rounded-md ${current === device ? "bg-white text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-900"}`}
      >
        <Icon className="size-4" />
      </button>
    </Hint>
  );
}

function EditorWorkspace({
  props,
  device,
  setDevice,
}: {
  props: PageEditorProps;
  device: Device;
  setDevice: (device: Device) => void;
}) {
  const inspectorDevice = useContext(InspectorDeviceContext);
  const editScope = inspectorDevice?.scope ?? "all";
  const snapEnabled = inspectorDevice?.snapEnabled ?? true;
  const savePage = useMutation(api.pages.savePage);
  const togglePublish = useMutation(api.pages.togglePublish);
  const { actions, query, enabled, canUndo, canRedo } = useEditor(
    (state, editorQuery) => ({
      enabled: state.options.enabled,
      canUndo: editorQuery.history.canUndo(),
      canRedo: editorQuery.history.canRedo(),
    }),
  );
  const [sidebarArea, setSidebarArea] = useState<SidebarArea>("elements");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(260);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const [zoom, setZoom] = useState(60);
  const [fit, setFit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState(props.initialPublished);
  const [saved, setSaved] = useState(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const title =
    props.initialTitle[props.locale] ??
    props.initialTitle.en ??
    props.initialTitle.ar ??
    props.pageSlug;
  const canvasWidth = DEVICE_WIDTHS[device];
  const selectCanvasDevice = (nextDevice: Device) => {
    setDevice(nextDevice);
    if (inspectorDevice?.scope !== "all") inspectorDevice?.setScope(nextDevice);
  };

  const startPaneResize = useCallback(
    (side: "left" | "right", event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = side === "left" ? leftPanelWidth : rightPanelWidth;
      const onMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        const next = side === "left" ? startWidth + delta : startWidth - delta;
        if (side === "left") {
          setLeftPanelWidth(Math.min(420, Math.max(220, next)));
        } else {
          setRightPanelWidth(Math.min(480, Math.max(260, next)));
        }
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [leftPanelWidth, rightPanelWidth],
  );

  const fitCanvas = useCallback(() => {
    if (!workspaceRef.current) return;
    const available = Math.max(280, workspaceRef.current.clientWidth - 72);
    setZoom(
      Math.min(100, Math.max(25, Math.floor((available / canvasWidth) * 100))),
    );
    setFit(true);
  }, [canvasWidth]);

  useEffect(() => {
    fitCanvas();
    const observer = new ResizeObserver(fitCanvas);
    if (workspaceRef.current) observer.observe(workspaceRef.current);
    return () => observer.disconnect();
  }, [fitCanvas]);

  const save = async () => {
    setSaving(true);
    try {
      await savePage({
        orgId: props.orgId,
        slug: props.pageSlug,
        data: createQentrahPageData(query.serialize()),
      });
      setSaved(true);
      toast.success(props.labels.saved);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : props.labels.saveError,
      );
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    try {
      await save();
      const next = await togglePublish({
        orgId: props.orgId,
        slug: props.pageSlug,
      });
      setPublished(next);
      toast.success(next ? props.labels.publish : props.labels.unpublish);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : props.labels.saveError,
      );
    }
  };

  return (
    <div className="grid h-svh min-h-0 grid-rows-[56px_1fr] overflow-hidden bg-[#f3f4f6] text-zinc-950">
      <header
        className="grid items-center border-b border-zinc-200 bg-white px-2"
        style={{
          gridTemplateColumns: `${enabled && sidebarOpen ? leftPanelWidth + 52 : 220}px minmax(0, 1fr) ${rightPanelWidth}px`,
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={{
              pathname: "/dashboard/[org]/pages",
              params: { org: props.orgSlug },
            }}
            aria-label={props.labels.back}
            className="grid size-9 place-items-center rounded-md hover:bg-zinc-100"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="text-[10px] text-zinc-500">
              /{props.pageSlug} · {published ? "Live" : "Draft"}
            </p>
          </div>
        </div>
        <div className="mx-auto flex items-center gap-2">
          <div className="flex rounded-lg bg-zinc-100 p-1">
            <DeviceButton
              device="desktop"
              current={device}
              onClick={() => selectCanvasDevice("desktop")}
            />
            <DeviceButton
              device="tablet"
              current={device}
              onClick={() => selectCanvasDevice("tablet")}
            />
            <DeviceButton
              device="mobile"
              current={device}
              onClick={() => selectCanvasDevice("mobile")}
            />
          </div>
          <Hint
            label={
              snapEnabled
                ? "Magnetic layout is on — resize and reorder snap to nearby items"
                : "Turn on magnetic layout"
            }
            side="bottom"
          >
            <button
              type="button"
              aria-pressed={snapEnabled}
              onClick={() => inspectorDevice?.setSnapEnabled(!snapEnabled)}
              className={`grid size-9 place-items-center rounded-lg border ${
                snapEnabled
                  ? "border-blue-200 bg-blue-50 text-blue-600"
                  : "border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <Magnet className="size-4" />
            </button>
          </Hint>
          <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-1">
            <button
              type="button"
              aria-label="Zoom out"
              className="grid size-8 place-items-center rounded-md hover:bg-zinc-100"
              onClick={() => {
                setFit(false);
                setZoom((value) => Math.max(25, value - 10));
              }}
            >
              <Minus className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={fitCanvas}
              className={`min-w-14 text-xs font-medium ${fit ? "text-blue-600" : "text-zinc-600"}`}
              title="Fit canvas"
            >
              {zoom}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              className="grid size-8 place-items-center rounded-md hover:bg-zinc-100"
              onClick={() => {
                setFit(false);
                setZoom((value) => Math.min(120, value + 10));
              }}
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          {saved && !saving ? (
            <span className="mr-1 hidden items-center gap-1 text-[10px] text-emerald-700 xl:flex">
              <Check className="size-3" /> Saved
            </span>
          ) : null}
          <button
            type="button"
            disabled={!canUndo}
            onClick={() => actions.history.undo()}
            aria-label="Undo"
            className="grid size-9 place-items-center rounded-md hover:bg-zinc-100 disabled:opacity-30"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={() => actions.history.redo()}
            aria-label="Redo"
            className="grid size-9 place-items-center rounded-md hover:bg-zinc-100 disabled:opacity-30"
          >
            <Redo2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              actions.setOptions((options) => {
                options.enabled = !enabled;
              })
            }
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-semibold hover:bg-zinc-50"
          >
            <Eye className="size-3.5" />{" "}
            {enabled ? props.labels.preview : "Edit"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-semibold hover:bg-zinc-50 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            {saving ? props.labels.saving : props.labels.save}
          </button>
          <button
            type="button"
            onClick={publish}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Globe2 className="size-3.5" />{" "}
            {published ? props.labels.unpublish : props.labels.publish}
          </button>
        </div>
      </header>
      <div
        className="grid min-h-0"
        style={{
          gridTemplateColumns: enabled
            ? `${sidebarOpen ? leftPanelWidth + 52 : 52}px minmax(0, 1fr) ${rightPanelWidth}px`
            : "minmax(0, 1fr)",
        }}
      >
        {enabled ? (
          <EditorSidebar
            orgId={props.orgId}
            area={sidebarArea}
            setArea={setSidebarArea}
            open={sidebarOpen}
            setOpen={setSidebarOpen}
            panelWidth={leftPanelWidth}
            onResizeStart={(event) => startPaneResize("left", event)}
          />
        ) : null}
        <main ref={workspaceRef} className="min-w-0 overflow-auto p-9">
          <div
            className="mx-auto"
            style={{ width: canvasWidth * (zoom / 100) }}
          >
            <div
              className="origin-top-left overflow-hidden bg-white shadow-[0_20px_60px_rgba(15,23,42,0.14)]"
              style={{ width: canvasWidth, zoom: zoom / 100 } as CSSProperties}
            >
              <QentrahViewportProvider
                device={device}
                editing={enabled}
                editScope={editScope}
              >
                <Frame
                  data={
                    isQentrahPageData(props.initialData)
                      ? props.initialData.serialized
                      : undefined
                  }
                >
                  {isLegacyPuckPageData(props.initialData)
                    ? LegacyPageAdapter({
                        data: props.initialData,
                        locale: props.locale,
                      })
                    : StarterPage({ title, slug: props.pageSlug })}
                </Frame>
              </QentrahViewportProvider>
            </div>
          </div>
        </main>
        {enabled ? (
          <Inspector
            orgId={props.orgId}
            device={device}
            scope={editScope}
            onResizeStart={(event) => startPaneResize("right", event)}
          />
        ) : null}
      </div>
    </div>
  );
}

export function QentrahPageEditor(props: PageEditorProps) {
  const [device, setDevice] = useState<Device>("desktop");
  const [scope, setScope] = useState<EditScope>("all");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const dataKey = useMemo(
    () =>
      isQentrahPageData(props.initialData)
        ? props.initialData.serialized
        : legacyPageKey(props.initialData),
    [props.initialData],
  );
  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={100}>
      <InspectorDeviceContext.Provider
        value={{
          device,
          setDevice,
          scope,
          setScope,
          snapEnabled,
          setSnapEnabled,
        }}
      >
        <Editor key={dataKey} resolver={QENTRAH_RESOLVER} onRender={QuickNode}>
          <EditorWorkspace
            props={props}
            device={device}
            setDevice={setDevice}
          />
        </Editor>
      </InspectorDeviceContext.Provider>
    </TooltipProvider>
  );
}
