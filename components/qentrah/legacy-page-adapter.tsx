import { cloneElement } from "react";
import { Element as CraftElement } from "@craftjs/core";

import {
  isLegacyPuckPageData,
  localizedText,
  type LegacyPuckBlock,
} from "@/lib/qentrah/legacy-page-data";

import { QBody, QButton, QContainer, QSection, QText } from "./editor-nodes";

type Locale = "ar" | "en";
type Item = Record<string, unknown>;

function text(value: unknown, locale: Locale) {
  return localizedText(value, locale);
}

function items(value: unknown): Item[] {
  return Array.isArray(value)
    ? value.filter((item): item is Item => !!item && typeof item === "object")
    : [];
}

function BlockContainer({
  children,
  name,
  background = "#ffffff",
}: {
  children: React.ReactNode;
  name: string;
  background?: string;
}) {
  return (
    <CraftElement
      is={QSection}
      canvas
      background={background}
      padding={0}
      minHeight="auto"
      custom={{ displayName: name }}
    >
      <CraftElement
        is={QContainer}
        canvas
        layout="container"
        maxWidth="1200px"
        paddingTop={64}
        paddingRight={32}
        paddingBottom={64}
        paddingLeft={32}
        gap={18}
        minHeight="auto"
        responsive={{
          tablet: { paddingTop: 48, paddingBottom: 48 },
          mobile: {
            paddingTop: 32,
            paddingRight: 20,
            paddingBottom: 32,
            paddingLeft: 20,
          },
        }}
        custom={{ displayName: `${name} content` }}
      >
        {children}
      </CraftElement>
    </CraftElement>
  );
}

function renderHeading(
  props: Record<string, unknown>,
  locale: Locale,
  level: "h1" | "h2" = "h2",
) {
  const align = props.align === "center" ? "center" : "left";
  const eyebrow = text(props.eyebrow, locale);
  const title = text(props.title, locale);
  const body = text(props.body ?? props.subtitle, locale);

  return (
    <>
      {eyebrow ? (
        <QText
          text={eyebrow}
          fontSize={12}
          weight={700}
          letterSpacing="0.12em"
          textTransform="uppercase"
          color="#71717a"
          align={align}
        />
      ) : null}
      {title ? (
        <QText
          as={level}
          text={title}
          fontSize={level === "h1" ? 52 : 36}
          weight={700}
          align={align}
          responsive={{
            tablet: { fontSize: level === "h1" ? 42 : 32 },
            mobile: { fontSize: level === "h1" ? 34 : 28 },
          }}
        />
      ) : null}
      {body ? (
        <QText
          text={body}
          fontSize={18}
          color="#52525b"
          align={align}
          lineHeight="1.7em"
        />
      ) : null}
    </>
  );
}

function LegacyBlock({
  block,
  locale,
}: {
  block: LegacyPuckBlock;
  locale: Locale;
}) {
  const props = block.props;

  if (block.type === "Hero") {
    return BlockContainer({
      name: "Hero section",
      children: (
        <>
          {renderHeading(props, locale, "h1")}
          <CraftElement
            is={QContainer}
            canvas
            layout="flex"
            direction="row"
            maxWidth="100%"
            padding={0}
            gap={12}
            minHeight="auto"
            custom={{ displayName: "Hero actions" }}
          >
            {text(props.ctaLabel, locale) ? (
              <QButton
                text={text(props.ctaLabel, locale)}
                href={typeof props.ctaHref === "string" ? props.ctaHref : "#"}
                background="#18181b"
              />
            ) : null}
            {text(props.secondaryCtaLabel, locale) ? (
              <QButton
                text={text(props.secondaryCtaLabel, locale)}
                href={
                  typeof props.secondaryCtaHref === "string"
                    ? props.secondaryCtaHref
                    : "#"
                }
                background="#f4f4f5"
                color="#18181b"
              />
            ) : null}
          </CraftElement>
        </>
      ),
    });
  }

  if (block.type === "SectionHeading") {
    return BlockContainer({
      name: "Section heading",
      children: renderHeading(props, locale),
    });
  }

  if (block.type === "Text") {
    return BlockContainer({
      name: "Text section",
      children: (
        <QText
          text={text(props.body, locale)}
          fontSize={18}
          lineHeight="1.75em"
          align={props.align === "center" ? "center" : "left"}
        />
      ),
    });
  }

  if (block.type === "FeatureGrid" || block.type === "PropertyShowcase") {
    const cards = items(props.items);
    return BlockContainer({
      name: block.type === "FeatureGrid" ? "Features" : "Showcase",
      background: "#fafafa",
      children: (
        <>
          {renderHeading(props, locale)}
          <CraftElement
            is={QContainer}
            canvas
            layout="grid"
            columns={`repeat(${Math.max(1, Math.min(4, Number(props.columns) || cards.length || 3))}, minmax(0, 1fr))`}
            maxWidth="100%"
            padding={0}
            gap={16}
            minHeight="auto"
            responsive={{
              tablet: { columns: "repeat(2, minmax(0, 1fr))" },
              mobile: { columns: "minmax(0, 1fr)" },
            }}
            custom={{ displayName: "Cards" }}
          >
            {cards.map((item, index) => (
              <CraftElement
                key={`${block.type}-${index}`}
                is={QContainer}
                canvas
                layout="flex"
                maxWidth="100%"
                padding={24}
                gap={10}
                minHeight={140}
                background="#ffffff"
                custom={{ displayName: `Card ${index + 1}` }}
              >
                <QText
                  as="h3"
                  text={text(item.title, locale) || `Item ${index + 1}`}
                  fontSize={20}
                  weight={700}
                />
                <QText
                  text={text(item.body ?? item.location, locale)}
                  fontSize={15}
                  color="#52525b"
                />
                {typeof item.price === "string" && item.price ? (
                  <QText text={item.price} fontSize={14} weight={700} />
                ) : null}
              </CraftElement>
            ))}
          </CraftElement>
        </>
      ),
    });
  }

  if (block.type === "StatsStrip") {
    return BlockContainer({
      name: "Statistics",
      background: "#18181b",
      children: (
        <CraftElement
          is={QContainer}
          canvas
          layout="grid"
          columns={`repeat(${Math.max(1, items(props.items).length)}, minmax(0, 1fr))`}
          maxWidth="100%"
          padding={0}
          gap={16}
          minHeight="auto"
          responsive={{ mobile: { columns: "minmax(0, 1fr)" } }}
          custom={{ displayName: "Statistics grid" }}
        >
          {items(props.items).map((item, index) => (
            <CraftElement
              key={`stat-${index}`}
              is={QContainer}
              canvas
              maxWidth="100%"
              padding={16}
              gap={6}
              minHeight="auto"
              custom={{ displayName: `Statistic ${index + 1}` }}
            >
              <QText
                text={String(item.value ?? "")}
                fontSize={30}
                weight={700}
                color="#ffffff"
              />
              <QText
                text={text(item.label, locale)}
                fontSize={14}
                color="#d4d4d8"
              />
            </CraftElement>
          ))}
        </CraftElement>
      ),
    });
  }

  if (block.type === "ContactBand" || block.type === "CtaBand") {
    return BlockContainer({
      name: "Call to action",
      children: (
        <>
          {renderHeading(props, locale)}
          {text(props.ctaLabel, locale) ? (
            <QButton
              text={text(props.ctaLabel, locale)}
              href={typeof props.ctaHref === "string" ? props.ctaHref : "#"}
              background="#18181b"
            />
          ) : null}
        </>
      ),
    });
  }

  return BlockContainer({
    name: block.type,
    children: (
      <>
        <QText as="h2" text={block.type} fontSize={24} weight={700} />
        <QText
          text="This legacy section is ready to replace with editor components."
          color="#71717a"
        />
      </>
    ),
  });
}

export function LegacyPageAdapter({
  data,
  locale,
}: {
  data: unknown;
  locale: Locale;
}) {
  if (!isLegacyPuckPageData(data)) return null;

  return (
    <CraftElement
      is={QBody}
      canvas
      background="#ffffff"
      minHeight="100vh"
      custom={{ displayName: "Body" }}
    >
      {data.content.map((block, index) =>
        cloneElement(LegacyBlock({ block, locale }), {
          key:
            typeof block.props.id === "string"
              ? block.props.id
              : `${block.type}-${index}`,
        }),
      )}
    </CraftElement>
  );
}
