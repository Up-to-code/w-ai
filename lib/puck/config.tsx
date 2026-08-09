import type { Config } from "@puckeditor/core";
import {
  CmsCollectionBlock,
  CmsFieldBlock,
} from "@/components/qentrah/cms-collection-block";
import {
  BuilderSection,
  ButtonBlock,
  ColumnsBlock,
  ContactBand,
  CtaBand,
  DividerLine,
  FaqList,
  FeatureGrid,
  GalleryGrid,
  HeroSection,
  HeadingBlock,
  IconBlock,
  ImageText,
  LogoCloud,
  MediaBlock,
  ParagraphBlock,
  PricingCards,
  PropertyShowcase,
  SectionHeading,
  SpacerBlock,
  StatsStrip,
  TextBlock,
} from "./components";
import {
  localizedField,
  type Localized,
  type QentrahLocale,
} from "./localized";

export interface QentrahRootProps {
  title?: Localized;
}

export type QentrahComponents = {
  Section: Record<string, unknown>;
  ColumnsBlock: Record<string, unknown>;
  HeadingBlock: Record<string, unknown>;
  ParagraphBlock: Record<string, unknown>;
  ButtonBlock: Record<string, unknown>;
  MediaBlock: Record<string, unknown>;
  IconBlock: Record<string, unknown>;
  Hero: Record<string, unknown>;
  SectionHeading: Record<string, unknown>;
  Text: Record<string, unknown>;
  FeatureGrid: Record<string, unknown>;
  StatsStrip: Record<string, unknown>;
  ImageText: Record<string, unknown>;
  Gallery: Record<string, unknown>;
  LogoCloud: Record<string, unknown>;
  Faq: Record<string, unknown>;
  Pricing: Record<string, unknown>;
  CtaBand: Record<string, unknown>;
  ContactBand: Record<string, unknown>;
  PropertyShowcase: Record<string, unknown>;
  CmsCollection: Record<string, unknown>;
  CmsField: Record<string, unknown>;
  Divider: Record<string, unknown>;
  Spacer: Record<string, unknown>;
};

const alignOptions = [
  { label: "Start", value: "start" },
  { label: "Center", value: "center" },
];

const heightOptions = [
  { label: "Compact", value: "compact" },
  { label: "Standard", value: "standard" },
  { label: "Large", value: "large" },
];

const sideOptions = [
  { label: "Start", value: "start" },
  { label: "End", value: "end" },
];

const localizedTextareaField = (label: string) => ({
  type: "textarea" as const,
  label,
});

const L = (_ar: string, en: string) => en;
const summary = (value: unknown, fallback: string) =>
  typeof value === "string"
    ? value
    : value && typeof value === "object"
      ? Object.values(value as Record<string, unknown>).find(
          (item): item is string => typeof item === "string",
        ) ?? fallback
      : fallback;

/**
 * Puck config for Curious Vessel builder.
 * Categories keep the Blocks panel organized and visible.
 */
export function buildPuckConfig(
  locale: QentrahLocale,
  profile: { direction?: "ltr" | "rtl"; preferredFont?: string } = {},
  externalData: {
    collections?: Array<{
      id: string;
      name: string;
      fields: Array<{ id?: string; key: string; label: string }>;
    }>;
    cmsEntry?: {
      collectionId: string;
      values: Record<string, unknown>;
    };
  } = {},
): Config {
  return {
    root: {
      label: "Page",
      render: ({ children }) => (
        <main
          className="min-h-screen bg-background text-foreground"
          dir={profile.direction ?? "ltr"}
          lang={locale}
          style={{ fontFamily: profile.preferredFont || "inherit" }}
        >
          {children}
        </main>
      ),
      fields: {
        title: localizedField("Page title"),
      },
    },
    categories: {
      structure: {
        title: "Blocks",
        components: ["Section", "ColumnsBlock"],
        defaultExpanded: true,
      },
      elements: {
        title: "Components",
        components: [
          "HeadingBlock",
          "ParagraphBlock",
          "ButtonBlock",
          "MediaBlock",
          "IconBlock",
          "Divider",
          "Spacer",
        ],
        defaultExpanded: true,
      },
      sections: {
        title: "Ready-made sections",
        components: [
          "Hero",
          "SectionHeading",
          "Text",
          "FeatureGrid",
          "StatsStrip",
          "ImageText",
          "Gallery",
          "LogoCloud",
          "Faq",
        ],
        defaultExpanded: false,
      },
      conversion: {
        title: "Conversion",
        components: ["Pricing", "CtaBand", "ContactBand"],
        defaultExpanded: true,
      },
      media: {
        title: "Media",
        components: ["PropertyShowcase", "CmsCollection", "CmsField"],
        defaultExpanded: false,
      },
    },
    components: {
      Section: {
        label: "Section",
        render: (props) =>
          props.visibleInLanguage === false ? null : (
            <BuilderSection
              {...(props as any)}
              direction={profile.direction ?? "ltr"}
            />
          ),
        fields: {
          content: {
            type: "slot",
            allow: [
              "HeadingBlock",
              "ParagraphBlock",
              "ButtonBlock",
              "MediaBlock",
              "IconBlock",
              "ColumnsBlock",
              "CmsCollection",
              "CmsField",
              "Divider",
              "Spacer",
            ],
          },
          contentWidth: {
            type: "select",
            label: "Content width",
            options: [
              { label: "Narrow", value: "narrow" },
              { label: "Wide", value: "wide" },
              { label: "Full width", value: "full" },
            ],
          },
          padding: {
            type: "select",
            label: "Vertical padding",
            options: [
              { label: "None", value: "none" },
              { label: "Small", value: "small" },
              { label: "Medium", value: "medium" },
              { label: "Large", value: "large" },
            ],
          },
          minHeight: {
            type: "select",
            label: "Minimum height",
            options: [
              { label: "Auto", value: "auto" },
              { label: "Half screen", value: "half" },
              { label: "Full screen", value: "screen" },
            ],
          },
          verticalAlign: {
            type: "radio",
            label: "Vertical align",
            options: [
              { label: "Top", value: "start" },
              { label: "Center", value: "center" },
              { label: "Bottom", value: "end" },
            ],
          },
          backgroundType: {
            type: "select",
            label: "Background type",
            options: [
              { label: "None", value: "none" },
              { label: "Color", value: "color" },
              { label: "Image", value: "image" },
              { label: "Video", value: "video" },
              { label: "CSS / gradient", value: "css" },
            ],
          },
          backgroundColor: { type: "text", label: "Background color" },
          backgroundImage: { type: "text", label: "Background image URL" },
          backgroundVideo: { type: "text", label: "Background video URL" },
          backgroundCss: {
            type: "textarea",
            label: "CSS background value",
          },
          backgroundSound: { type: "text", label: "Background audio URL" },
          overlay: { type: "text", label: "Overlay color" },
          rtlBehavior: {
            type: "radio",
            label: "RTL behavior",
            options: [
              { label: "Auto", value: "auto" },
              { label: "Preserve", value: "preserve" },
            ],
          },
          visibleInLanguage: {
            type: "radio",
            label: `Visible in ${locale}`,
            options: [
              { label: "Visible", value: true },
              { label: "Hidden", value: false },
            ],
          },
        },
        defaultProps: {
          content: [],
          contentWidth: "wide",
          padding: "large",
          minHeight: "auto",
          verticalAlign: "center",
          backgroundType: "none",
          backgroundColor: "#ffffff",
          overlay: "rgba(0,0,0,0)",
          rtlBehavior: "auto",
          visibleInLanguage: true,
        },
      },
      ColumnsBlock: {
        label: "Columns",
        render: (props) => (
          <ColumnsBlock
            {...(props as any)}
            direction={profile.direction ?? "ltr"}
          />
        ),
        fields: {
          columnOne: { type: "slot" },
          columnTwo: { type: "slot" },
          columnThree: { type: "slot" },
          columns: {
            type: "radio",
            label: "Columns",
            options: [
              { label: "2", value: "2" },
              { label: "3", value: "3" },
            ],
          },
          gap: {
            type: "select",
            label: "Gap",
            options: [
              { label: "None", value: "none" },
              { label: "Small", value: "small" },
              { label: "Medium", value: "medium" },
              { label: "Large", value: "large" },
            ],
          },
          align: {
            type: "select",
            label: "Vertical align",
            options: [
              { label: "Top", value: "start" },
              { label: "Center", value: "center" },
              { label: "Bottom", value: "end" },
              { label: "Stretch", value: "stretch" },
            ],
          },
          rtlBehavior: {
            type: "radio",
            label: "RTL behavior",
            options: [
              { label: "Auto", value: "auto" },
              { label: "Preserve", value: "preserve" },
            ],
          },
        },
        defaultProps: {
          columnOne: [],
          columnTwo: [],
          columnThree: [],
          columns: "2",
          gap: "medium",
          align: "stretch",
          rtlBehavior: "auto",
        },
      },
      HeadingBlock: {
        label: "Heading",
        render: (props) => <HeadingBlock {...(props as any)} />,
        fields: {
          text: {
            type: "text",
            label: "Heading text",
            contentEditable: true,
          },
          level: {
            type: "select",
            label: "HTML level",
            options: [1, 2, 3, 4].map((value) => ({
              label: `H${value}`,
              value: String(value),
            })),
          },
          size: {
            type: "select",
            label: "Size",
            options: [
              { label: "Small", value: "small" },
              { label: "Medium", value: "medium" },
              { label: "Large", value: "large" },
              { label: "Display", value: "display" },
            ],
          },
          align: { type: "radio", label: "Align", options: [...alignOptions, { label: "End", value: "end" }] },
        },
        defaultProps: { text: "Double-click to edit heading", level: "2", size: "large", align: "start" },
      },
      ParagraphBlock: {
        label: "Paragraph",
        render: (props) => <ParagraphBlock {...(props as any)} />,
        fields: {
          text: {
            type: "richtext",
            label: "Text",
            contentEditable: true,
          },
          size: {
            type: "select",
            label: "Size",
            options: [
              { label: "Small", value: "small" },
              { label: "Medium", value: "medium" },
              { label: "Large", value: "large" },
            ],
          },
          align: { type: "radio", label: "Align", options: [...alignOptions, { label: "End", value: "end" }] },
        },
        defaultProps: { text: "Double-click to edit this text.", size: "medium", align: "start" },
      },
      ButtonBlock: {
        label: "Button",
        render: (props) => <ButtonBlock {...(props as any)} />,
        fields: {
          label: { type: "text", label: "Button label", contentEditable: true },
          href: { type: "text", label: "Link" },
          style: {
            type: "radio",
            label: "Style",
            options: [
              { label: "Primary", value: "primary" },
              { label: "Secondary", value: "secondary" },
              { label: "Link", value: "link" },
            ],
          },
          align: { type: "radio", label: "Align", options: [...alignOptions, { label: "End", value: "end" }] },
        },
        defaultProps: { label: "Button", href: "#", style: "primary", align: "start" },
      },
      MediaBlock: {
        label: "Media",
        render: (props) => <MediaBlock {...(props as any)} />,
        fields: {
          kind: {
            type: "select",
            label: "Media type",
            options: [
              { label: "Image", value: "image" },
              { label: "Video", value: "video" },
              { label: "Audio", value: "audio" },
            ],
          },
          source: { type: "text", label: "Source URL" },
          alt: { type: "text", label: "Alternative text" },
          radius: {
            type: "select",
            label: "Corner radius",
            options: [
              { label: "None", value: "none" },
              { label: "Small", value: "small" },
              { label: "Medium", value: "medium" },
              { label: "Large", value: "large" },
            ],
          },
        },
        defaultProps: { kind: "image", source: "", alt: "", radius: "medium" },
      },
      IconBlock: {
        label: "Icon",
        render: (props) => <IconBlock {...(props as any)} />,
        fields: {
          icon: {
            type: "select",
            label: "Icon",
            options: ["arrow", "check", "home", "mail", "map", "phone", "star"].map((value) => ({ label: value[0].toUpperCase() + value.slice(1), value })),
          },
          size: {
            type: "radio",
            label: "Size",
            options: [
              { label: "S", value: "small" },
              { label: "M", value: "medium" },
              { label: "L", value: "large" },
            ],
          },
          align: { type: "radio", label: "Align", options: [...alignOptions, { label: "End", value: "end" }] },
        },
        defaultProps: { icon: "star", size: "medium", align: "start" },
      },
      Hero: {
        label: "Hero",
        render: (props) => <HeroSection {...props} locale={locale} />,
        fields: {
          eyebrow: localizedField("Eyebrow"),
          title: localizedField("Title"),
          subtitle: localizedTextareaField("Subtitle"),
          ctaLabel: localizedField("Primary CTA"),
          ctaHref: { type: "text", label: "Primary link" },
          secondaryCtaLabel: localizedField("Secondary CTA"),
          secondaryCtaHref: { type: "text", label: "Secondary link" },
          image: { type: "text", label: "Background image URL" },
          align: { type: "radio", label: "Align", options: alignOptions },
          height: { type: "select", label: "Height", options: heightOptions },
        },
        defaultProps: {
          eyebrow: L("WEB BUILDER", "WEB BUILDER"),
          title: L("ابنِ وانشر مواقعك بصرياً.", "Build and publish websites visually."),
          subtitle: L(
            "صمم الصفحات، اربط النطاقات، وانشر.",
            "Design pages, connect domains, publish.",
          ),
          ctaLabel: L("ابدأ البناء", "Start building"),
          ctaHref: "/register",
          secondaryCtaLabel: L("استكشف", "Explore"),
          secondaryCtaHref: "#features",
          align: "center",
          height: "standard",
        },
      },
      SectionHeading: {
        label: "Section heading",
        render: (props) => <SectionHeading {...props} locale={locale} />,
        fields: {
          eyebrow: localizedField("Eyebrow"),
          title: localizedField("Title"),
          body: localizedTextareaField("Body"),
          align: { type: "radio", label: "Align", options: alignOptions },
        },
        defaultProps: {
          eyebrow: L("01 — SECTION", "01 — SECTION"),
          title: L("عنوان القسم", "Section title"),
          body: L("وصف مختصر للقسم.", "A short section description."),
          align: "start",
        },
      },
      Text: {
        label: "Text",
        render: (props) => <TextBlock {...props} locale={locale} />,
        fields: {
          body: localizedTextareaField("Body"),
          align: { type: "radio", label: "Align", options: alignOptions },
        },
        defaultProps: {
          body: L(
            "اكتب محتوى الصفحة هنا. يمكنك تعديل النص مباشرة من اللوحة الجانبية.",
            "Write page copy here. Edit text directly from the side panel.",
          ),
          align: "start",
        },
      },
      FeatureGrid: {
        label: "Feature grid",
        render: (props) => <FeatureGrid {...props} locale={locale} />,
        fields: {
          eyebrow: localizedField("Eyebrow"),
          title: localizedField("Title"),
          columns: {
            type: "radio",
            label: "Columns",
            options: [
              { label: "2", value: "2" },
              { label: "3", value: "3" },
              { label: "4", value: "4" },
            ],
          },
          items: {
            type: "array",
            label: "Features",
            arrayFields: {
              title: localizedField("Title"),
              body: localizedTextareaField("Body"),
            },
            defaultItemProps: {
              title: L("ميزة", "Feature"),
              body: L("وصف الميزة.", "Feature description."),
            },
            getItemSummary: (item: any, index) =>
              summary(item.title, `Feature ${index ?? ""}`),
          },
        },
        defaultProps: {
          eyebrow: L("FEATURES", "FEATURES"),
          title: L("كل ما تحتاجه", "Everything you need"),
          columns: "3",
          items: [
            {
              title: L("محرر بصري", "Visual builder"),
              body: L("اسحب وأفلت الأقسام.", "Drag and drop sections."),
            },
            {
              title: L("نطاقات", "Domains"),
              body: L("اربط نطاقك الخاص.", "Connect your own domain."),
            },
            {
              title: L("نشر فوري", "Instant publish"),
              body: L("انشر بضغطة.", "Ship with one click."),
            },
          ],
        },
      },
      StatsStrip: {
        label: "Stats",
        render: (props) => <StatsStrip {...props} locale={locale} />,
        fields: {
          items: {
            type: "array",
            label: "Stats",
            arrayFields: {
              value: { type: "text", label: "Value" },
              label: localizedField("Label"),
            },
            defaultItemProps: {
              value: "12+",
              label: L("مشروع", "Projects"),
            },
            getItemSummary: (item: any, index) =>
              item.value || `Stat ${index ?? ""}`,
          },
        },
        defaultProps: {
          items: [
            { value: "3 min", label: L("للإطلاق", "to launch") },
            { value: "100%", label: L("بصري", "visual") },
            { value: "∞", label: L("صفحات", "pages") },
          ],
        },
      },
      ImageText: {
        label: "Image + text",
        render: (props) => <ImageText {...props} locale={locale} />,
        fields: {
          eyebrow: localizedField("Eyebrow"),
          title: localizedField("Title"),
          body: localizedTextareaField("Body"),
          image: { type: "text", label: "Image URL" },
          imageAlt: localizedField("Alt text"),
          imageSide: {
            type: "radio",
            label: "Image side",
            options: sideOptions,
          },
        },
        defaultProps: {
          eyebrow: L("STORY", "STORY"),
          title: L("قصة المنتج", "Product story"),
          body: L(
            "اشرح القيمة هنا مع صورة داعمة.",
            "Explain the value here with a supporting image.",
          ),
          imageSide: "end",
        },
      },
      Gallery: {
        label: "Gallery",
        render: (props) => <GalleryGrid {...props} locale={locale} />,
        fields: {
          eyebrow: localizedField("Eyebrow"),
          title: localizedField("Title"),
          items: {
            type: "array",
            label: "Images",
            arrayFields: {
              image: { type: "text", label: "Image URL" },
              caption: localizedField("Caption"),
            },
            defaultItemProps: {
              caption: L("صورة", "Image"),
            },
            getItemSummary: (item: any, index) =>
              summary(item.caption, `Image ${index ?? ""}`),
          },
        },
        defaultProps: {
          eyebrow: L("GALLERY", "GALLERY"),
          title: L("معرض", "Gallery"),
          items: [
            { caption: L("01", "01") },
            { caption: L("02", "02") },
            { caption: L("03", "03") },
          ],
        },
      },
      LogoCloud: {
        label: "Logo cloud",
        render: (props) => <LogoCloud {...props} locale={locale} />,
        fields: {
          eyebrow: localizedField("Eyebrow"),
          title: localizedField("Title"),
          items: {
            type: "array",
            label: "Logos",
            arrayFields: {
              label: { type: "text", label: "Name" },
            },
            defaultItemProps: { label: "Brand" },
            getItemSummary: (item: any, index) =>
              item.label || `Logo ${index ?? ""}`,
          },
        },
        defaultProps: {
          eyebrow: L("TRUSTED BY", "TRUSTED BY"),
          title: L("شركاء", "Partners"),
          items: [
            { label: "North" },
            { label: "Orbit" },
            { label: "Peak" },
            { label: "Pulse" },
          ],
        },
      },
      Faq: {
        label: "FAQ",
        render: (props) => <FaqList {...props} locale={locale} />,
        fields: {
          eyebrow: localizedField("Eyebrow"),
          title: localizedField("Title"),
          items: {
            type: "array",
            label: "Questions",
            arrayFields: {
              q: localizedField("Question"),
              a: localizedTextareaField("Answer"),
            },
            defaultItemProps: {
              q: L("سؤال؟", "A question?"),
              a: L("إجابة.", "An answer."),
            },
            getItemSummary: (item: any, index) =>
              summary(item.q, `Q ${index ?? ""}`),
          },
        },
        defaultProps: {
          eyebrow: L("FAQ", "FAQ"),
          title: L("أسئلة شائعة", "Common questions"),
          items: [
            {
              q: L("هل أحتاج كود؟", "Do I need code?"),
              a: L("لا. كل شيء بصري.", "No. Everything is visual."),
            },
            {
              q: L("هل أستخدم نطاقي؟", "Can I use my domain?"),
              a: L("نعم من إعدادات النطاقات.", "Yes, from domain settings."),
            },
          ],
        },
      },
      Pricing: {
        label: "Pricing",
        render: (props) => <PricingCards {...props} locale={locale} />,
        fields: {
          eyebrow: localizedField("Eyebrow"),
          title: localizedField("Title"),
          items: {
            type: "array",
            label: "Plans",
            arrayFields: {
              name: localizedField("Name"),
              price: { type: "text", label: "Price" },
              period: localizedField("Period"),
              features: {
                type: "textarea",
                label: "Features (one per line)",
              },
              ctaLabel: localizedField("CTA"),
              ctaHref: { type: "text", label: "CTA link" },
              highlight: {
                type: "radio",
                label: "Highlight",
                options: [
                  { label: "No", value: "no" },
                  { label: "Yes", value: "yes" },
                ],
              },
            },
            defaultItemProps: {
              name: L("خطة", "Plan"),
              price: "0",
              period: L("/شهر", "/mo"),
              features: "Feature one\nFeature two",
              ctaLabel: L("ابدأ", "Start"),
              ctaHref: "/register",
              highlight: "no",
            },
            getItemSummary: (item: any, index) =>
              summary(item.name, `Plan ${index ?? ""}`),
          },
        },
        defaultProps: {
          eyebrow: L("PRICING", "PRICING"),
          title: L("خطط بسيطة", "Simple plans"),
          items: [
            {
              name: L("مجاني", "Free"),
              price: "0",
              period: L("/شهر", "/mo"),
              features: "1 site\nSubdomain\nBuilder",
              ctaLabel: L("ابدأ", "Start"),
              ctaHref: "/register",
              highlight: "no",
            },
            {
              name: L("احترافي", "Pro"),
              price: "19",
              period: L("/شهر", "/mo"),
              features: "Custom domain\nUnlimited pages\nPriority",
              ctaLabel: L("جرّب", "Try"),
              ctaHref: "/register",
              highlight: "yes",
            },
            {
              name: L("وكالات", "Agency"),
              price: "49",
              period: L("/شهر", "/mo"),
              features: "10 sites\nTeam\nWhite-label",
              ctaLabel: L("تواصل", "Contact"),
              ctaHref: "/register",
              highlight: "no",
            },
          ],
        },
      },
      CtaBand: {
        label: "CTA band",
        render: (props) => <CtaBand {...props} locale={locale} />,
        fields: {
          eyebrow: localizedField("Eyebrow"),
          title: localizedField("Title"),
          body: localizedTextareaField("Body"),
          ctaLabel: localizedField("CTA"),
          ctaHref: { type: "text", label: "CTA link" },
        },
        defaultProps: {
          eyebrow: L("CURIOUS VESSEL", "CURIOUS VESSEL"),
          title: L("أطلق موقعك التالي", "Ship your next site"),
          body: L(
            "افتح المحرر، اربط نطاقاً، وانشر.",
            "Open the builder, connect a domain, publish.",
          ),
          ctaLabel: L("أنشئ موقعاً", "Create a site"),
          ctaHref: "/register",
        },
      },
      ContactBand: {
        label: "Contact band",
        render: (props) => <ContactBand {...props} locale={locale} />,
        fields: {
          eyebrow: localizedField("Eyebrow"),
          title: localizedField("Title"),
          body: localizedTextareaField("Body"),
          phone: { type: "text", label: "Phone" },
          email: { type: "text", label: "Email" },
          ctaLabel: localizedField("CTA"),
          ctaHref: { type: "text", label: "CTA link" },
        },
        defaultProps: {
          eyebrow: L("CONTACT", "CONTACT"),
          title: L("تواصل معنا", "Get in touch"),
          body: L(
            "يسعدنا سماعك. أرسل رسالة وسنعود إليك.",
            "We would like to hear from you. Send a message and we will reply.",
          ),
          phone: "+966 500 000 000",
          email: "hello@example.com",
          ctaLabel: L("إرسال", "Send"),
          ctaHref: "mailto:hello@example.com",
        },
      },
      PropertyShowcase: {
        label: "Card showcase",
        render: (props) => <PropertyShowcase {...props} locale={locale} />,
        fields: {
          eyebrow: localizedField("Eyebrow"),
          title: localizedField("Title"),
          items: {
            type: "array",
            label: "Cards",
            arrayFields: {
              title: localizedField("Title"),
              location: localizedField("Meta"),
              price: { type: "text", label: "Detail" },
              image: { type: "text", label: "Image URL" },
              href: { type: "text", label: "Link" },
            },
            defaultItemProps: {
              title: L("بطاقة", "Card"),
              location: L("وصف", "Meta"),
              price: "",
              href: "#",
            },
            getItemSummary: (item: any, index) =>
              summary(item.title, `Card ${index ?? ""}`),
          },
        },
        defaultProps: {
          eyebrow: L("SHOWCASE", "SHOWCASE"),
          title: L("مختارات", "Selected work"),
          items: [
            {
              title: L("مشروع 01", "Project 01"),
              location: L("الرياض", "Riyadh"),
              href: "#",
            },
            {
              title: L("مشروع 02", "Project 02"),
              location: L("جدة", "Jeddah"),
              href: "#",
            },
            {
              title: L("مشروع 03", "Project 03"),
              location: L("الخبر", "Khobar"),
              href: "#",
            },
          ],
        },
      },
      CmsCollection: {
        label: "CMS collection",
        render: (props) => <CmsCollectionBlock {...(props as any)} locale={locale} />,
        fields: {
          collectionId: {
            type: "select",
            label: "Collection",
            options: (externalData.collections ?? []).map((collection) => ({
              label: collection.name,
              value: collection.id,
            })),
          },
          titleField: { type: "text", label: "Title field" },
          bodyField: { type: "text", label: "Body field" },
          imageField: { type: "text", label: "Image field" },
          limit: { type: "number", label: "Limit", min: 1, max: 100 },
          columns: {
            type: "radio",
            label: "Columns",
            options: [
              { label: "2", value: "2" },
              { label: "3", value: "3" },
              { label: "4", value: "4" },
            ],
          },
          emptyText: { type: "text", label: "Empty state" },
          pagination: {
            type: "radio",
            label: "Pagination",
            options: [
              { label: "None", value: "none" },
              { label: "Load more", value: "loadMore" },
            ],
          },
          indexFieldId: { type: "text", label: "Indexed search / sort field" },
          match: { type: "text", label: "Search or filter prefix" },
          sortDirection: {
            type: "radio",
            label: "Sort",
            options: [
              { label: "Ascending", value: "asc" },
              { label: "Descending", value: "desc" },
            ],
          },
        },
        resolveFields: (data, { fields }) => {
          const collection = (externalData.collections ?? []).find(
            (item) => item.id === data.props?.collectionId,
          );
          const fieldOptions = (collection?.fields ?? []).map((field) => ({
            label: field.label,
            value: field.key,
          }));
          return {
            ...fields,
            titleField: { type: "select", label: "Title field", options: fieldOptions },
            bodyField: { type: "select", label: "Body field", options: fieldOptions },
            imageField: { type: "select", label: "Image field", options: fieldOptions },
            indexFieldId: {
              type: "select",
              label: "Indexed search / sort field",
              options: (collection?.fields ?? []).map((field) => ({
                label: field.label,
                value: field.id ?? `field_${field.key}`,
              })),
            },
          } as typeof fields;
        },
        defaultProps: {
          collectionId: "",
          titleField: "title",
          bodyField: "description",
          imageField: "image",
          limit: 6,
          columns: "3",
          emptyText: "No published items yet.",
          pagination: "none",
          indexFieldId: "",
          match: "",
          sortDirection: "asc",
        },
      },
      CmsField: {
        label: "CMS field",
        render: (props) => (
          <CmsFieldBlock
            {...(props as any)}
            locale={locale}
            entryValues={externalData.cmsEntry?.values}
          />
        ),
        fields: {
          collectionId: {
            type: "select",
            label: "Collection",
            options: (externalData.collections ?? []).map((collection) => ({
              label: collection.name,
              value: collection.id,
            })),
          },
          fieldKey: { type: "text", label: "Field" },
          fallback: { type: "text", label: "Empty state" },
        },
        resolveFields: (data, { fields }) => {
          const collectionId =
            String(data.props?.collectionId ?? "") ||
            externalData.cmsEntry?.collectionId;
          const collection = (externalData.collections ?? []).find(
            (item) => item.id === collectionId,
          );
          return {
            ...fields,
            fieldKey: {
              type: "select",
              label: "Field",
              options: (collection?.fields ?? []).map((field) => ({
                label: field.label,
                value: field.key,
              })),
            },
          } as typeof fields;
        },
        defaultProps: {
          collectionId: "",
          fieldKey: "title",
          fallback: "Select a CMS field",
        },
      },
      Divider: {
        label: "Divider",
        render: ({ width }) => <DividerLine width={width as "full" | "narrow" | undefined} />,
        fields: {
          width: {
            type: "radio",
            label: "Width",
            options: [
              { label: "Full", value: "full" },
              { label: "Narrow", value: "narrow" },
            ],
          },
        },
        defaultProps: { width: "full" },
      },
      Spacer: {
        label: "Spacer",
        render: ({ size }) => (
          <SpacerBlock size={size as "sm" | "md" | "lg" | "xl" | undefined} />
        ),
        fields: {
          size: {
            type: "select",
            label: "Size",
            options: [
              { label: "S", value: "sm" },
              { label: "M", value: "md" },
              { label: "L", value: "lg" },
              { label: "XL", value: "xl" },
            ],
          },
        },
        defaultProps: { size: "md" },
      },
    },
  };
}
