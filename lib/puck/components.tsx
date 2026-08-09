import type { CSSProperties, ReactNode } from "react";
import type { SlotComponent } from "@puckeditor/core";
import { ArrowRight, Check, Home, Mail, MapPin, Phone, Star } from "lucide-react";
import type { QentrahLocale } from "./localized";
import { pick } from "./localized";

type L = { ar: string; en: string } | string;

interface LocaleAware {
  locale: QentrahLocale;
}

function t(value: L | undefined, locale: QentrahLocale) {
  return pick(value, locale) || "";
}

/* ─── Layout primitives ─────────────────────────────────────────── */

export function HeroSection({
  eyebrow,
  title,
  subtitle,
  ctaLabel,
  ctaHref = "#",
  secondaryCtaLabel,
  secondaryCtaHref = "#",
  image,
  align = "center",
  height = "standard",
  locale,
}: {
  eyebrow?: L;
  title?: L;
  subtitle?: L;
  ctaLabel?: L;
  ctaHref?: string;
  secondaryCtaLabel?: L;
  secondaryCtaHref?: string;
  image?: string;
  align?: "start" | "center";
  height?: "compact" | "standard" | "large";
} & LocaleAware) {
  const centered = align === "center";
  const py =
    height === "large"
      ? "py-28 md:py-36"
      : height === "compact"
        ? "py-14 md:py-18"
        : "py-20 md:py-28";

  return (
    <section className={`relative overflow-hidden border-b border-border bg-w-canvas ${py}`}>
      {image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-background/75" />
        </>
      ) : null}
      <div
        className={`relative mx-auto flex max-w-6xl flex-col gap-5 px-6 ${
          centered ? "items-center text-center" : "items-start"
        }`}
      >
        {eyebrow ? (
          <p className="label-meta text-muted-foreground">{t(eyebrow, locale)}</p>
        ) : null}
        {title ? (
          <h1 className="max-w-4xl text-display-sm font-semibold tracking-tight text-foreground md:text-display">
            {t(title, locale)}
          </h1>
        ) : null}
        {subtitle ? (
          <p className="max-w-2xl text-body-lg text-muted-foreground">
            {t(subtitle, locale)}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-3">
          {ctaLabel ? (
            <a
              href={ctaHref}
              className="inline-flex items-center gap-1.5 rounded-sm bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-brand hover:bg-w-carbon"
            >
              {t(ctaLabel, locale)} ↗
            </a>
          ) : null}
          {secondaryCtaLabel ? (
            <a
              href={secondaryCtaHref}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-brand hover:bg-w-canvas"
            >
              {t(secondaryCtaLabel, locale)}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "start",
  locale,
}: {
  eyebrow?: L;
  title?: L;
  body?: L;
  align?: "start" | "center";
} & LocaleAware) {
  const centered = align === "center";
  return (
    <section
      className={`mx-auto max-w-6xl px-6 py-14 ${centered ? "text-center" : ""}`}
    >
      {eyebrow ? <p className="label-meta mb-3">{t(eyebrow, locale)}</p> : null}
      {title ? (
        <h2 className="text-h1 font-semibold text-foreground">{t(title, locale)}</h2>
      ) : null}
      {body ? (
        <p
          className={`mt-4 max-w-2xl text-body text-muted-foreground ${
            centered ? "mx-auto" : ""
          }`}
        >
          {t(body, locale)}
        </p>
      ) : null}
    </section>
  );
}

export function TextBlock({
  body,
  align = "start",
  locale,
}: {
  body?: L;
  align?: "start" | "center";
} & LocaleAware) {
  if (!body) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Empty text block</p>
      </div>
    );
  }
  return (
    <div
      className={`mx-auto max-w-3xl px-6 py-10 ${
        align === "center" ? "text-center" : ""
      }`}
    >
      <p className="whitespace-pre-line text-body leading-relaxed text-foreground">
        {t(body, locale)}
      </p>
    </div>
  );
}

export function DividerLine({ width = "full" }: { width?: "full" | "narrow" }) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div
        className={`h-px bg-border ${width === "narrow" ? "mx-auto w-1/3" : "w-full"}`}
      />
    </div>
  );
}

export function SpacerBlock({
  size = "md",
}: {
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const h =
    size === "sm"
      ? "h-6"
      : size === "lg"
        ? "h-20"
        : size === "xl"
          ? "h-32"
          : "h-12";
  return <div className={h} aria-hidden />;
}

/* ─── Composable builder primitives ───────────────────────────── */

const ATOMIC_COMPONENTS = [
  "HeadingBlock",
  "ParagraphBlock",
  "ButtonBlock",
  "MediaBlock",
  "IconBlock",
  "Divider",
  "Spacer",
  "CmsCollection",
  "CmsField",
];

export function BuilderSection({
  content: Content,
  contentWidth = "wide",
  padding = "large",
  minHeight = "auto",
  verticalAlign = "center",
  backgroundType = "none",
  backgroundColor = "#ffffff",
  backgroundImage,
  backgroundVideo,
  backgroundCss,
  backgroundSound,
  overlay = "rgba(0,0,0,0)",
  direction = "ltr",
  rtlBehavior = "auto",
}: {
  content: SlotComponent;
  contentWidth?: "narrow" | "wide" | "full";
  padding?: "none" | "small" | "medium" | "large";
  minHeight?: "auto" | "screen" | "half";
  verticalAlign?: "start" | "center" | "end";
  backgroundType?: "none" | "color" | "image" | "video" | "css";
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundVideo?: string;
  backgroundCss?: string;
  backgroundSound?: string;
  overlay?: string;
  direction?: "ltr" | "rtl";
  rtlBehavior?: "auto" | "preserve";
}) {
  const maxWidth =
    contentWidth === "narrow"
      ? "max-w-3xl"
      : contentWidth === "full"
        ? "max-w-none"
        : "max-w-6xl";
  const spacing =
    padding === "none"
      ? "py-0"
      : padding === "small"
        ? "py-6"
        : padding === "medium"
          ? "py-12"
          : "py-20";
  const height =
    minHeight === "screen"
      ? "min-h-screen"
      : minHeight === "half"
        ? "min-h-[50vh]"
        : "min-h-0";
  const justify =
    verticalAlign === "start"
      ? "justify-start"
      : verticalAlign === "end"
        ? "justify-end"
        : "justify-center";
  const style: CSSProperties = {};
  if (backgroundType === "color") style.backgroundColor = backgroundColor;
  if (backgroundType === "image" && backgroundImage) {
    style.backgroundImage = `url(${backgroundImage})`;
    style.backgroundPosition = "center";
    style.backgroundSize = "cover";
  }
  if (backgroundType === "css" && backgroundCss) style.background = backgroundCss;

  return (
    <section
      className={`relative flex overflow-hidden ${height} ${spacing} ${justify}`}
      style={style}
      dir={rtlBehavior === "preserve" ? "ltr" : direction}
      data-rtl-behavior={rtlBehavior}
    >
      {backgroundType === "video" && backgroundVideo ? (
        <video
          src={backgroundVideo}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      {overlay && overlay !== "rgba(0,0,0,0)" ? (
        <span className="pointer-events-none absolute inset-0" style={{ background: overlay }} />
      ) : null}
      {backgroundSound ? <audio src={backgroundSound} autoPlay loop /> : null}
      <Content
        allow={[...ATOMIC_COMPONENTS, "ColumnsBlock"]}
        minEmptyHeight={160}
        className={`relative z-10 mx-auto w-full ${maxWidth} space-y-4 px-6`}
      />
    </section>
  );
}

export function ColumnsBlock({
  columnOne: ColumnOne,
  columnTwo: ColumnTwo,
  columnThree: ColumnThree,
  columns = "2",
  gap = "medium",
  align = "stretch",
  direction = "ltr",
  rtlBehavior = "auto",
}: {
  columnOne: SlotComponent;
  columnTwo: SlotComponent;
  columnThree: SlotComponent;
  columns?: "2" | "3";
  gap?: "none" | "small" | "medium" | "large";
  align?: "start" | "center" | "end" | "stretch";
  direction?: "ltr" | "rtl";
  rtlBehavior?: "auto" | "preserve";
}) {
  const gapClass =
    gap === "none" ? "gap-0" : gap === "small" ? "gap-3" : gap === "large" ? "gap-10" : "gap-6";
  const alignClass =
    align === "start" ? "items-start" : align === "center" ? "items-center" : align === "end" ? "items-end" : "items-stretch";
  const slotClass = "min-w-0 rounded-sm border border-dashed border-transparent p-2";
  return (
    <div
      className={`grid ${columns === "3" ? "md:grid-cols-3" : "md:grid-cols-2"} ${gapClass} ${alignClass}`}
      dir={rtlBehavior === "preserve" ? "ltr" : direction}
      data-rtl-behavior={rtlBehavior}
    >
      <ColumnOne allow={ATOMIC_COMPONENTS} minEmptyHeight={120} className={slotClass} />
      <ColumnTwo allow={ATOMIC_COMPONENTS} minEmptyHeight={120} className={slotClass} />
      {columns === "3" ? (
        <ColumnThree allow={ATOMIC_COMPONENTS} minEmptyHeight={120} className={slotClass} />
      ) : null}
    </div>
  );
}

export function HeadingBlock({
  text,
  level = "2",
  align = "start",
  size = "large",
}: {
  text?: ReactNode;
  level?: "1" | "2" | "3" | "4";
  align?: "start" | "center" | "end";
  size?: "small" | "medium" | "large" | "display";
}) {
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
  const sizeClass =
    size === "display"
      ? "text-5xl md:text-7xl"
      : size === "large"
        ? "text-3xl md:text-5xl"
        : size === "medium"
          ? "text-2xl md:text-3xl"
          : "text-lg md:text-xl";
  const alignment = align === "center" ? "text-center" : align === "end" ? "text-end" : "text-start";
  return <Tag className={`${sizeClass} ${alignment} font-semibold tracking-tight`}>{text}</Tag>;
}

export function ParagraphBlock({
  text,
  align = "start",
  size = "medium",
}: {
  text?: ReactNode;
  align?: "start" | "center" | "end";
  size?: "small" | "medium" | "large";
}) {
  const sizeClass = size === "large" ? "text-lg" : size === "small" ? "text-sm" : "text-base";
  const alignment = align === "center" ? "text-center" : align === "end" ? "text-end" : "text-start";
  return <div className={`${sizeClass} ${alignment} leading-relaxed text-muted-foreground`}>{text}</div>;
}

export function ButtonBlock({
  label,
  href = "#",
  align = "start",
  style = "primary",
}: {
  label?: ReactNode;
  href?: string;
  align?: "start" | "center" | "end";
  style?: "primary" | "secondary" | "link";
}) {
  const alignment = align === "center" ? "justify-center" : align === "end" ? "justify-end" : "justify-start";
  const appearance =
    style === "secondary"
      ? "border border-border bg-white text-foreground"
      : style === "link"
        ? "bg-transparent px-0 text-foreground underline underline-offset-4"
        : "bg-[#4353ff] text-white";
  return (
    <div className={`flex ${alignment}`}>
      <a href={href} className={`inline-flex min-h-10 items-center rounded px-5 text-sm font-medium ${appearance}`}>
        {label}
      </a>
    </div>
  );
}

export function MediaBlock({
  kind = "image",
  source,
  alt = "",
  radius = "medium",
}: {
  kind?: "image" | "video" | "audio";
  source?: string;
  alt?: string;
  radius?: "none" | "small" | "medium" | "large";
}) {
  const rounded = radius === "none" ? "rounded-none" : radius === "small" ? "rounded" : radius === "large" ? "rounded-2xl" : "rounded-lg";
  if (!source) {
    return <div className={`flex aspect-video items-center justify-center border border-dashed border-border bg-muted text-xs text-muted-foreground ${rounded}`}>Select media</div>;
  }
  if (kind === "video") return <video src={source} controls className={`w-full ${rounded}`} />;
  if (kind === "audio") return <audio src={source} controls className="w-full" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={source} alt={alt} className={`w-full object-cover ${rounded}`} />;
}

const ICONS = { arrow: ArrowRight, check: Check, home: Home, mail: Mail, map: MapPin, phone: Phone, star: Star };

export function IconBlock({
  icon = "star",
  align = "start",
  size = "medium",
}: {
  icon?: keyof typeof ICONS;
  align?: "start" | "center" | "end";
  size?: "small" | "medium" | "large";
}) {
  const Icon = ICONS[icon] || Star;
  const alignment = align === "center" ? "justify-center" : align === "end" ? "justify-end" : "justify-start";
  const iconSize = size === "large" ? "size-12" : size === "small" ? "size-5" : "size-8";
  return (
    <div className={`flex ${alignment}`}>
      <Icon
        className={`${iconSize} ${icon === "arrow" ? "wai-directional-icon" : ""}`}
        strokeWidth={1.5}
      />
    </div>
  );
}

/* ─── Content blocks ────────────────────────────────────────────── */

export function FeatureGrid({
  eyebrow,
  title,
  items = [],
  columns = "3",
  locale,
}: {
  eyebrow?: L;
  title?: L;
  items?: Array<{ title?: L; body?: L }>;
  columns?: "2" | "3" | "4";
} & LocaleAware) {
  const col =
    columns === "2"
      ? "md:grid-cols-2"
      : columns === "4"
        ? "md:grid-cols-2 lg:grid-cols-4"
        : "md:grid-cols-3";

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10 max-w-2xl">
        {eyebrow ? <p className="label-meta mb-3">{t(eyebrow, locale)}</p> : null}
        {title ? (
          <h2 className="text-h1 font-semibold text-foreground">
            {t(title, locale)}
          </h2>
        ) : null}
      </div>
      <div className={`grid gap-6 ${col}`}>
        {(items.length ? items : [{}, {}, {}]).map((item, index) => (
          <article
            key={index}
            className="border border-border bg-card p-6 transition-brand hover:bg-w-canvas"
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="flex size-8 items-center justify-center border border-border font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            {item.title ? (
              <h3 className="text-sm font-medium text-foreground">
                {t(item.title, locale)}
              </h3>
            ) : (
              <div className="h-4 w-2/3 bg-border" />
            )}
            {item.body ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(item.body, locale)}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function StatsStrip({
  items = [],
  locale,
}: {
  items?: Array<{ value?: string; label?: L }>;
} & LocaleAware) {
  const rows = items.length ? items : [{ value: "—" }, { value: "—" }, { value: "—" }];
  return (
    <section className="border-y border-border bg-w-canvas">
      <div className="mx-auto grid max-w-6xl gap-px bg-border sm:grid-cols-3">
        {rows.map((item, index) => (
          <div key={index} className="bg-card px-6 py-10">
            <p className="text-display-sm font-semibold tracking-tight text-foreground">
              {item.value || "0"}
            </p>
            {item.label ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t(item.label, locale)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function ImageText({
  eyebrow,
  title,
  body,
  image,
  imageAlt,
  imageSide = "end",
  locale,
}: {
  eyebrow?: L;
  title?: L;
  body?: L;
  image?: string;
  imageAlt?: L;
  imageSide?: "start" | "end";
} & LocaleAware) {
  const media = (
    <div className="aspect-[4/3] overflow-hidden border border-border bg-w-canvas">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={t(imageAlt, locale)}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <p className="label-meta">IMAGE</p>
        </div>
      )}
    </div>
  );
  const copy = (
    <div className="flex flex-col justify-center py-4">
      {eyebrow ? <p className="label-meta mb-3">{t(eyebrow, locale)}</p> : null}
      {title ? (
        <h2 className="text-h1 font-semibold text-foreground">
          {t(title, locale)}
        </h2>
      ) : null}
      {body ? (
        <p className="mt-4 text-body text-muted-foreground">{t(body, locale)}</p>
      ) : null}
    </div>
  );
  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2">
      {imageSide === "start" ? media : copy}
      {imageSide === "start" ? copy : media}
    </section>
  );
}

export function GalleryGrid({
  eyebrow,
  title,
  items = [],
  locale,
}: {
  eyebrow?: L;
  title?: L;
  items?: Array<{ image?: string; caption?: L }>;
} & LocaleAware) {
  const rows = items.length ? items : [{}, {}, {}];
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10">
        {eyebrow ? <p className="label-meta mb-3">{t(eyebrow, locale)}</p> : null}
        {title ? (
          <h2 className="text-h1 font-semibold text-foreground">
            {t(title, locale)}
          </h2>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((item, i) => (
          <figure key={i} className="border border-border bg-card">
            <div className="aspect-[4/3] bg-w-canvas">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <span className="label-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
              )}
            </div>
            {item.caption ? (
              <figcaption className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                {t(item.caption, locale)}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}

export function LogoCloud({
  eyebrow,
  title,
  items = [],
  locale,
}: {
  eyebrow?: L;
  title?: L;
  items?: Array<{ label?: string }>;
} & LocaleAware) {
  const rows = items.length
    ? items
    : [{ label: "Acme" }, { label: "North" }, { label: "Orbit" }, { label: "Peak" }];
  return (
    <section className="border-y border-border bg-card py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-8 text-center">
          {eyebrow ? <p className="label-meta mb-2">{t(eyebrow, locale)}</p> : null}
          {title ? (
            <h2 className="text-h2 font-medium text-foreground">
              {t(title, locale)}
            </h2>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {rows.map((item, i) => (
            <div
              key={i}
              className="flex h-16 items-center justify-center border border-border bg-w-canvas font-mono text-xs uppercase tracking-widest text-muted-foreground"
            >
              {item.label || "Logo"}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqList({
  eyebrow,
  title,
  items = [],
  locale,
}: {
  eyebrow?: L;
  title?: L;
  items?: Array<{ q?: L; a?: L }>;
} & LocaleAware) {
  const rows = items.length
    ? items
    : [
        { q: { ar: "سؤال؟", en: "A question?" }, a: { ar: "إجابة.", en: "An answer." } },
      ];
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10">
        {eyebrow ? <p className="label-meta mb-3">{t(eyebrow, locale)}</p> : null}
        {title ? (
          <h2 className="text-h1 font-semibold text-foreground">
            {t(title, locale)}
          </h2>
        ) : null}
      </div>
      <div className="divide-y divide-border border-t border-border">
        {rows.map((item, i) => (
          <div key={i} className="py-5">
            {item.q ? (
              <p className="text-sm font-medium text-foreground">
                {t(item.q, locale)}
              </p>
            ) : null}
            {item.a ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(item.a, locale)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function PricingCards({
  eyebrow,
  title,
  items = [],
  locale,
}: {
  eyebrow?: L;
  title?: L;
  items?: Array<{
    name?: L;
    price?: string;
    period?: L;
    features?: string;
    ctaLabel?: L;
    ctaHref?: string;
    highlight?: boolean | string;
  }>;
} & LocaleAware) {
  const rows = items.length
    ? items
    : [
        { name: { ar: "أساسي", en: "Basic" }, price: "0", highlight: false },
        { name: { ar: "احترافي", en: "Pro" }, price: "19", highlight: true },
        { name: { ar: "أعمال", en: "Business" }, price: "49", highlight: false },
      ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10">
        {eyebrow ? <p className="label-meta mb-3">{t(eyebrow, locale)}</p> : null}
        {title ? (
          <h2 className="text-h1 font-semibold text-foreground">
            {t(title, locale)}
          </h2>
        ) : null}
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {rows.map((plan, i) => (
          <div
            key={i}
            className={`flex flex-col border border-border p-8 ${
              plan.highlight === true || plan.highlight === "yes"
                ? "bg-foreground text-background"
                : "bg-card text-foreground"
            }`}
          >
            <p
              className={`label-meta mb-6 ${
                plan.highlight === true || plan.highlight === "yes" ? "text-background/50" : ""
              }`}
            >
              {t(plan.name, locale) || "Plan"}
            </p>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-display-sm font-semibold">
                ${plan.price || "0"}
              </span>
              {plan.period ? (
                <span
                  className={`text-sm ${
                    plan.highlight === true || plan.highlight === "yes" ? "text-background/60" : "text-muted-foreground"
                  }`}
                >
                  {t(plan.period, locale)}
                </span>
              ) : null}
            </div>
            {plan.features ? (
              <ul className="mb-8 flex-1 space-y-2 text-sm opacity-90">
                {plan.features.split("\n").filter(Boolean).map((line) => (
                  <li key={line}>· {line}</li>
                ))}
              </ul>
            ) : (
              <div className="mb-8 flex-1" />
            )}
            {plan.ctaLabel ? (
              <a
                href={plan.ctaHref || "#"}
                className={`inline-flex justify-center rounded-sm px-4 py-2.5 text-sm font-medium ${
                  plan.highlight === true || plan.highlight === "yes"
                    ? "bg-background text-foreground"
                    : "border border-border bg-background"
                }`}
              >
                {t(plan.ctaLabel, locale)}
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function CtaBand({
  eyebrow,
  title,
  body,
  ctaLabel,
  ctaHref = "#",
  locale,
}: {
  eyebrow?: L;
  title?: L;
  body?: L;
  ctaLabel?: L;
  ctaHref?: string;
} & LocaleAware) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="border border-border bg-card p-10 md:p-14">
        {eyebrow ? <p className="label-meta mb-3">{t(eyebrow, locale)}</p> : null}
        {title ? (
          <h2 className="max-w-xl text-h1 font-semibold text-foreground">
            {t(title, locale)}
          </h2>
        ) : null}
        {body ? (
          <p className="mt-4 max-w-lg text-muted-foreground">{t(body, locale)}</p>
        ) : null}
        {ctaLabel ? (
          <a
            href={ctaHref}
            className="mt-8 inline-flex items-center gap-1.5 rounded-sm bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-brand hover:bg-w-carbon"
          >
            {t(ctaLabel, locale)} ↗
          </a>
        ) : null}
      </div>
    </section>
  );
}

export function ContactBand({
  eyebrow,
  title,
  body,
  phone,
  email,
  ctaLabel,
  ctaHref = "#",
  locale,
}: {
  eyebrow?: L;
  title?: L;
  body?: L;
  phone?: string;
  email?: string;
  ctaLabel?: L;
  ctaHref?: string;
} & LocaleAware) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid gap-8 border border-border bg-card p-8 md:grid-cols-[1fr_260px] md:p-10">
        <div>
          {eyebrow ? <p className="label-meta mb-3">{t(eyebrow, locale)}</p> : null}
          {title ? (
            <h2 className="text-h1 font-semibold text-foreground">
              {t(title, locale)}
            </h2>
          ) : null}
          {body ? (
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {t(body, locale)}
            </p>
          ) : null}
        </div>
        <div className="space-y-3 border-t border-border pt-4 md:border-s md:border-t-0 md:ps-6 md:pt-0">
          {phone ? (
            <a
              dir="ltr"
              href={`tel:${phone}`}
              className="block font-mono text-sm text-foreground"
            >
              {phone}
            </a>
          ) : null}
          {email ? (
            <a
              dir="ltr"
              href={`mailto:${email}`}
              className="block font-mono text-sm text-foreground"
            >
              {email}
            </a>
          ) : null}
          {ctaLabel ? (
            <a
              href={ctaHref}
              className="inline-flex h-9 items-center rounded-sm bg-foreground px-4 text-xs font-medium text-background"
            >
              {t(ctaLabel, locale)}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function PropertyShowcase({
  eyebrow,
  title,
  items = [],
  locale,
}: {
  eyebrow?: L;
  title?: L;
  items?: Array<{
    title?: L;
    location?: L;
    price?: string;
    image?: string;
    href?: string;
  }>;
} & LocaleAware) {
  const rows = items.length ? items : [{}, {}, {}];
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10">
        {eyebrow ? <p className="label-meta mb-3">{t(eyebrow, locale)}</p> : null}
        {title ? (
          <h2 className="text-h1 font-semibold text-foreground">
            {t(title, locale)}
          </h2>
        ) : null}
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {rows.map((item, index) => (
          <a
            key={index}
            href={item.href || "#"}
            className="group flex flex-col border border-border bg-card transition-brand hover:bg-w-canvas"
          >
            <div className="aspect-[4/3] overflow-hidden bg-w-canvas">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt=""
                  className="size-full object-cover transition-brand group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <span className="label-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              {item.title ? (
                <h3 className="text-sm font-medium text-foreground">
                  {t(item.title, locale)}
                </h3>
              ) : (
                <div className="h-4 w-1/2 bg-border" />
              )}
              {item.location ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(item.location, locale)}
                </p>
              ) : null}
              {item.price ? (
                <p className="mt-4 font-mono text-xs text-muted-foreground">
                  {item.price}
                </p>
              ) : null}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
