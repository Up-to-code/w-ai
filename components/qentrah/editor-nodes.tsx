"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type RefObject,
} from "react";
import { useNode } from "@craftjs/core";
import { gsap } from "gsap";

export type QentrahDevice = "desktop" | "tablet" | "mobile";
type ResponsiveOverrides = Partial<
  Record<QentrahDevice, Record<string, unknown>>
>;
type ResponsiveProps = {
  responsive?: ResponsiveOverrides;
  hiddenOn?: Partial<Record<QentrahDevice, boolean>>;
  animationType?:
    | "none"
    | "fade"
    | "slide-up"
    | "slide-down"
    | "slide-left"
    | "slide-right"
    | "scale"
    | "rotate"
    | "custom";
  animationTrigger?: "load" | "in-view" | "hover" | "click";
  animationDuration?: number;
  animationDelay?: number;
  animationEase?: string;
  animationCustomEase?: string;
  animationRepeat?: number;
  animationRepeatDelay?: number;
  animationYoyo?: boolean;
  animationDistance?: number;
  animationOpacity?: number;
  animationScale?: number;
  animationRotation?: number;
  animationFromX?: number;
  animationFromY?: number;
  animationFromOpacity?: number;
  animationFromScale?: number;
  animationFromRotation?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: string;
  order?: number;
  alignSelf?: CSSProperties["alignSelf"];
  gridColumn?: string;
  gridRow?: string;
  offsetX?: number | string;
  offsetY?: number | string;
};

const ViewportContext = createContext<{
  device: QentrahDevice;
  editing: boolean;
  editScope: "all" | QentrahDevice;
}>({ device: "desktop", editing: false, editScope: "all" });

export function QentrahViewportProvider({
  children,
  device: fixedDevice,
  editing = false,
  editScope = "all",
}: {
  children: ReactNode;
  device?: QentrahDevice;
  editing?: boolean;
  editScope?: "all" | QentrahDevice;
}) {
  const [detectedDevice, setDetectedDevice] =
    useState<QentrahDevice>("desktop");

  useEffect(() => {
    if (fixedDevice) return;
    const update = () =>
      setDetectedDevice(
        window.innerWidth <= 767
          ? "mobile"
          : window.innerWidth <= 1023
            ? "tablet"
            : "desktop",
      );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [fixedDevice]);

  return (
    <ViewportContext.Provider
      value={{ device: fixedDevice ?? detectedDevice, editing, editScope }}
    >
      {children}
    </ViewportContext.Provider>
  );
}

function useResponsiveProps<T extends ResponsiveProps>(props: T) {
  const viewport = useContext(ViewportContext);
  const override = props.responsive?.[viewport.device] ?? {};
  return {
    props: { ...props, ...override } as T,
    hidden: Boolean(props.hiddenOn?.[viewport.device]),
    editing: viewport.editing,
    editScope: viewport.editScope,
  };
}

function visibilityStyle(hidden: boolean, editing: boolean): CSSProperties {
  if (!hidden) return {};
  return editing
    ? { opacity: 0.28, filter: "grayscale(1)" }
    : { display: "none" };
}

function itemStyle(props: ResponsiveProps): CSSProperties {
  return {
    flexGrow: props.flexGrow,
    flexShrink: props.flexShrink,
    flexBasis: props.flexBasis,
    order: props.order,
    alignSelf: props.alignSelf,
    gridColumn: props.gridColumn,
    gridRow: props.gridRow,
    position:
      props.offsetX !== undefined || props.offsetY !== undefined
        ? "relative"
        : undefined,
    left: props.offsetX,
    top: props.offsetY,
  };
}

function animationFrom(props: ResponsiveProps) {
  const distance = props.animationDistance ?? 40;
  switch (props.animationType) {
    case "fade":
      return { opacity: props.animationOpacity ?? 0 };
    case "slide-up":
      return { opacity: props.animationOpacity ?? 0, y: distance };
    case "slide-down":
      return { opacity: props.animationOpacity ?? 0, y: -distance };
    case "slide-left":
      return { opacity: props.animationOpacity ?? 0, x: distance };
    case "slide-right":
      return { opacity: props.animationOpacity ?? 0, x: -distance };
    case "scale":
      return {
        opacity: props.animationOpacity ?? 0,
        scale: props.animationScale ?? 0.85,
      };
    case "rotate":
      return {
        opacity: props.animationOpacity ?? 0,
        rotation: props.animationRotation ?? -8,
        scale: props.animationScale ?? 0.95,
      };
    case "custom":
      return {
        opacity: props.animationFromOpacity ?? 0,
        x: props.animationFromX ?? 0,
        y: props.animationFromY ?? 24,
        scale: props.animationFromScale ?? 1,
        rotation: props.animationFromRotation ?? 0,
      };
    default:
      return null;
  }
}

function useGsapAnimation(
  elementRef: RefObject<HTMLElement | null>,
  nodeId: string,
  props: ResponsiveProps,
  editing: boolean,
) {
  const play = useCallback(() => {
    const element = elementRef.current;
    const from = animationFrom(props);
    if (!element || !from) return;
    gsap.killTweensOf(element);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(element, { clearProps: "transform,opacity" });
      return;
    }
    gsap.fromTo(element, from, {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      duration: props.animationDuration ?? 0.8,
      delay: props.animationDelay ?? 0,
      ease:
        props.animationEase === "custom"
          ? props.animationCustomEase || "power2.out"
          : (props.animationEase ?? "power2.out"),
      repeat: props.animationRepeat ?? 0,
      repeatDelay: props.animationRepeatDelay ?? 0,
      yoyo: props.animationYoyo ?? false,
      overwrite: "auto",
      clearProps: "transform,opacity",
    });
  }, [elementRef, props, nodeId]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || props.animationType === "none" || !props.animationType)
      return;
    const replay = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeId?: string }>).detail;
      if (!detail?.nodeId || detail.nodeId === nodeId) play();
    };
    window.addEventListener("qentrah:play-animation", replay);
    const trigger = props.animationTrigger ?? "load";
    if (!editing && trigger === "load") play();
    if (!editing && trigger === "in-view") {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            play();
            observer.disconnect();
          }
        },
        { threshold: 0.2 },
      );
      observer.observe(element);
      return () => {
        observer.disconnect();
        window.removeEventListener("qentrah:play-animation", replay);
        gsap.killTweensOf(element);
      };
    }
    if (!editing && trigger === "hover")
      element.addEventListener("mouseenter", play);
    if (!editing && trigger === "click")
      element.addEventListener("click", play);
    return () => {
      window.removeEventListener("qentrah:play-animation", replay);
      element.removeEventListener("mouseenter", play);
      element.removeEventListener("click", play);
      gsap.killTweensOf(element);
    };
  }, [
    editing,
    elementRef,
    nodeId,
    play,
    props.animationTrigger,
    props.animationType,
  ]);
}

export type LayoutProps = ResponsiveProps & {
  children?: ReactNode;
  layout?: "block" | "container" | "flex" | "grid" | "none";
  direction?: "row" | "column" | "row-reverse" | "column-reverse";
  wrap?: "nowrap" | "wrap" | "wrap-reverse";
  columns?: string;
  gap?: number | string;
  rowGap?: number | string;
  columnGap?: number | string;
  padding?: number | string;
  paddingTop?: number | string;
  paddingRight?: number | string;
  paddingBottom?: number | string;
  paddingLeft?: number | string;
  minHeight?: number | string;
  width?: number | string;
  background?: string;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  position?: CSSProperties["position"];
  maxWidth?: string;
  margin?: string;
  marginTop?: number | string;
  marginRight?: number | string;
  marginBottom?: number | string;
  marginLeft?: number | string;
  overflow?: CSSProperties["overflow"];
  borderWidth?: number;
  borderStyle?: CSSProperties["borderStyle"];
  borderColor?: string;
  borderRadius?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: string;
  order?: number;
  alignSelf?: CSSProperties["alignSelf"];
  gridRows?: string;
  gridAutoFlow?: CSSProperties["gridAutoFlow"];
  justifyItems?: CSSProperties["justifyItems"];
  gridColumn?: string;
  gridRow?: string;
  backgroundType?: "color" | "gradient" | "image" | "video";
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
  backgroundImage?: string;
  backgroundVideo?: string;
  backgroundPoster?: string;
  backgroundSize?: CSSProperties["backgroundSize"];
  backgroundPosition?: CSSProperties["backgroundPosition"];
  backgroundRepeat?: CSSProperties["backgroundRepeat"];
  themePrimary?: string;
  themeSecondary?: string;
  themeBackground?: string;
  themeText?: string;
  fontFamily?: string;
  headingFontFamily?: string;
};

function layoutStyle(props: LayoutProps): CSSProperties {
  const isContainer = props.layout === "container";
  const marginParts = String(props.margin ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const marginFallback =
    marginParts.length === 1
      ? [marginParts[0], marginParts[0], marginParts[0], marginParts[0]]
      : marginParts.length === 2
        ? [marginParts[0], marginParts[1], marginParts[0], marginParts[1]]
        : marginParts.length === 3
          ? [marginParts[0], marginParts[1], marginParts[2], marginParts[1]]
          : marginParts;
  const backgroundType = props.backgroundType ?? "color";
  const backgroundImage =
    backgroundType === "gradient"
      ? `linear-gradient(${props.gradientAngle ?? 135}deg, ${props.gradientFrom ?? "#ffffff"}, ${props.gradientTo ?? "#e0e7ff"})`
      : backgroundType === "image" && props.backgroundImage
        ? `url("${props.backgroundImage}")`
        : undefined;
  return {
    display: isContainer ? "flex" : (props.layout ?? "flex"),
    flexDirection: props.direction ?? "column",
    flexWrap: props.wrap ?? "nowrap",
    gridTemplateColumns:
      props.layout === "grid"
        ? (props.columns ?? "repeat(2, minmax(0, 1fr))")
        : undefined,
    rowGap: props.rowGap ?? props.gap ?? 16,
    columnGap: props.columnGap ?? props.gap ?? 16,
    paddingTop: props.paddingTop ?? props.padding ?? 24,
    paddingRight: props.paddingRight ?? props.padding ?? 24,
    paddingBottom: props.paddingBottom ?? props.padding ?? 24,
    paddingLeft: props.paddingLeft ?? props.padding ?? 24,
    minHeight: props.minHeight ?? 80,
    width: props.width ?? "100%",
    backgroundColor:
      backgroundType === "color"
        ? (props.background ?? "transparent")
        : undefined,
    backgroundImage,
    backgroundSize: props.backgroundSize ?? "cover",
    backgroundPosition: props.backgroundPosition ?? "center",
    backgroundRepeat: props.backgroundRepeat ?? "no-repeat",
    alignItems: props.align ?? "stretch",
    justifyContent: props.justify ?? "flex-start",
    position: props.position ?? "relative",
    left: props.offsetX,
    top: props.offsetY,
    maxWidth: props.maxWidth ?? (isContainer ? "1200px" : undefined),
    marginTop: props.marginTop ?? marginFallback[0],
    marginRight:
      props.marginRight ??
      marginFallback[1] ??
      (isContainer ? "auto" : undefined),
    marginBottom: props.marginBottom ?? marginFallback[2],
    marginLeft:
      props.marginLeft ??
      marginFallback[3] ??
      (isContainer ? "auto" : undefined),
    overflow: props.overflow ?? "visible",
    borderWidth: props.borderWidth ?? 0,
    borderStyle: props.borderStyle ?? "solid",
    borderColor: props.borderColor ?? "transparent",
    borderRadius: props.borderRadius ?? 0,
    flexGrow: props.flexGrow,
    flexShrink: props.flexShrink,
    flexBasis: props.flexBasis,
    order: props.order,
    alignSelf: props.alignSelf,
    gridTemplateRows: props.gridRows,
    gridAutoFlow: props.gridAutoFlow,
    justifyItems: props.justifyItems,
    gridColumn: props.gridColumn,
    gridRow: props.gridRow,
    isolation: backgroundType === "video" ? "isolate" : undefined,
  };
}

function BackgroundVideo(props: LayoutProps) {
  if (props.backgroundType !== "video" || !props.backgroundVideo) return null;
  const objectFit: CSSProperties["objectFit"] =
    props.backgroundSize === "contain" || props.backgroundSize === "fill"
      ? (props.backgroundSize as CSSProperties["objectFit"])
      : "cover";
  return (
    <video
      aria-hidden="true"
      autoPlay
      muted
      loop
      playsInline
      poster={props.backgroundPoster}
      src={props.backgroundVideo}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit,
        objectPosition: props.backgroundPosition ?? "center",
        pointerEvents: "none",
        zIndex: -1,
      }}
    />
  );
}

export function QBody(props: LayoutProps) {
  const { connectors, id } = useNode();
  const elementRef = useRef<HTMLElement | null>(null);
  const responsive = useResponsiveProps(props);
  useGsapAnimation(elementRef, id, responsive.props, responsive.editing);
  const bodyFont = responsive.props.fontFamily ?? "Inter";
  const headingFont = responsive.props.headingFontFamily ?? bodyFont;
  useEffect(() => {
    [bodyFont, headingFont].forEach((font) => {
      const key = `qentrah-font-${font.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      if (document.getElementById(key)) return;
      const link = document.createElement("link");
      link.id = key;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, "+")}:wght@300;400;500;600;700;800&display=swap`;
      document.head.appendChild(link);
    });
  }, [bodyFont, headingFont]);
  return (
    <main
      ref={(node) => {
        elementRef.current = node;
        if (node) connectors.connect(node);
      }}
      style={{
        ...layoutStyle(responsive.props),
        fontFamily: `"${bodyFont}", sans-serif`,
        color: responsive.props.themeText ?? "#18181b",
        ...({
          "--qentrah-primary": responsive.props.themePrimary ?? "#2563eb",
          "--qentrah-secondary": responsive.props.themeSecondary ?? "#7c3aed",
          "--qentrah-background": responsive.props.themeBackground ?? "#ffffff",
          "--qentrah-text": responsive.props.themeText ?? "#18181b",
          "--qentrah-body-font": `"${bodyFont}", sans-serif`,
          "--qentrah-heading-font": `"${headingFont}", sans-serif`,
        } as CSSProperties),
        ...visibilityStyle(responsive.hidden, responsive.editing),
        ...(responsive.editing && responsive.props.layout === "none"
          ? { display: "block", opacity: 0.28, filter: "grayscale(1)" }
          : {}),
      }}
    >
      <BackgroundVideo {...responsive.props} />
      {props.children}
    </main>
  );
}

QBody.craft = {
  displayName: "Body",
  props: {
    layout: "flex",
    direction: "column",
    wrap: "nowrap",
    columns: "repeat(2, minmax(0, 1fr))",
    gap: 0,
    padding: 0,
    minHeight: "100vh",
    width: "100%",
    maxWidth: "none",
    margin: "0 auto",
    background: "#ffffff",
    backgroundType: "color",
    align: "stretch",
    justify: "flex-start",
    position: "relative",
    overflow: "visible",
    themePrimary: "#2563eb",
    themeSecondary: "#7c3aed",
    themeBackground: "#ffffff",
    themeText: "#18181b",
    fontFamily: "Inter",
    headingFontFamily: "Inter",
    responsive: {
      tablet: { width: "100%" },
      mobile: { width: "100%" },
    },
  },
  rules: {
    canDrag: () => false,
    canMoveIn: (incoming: Array<{ data: { displayName?: string } }>) =>
      incoming.every((node) => node.data.displayName === "Section"),
  },
};

export function QSection(props: LayoutProps) {
  const { connectors, id } = useNode();
  const elementRef = useRef<HTMLElement | null>(null);
  const responsive = useResponsiveProps(props);
  useGsapAnimation(elementRef, id, responsive.props, responsive.editing);
  return (
    <section
      ref={(node) => {
        elementRef.current = node;
        if (node) connectors.connect(node);
      }}
      style={{
        ...layoutStyle(responsive.props),
        ...(responsive.editing && responsive.props.layout === "container"
          ? {
              outline: "1px dashed rgba(37, 99, 235, 0.28)",
              outlineOffset: -1,
            }
          : {}),
        ...visibilityStyle(responsive.hidden, responsive.editing),
        ...(responsive.editing && responsive.props.layout === "none"
          ? { display: "block", opacity: 0.28, filter: "grayscale(1)" }
          : {}),
      }}
    >
      <BackgroundVideo {...responsive.props} />
      {props.children}
    </section>
  );
}

QSection.craft = {
  displayName: "Section",
  props: {
    layout: "flex",
    direction: "column",
    wrap: "nowrap",
    columns: "repeat(2, minmax(0, 1fr))",
    gap: 24,
    padding: 48,
    minHeight: 160,
    background: "#ffffff",
    backgroundType: "color",
    align: "stretch",
    justify: "flex-start",
    width: "100%",
    maxWidth: "100%",
    responsive: {
      tablet: { padding: 32, gap: 20 },
      mobile: { padding: 20, gap: 16, minHeight: "auto" },
    },
  },
  rules: { canDrag: () => true },
};

export function QContainer(props: LayoutProps) {
  const { connectors, id } = useNode();
  const elementRef = useRef<HTMLElement | null>(null);
  const responsive = useResponsiveProps(props);
  useGsapAnimation(elementRef, id, responsive.props, responsive.editing);
  return (
    <div
      ref={(node) => {
        elementRef.current = node;
        if (node) connectors.connect(node);
      }}
      style={{
        ...layoutStyle(responsive.props),
        ...visibilityStyle(responsive.hidden, responsive.editing),
        ...(responsive.editing && responsive.props.layout === "none"
          ? { display: "block", opacity: 0.28, filter: "grayscale(1)" }
          : {}),
      }}
    >
      <BackgroundVideo {...responsive.props} />
      {props.children}
    </div>
  );
}

QContainer.craft = {
  displayName: "Container",
  props: {
    layout: "container",
    direction: "column",
    wrap: "nowrap",
    columns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
    padding: 32,
    minHeight: 100,
    background: "transparent",
    backgroundType: "color",
    align: "stretch",
    justify: "flex-start",
    width: "100%",
    maxWidth: "1200px",
    margin: "0 auto",
    responsive: {
      tablet: {
        padding: 24,
        gap: 14,
        maxWidth: "100%",
      },
      mobile: {
        padding: 16,
        gap: 12,
        columns: "minmax(0, 1fr)",
        minHeight: "auto",
      },
    },
  },
};

type TextProps = ResponsiveProps & {
  text?: string;
  as?: "h1" | "h2" | "h3" | "p";
  fontSize?: number | string;
  color?: string;
  align?: CSSProperties["textAlign"];
  weight?: CSSProperties["fontWeight"];
  width?: number | string;
  minHeight?: number | string;
  lineHeight?: number | string;
  letterSpacing?: number | string;
  textTransform?: CSSProperties["textTransform"];
  textDecoration?: CSSProperties["textDecoration"];
  whiteSpace?: CSSProperties["whiteSpace"];
  fontFamily?: string;
};

export function QText(inputProps: TextProps) {
  const { connectors, id } = useNode();
  const elementRef = useRef<HTMLElement | null>(null);
  const responsive = useResponsiveProps(inputProps);
  useGsapAnimation(elementRef, id, responsive.props, responsive.editing);
  const {
    text = "Edit this text",
    as = "p",
    fontSize = 18,
    color = "#18181b",
    align = "left",
    weight = 400,
    width = "auto",
    minHeight,
    lineHeight = "1.4em",
    letterSpacing = 0,
    textTransform = "none",
    textDecoration = "none",
    whiteSpace = "normal",
    fontFamily,
  } = responsive.props;
  const Tag = as as ElementType;
  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        elementRef.current = node;
        if (node) connectors.connect(node);
      }}
      style={{
        margin: 0,
        fontSize,
        color,
        textAlign: align,
        fontWeight: weight,
        fontFamily:
          fontFamily ??
          (String(as).startsWith("h")
            ? "var(--qentrah-heading-font)"
            : "var(--qentrah-body-font)"),
        width,
        minHeight,
        lineHeight,
        letterSpacing,
        textTransform,
        textDecoration,
        whiteSpace,
        ...itemStyle(responsive.props),
        ...visibilityStyle(responsive.hidden, responsive.editing),
      }}
    >
      {text}
    </Tag>
  );
}

QText.craft = {
  displayName: "Text",
  props: {
    text: "Edit this text",
    as: "p",
    fontSize: 18,
    color: "#18181b",
    align: "left",
    weight: 400,
    lineHeight: "1.4em",
    letterSpacing: 0,
    width: "100%",
    responsive: {
      mobile: { fontSize: 16 },
    },
  },
};

type ButtonProps = ResponsiveProps & {
  text?: string;
  href?: string;
  background?: string;
  color?: string;
  width?: number | string;
  maxWidth?: number | string;
  minHeight?: number | string;
  fontSize?: number | string;
  weight?: CSSProperties["fontWeight"];
  lineHeight?: number | string;
  letterSpacing?: number | string;
  textTransform?: CSSProperties["textTransform"];
  fontFamily?: string;
};

export function QButton(inputProps: ButtonProps) {
  const { connectors, id } = useNode();
  const elementRef = useRef<HTMLElement | null>(null);
  const responsive = useResponsiveProps(inputProps);
  useGsapAnimation(elementRef, id, responsive.props, responsive.editing);
  const {
    text = "Button",
    href = "#",
    background = "#2563eb",
    color = "#ffffff",
    width = "fit-content",
    maxWidth = "100%",
    minHeight,
    fontSize = 14,
    weight = 600,
    lineHeight = "1.2em",
    letterSpacing = 0,
    textTransform = "none",
    fontFamily,
  } = responsive.props;
  return (
    <a
      ref={(node) => {
        elementRef.current = node;
        if (node) connectors.connect(node);
      }}
      href={href}
      onClick={(event) => {
        if (responsive.editing) event.preventDefault();
      }}
      style={{
        display: "inline-flex",
        width,
        maxWidth,
        minHeight,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        background,
        color,
        padding: "10px 16px",
        fontSize,
        fontWeight: weight,
        fontFamily: fontFamily ?? "var(--qentrah-body-font)",
        lineHeight,
        letterSpacing,
        textTransform,
        textDecoration: "none",
        ...itemStyle(responsive.props),
        ...visibilityStyle(responsive.hidden, responsive.editing),
      }}
    >
      {text}
    </a>
  );
}

QButton.craft = {
  displayName: "Button",
  props: {
    text: "Button",
    href: "#",
    background: "#2563eb",
    color: "#ffffff",
    width: "fit-content",
    maxWidth: "100%",
    fontSize: 14,
    weight: 600,
    lineHeight: "1.2em",
    letterSpacing: 0,
    textTransform: "none",
    responsive: { mobile: { width: "100%" } },
  },
};

export const QENTRAH_RESOLVER = {
  QBody,
  QSection,
  QContainer,
  QText,
  QButton,
};
