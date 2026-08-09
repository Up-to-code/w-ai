type Localized = string;
type LocalizedRecord = Record<string, string>;

type PuckComponent = {
  type: string;
  props: Record<string, unknown>;
};

export type PageTemplate = "blank" | "landing" | "content" | "contact" | "properties";

export function text(_ar: string, en: string): Localized {
  return en;
}

/** Compatibility helper for settings records; page documents use `text`. */
export function loc(_ar: string, en: string): LocalizedRecord {
  return { en };
}

function blockId(type: string) {
  // Stable-enough ids for seed templates; editor can rewrite on save.
  return `${type}-${Math.random().toString(36).slice(2, 10)}`;
}

function withIds(content: PuckComponent[]): PuckComponent[] {
  return content.map((item) => ({
    ...item,
    props: {
      ...item.props,
      id:
        typeof item.props.id === "string" && item.props.id
          ? item.props.id
          : blockId(item.type),
    },
  }));
}

function page(content: PuckComponent[]) {
  return {
    builder: "puck" as const,
    version: 2 as const,
    data: {
      root: { props: { id: "root" } },
      content: withIds(content),
    },
    overrides: {},
    bindings: {},
  };
}

const hero = (
  title: Localized,
  subtitle: Localized,
  ctaLabel = text("اكتشف المزيد", "Explore"),
  ctaHref = "/contact",
): PuckComponent => ({
  type: "Hero",
  props: {
    eyebrow: text("موقع عقاري", "Real estate site"),
    title,
    subtitle,
    ctaLabel,
    ctaHref,
    secondaryCtaLabel: text("تواصل معنا", "Contact us"),
    secondaryCtaHref: "/contact",
    align: "center",
    height: "standard",
  },
});

export function pageDataForTemplate(template: PageTemplate) {
  if (template === "blank") return page([]);

  if (template === "contact") {
    return page([
      hero(
        text("تواصل معنا", "Contact us"),
        text("فريقنا جاهز للإجابة عن أسئلتك ومساعدتك في الخطوة التالية.", "Our team is ready to answer questions and help with the next step."),
        text("ابدأ المحادثة", "Start the conversation"),
      ),
      {
        type: "ContactBand",
        props: {
          eyebrow: text("قنوات التواصل", "Contact channels"),
          title: text("يسعدنا سماعك", "We would like to hear from you"),
          body: text("اتصل بنا أو أرسل رسالة وسنعود إليك في أقرب وقت.", "Call us or send a message and we will respond soon."),
          phone: "+966 500 000 000",
          email: "hello@example.com",
          ctaLabel: text("إرسال رسالة", "Send a message"),
          ctaHref: "mailto:hello@example.com",
        },
      },
    ]);
  }

  if (template === "properties") {
    return page([
      hero(
        text("وحدات تلائم أسلوب حياتك", "Homes that fit your lifestyle"),
        text("استعرض مجموعة مختارة من الوحدات السكنية والتجارية.", "Explore selected residential and commercial units."),
        text("عرض الوحدات", "View properties"),
        "/properties",
      ),
      {
        type: "PropertyShowcase",
        props: {
          eyebrow: text("مختارات", "Featured"),
          title: text("وحدات بارزة", "Highlighted properties"),
          items: [
            {
              title: text("شقة عصرية", "Modern apartment"),
              location: text("الرياض", "Riyadh"),
              price: "SAR 1.2M",
              href: "/properties",
            },
            {
              title: text("فيلا عائلية", "Family villa"),
              location: text("جدة", "Jeddah"),
              price: "SAR 3.8M",
              href: "/properties",
            },
            {
              title: text("مكتب تجاري", "Commercial office"),
              location: text("الخبر", "Khobar"),
              price: "SAR 950K",
              href: "/properties",
            },
          ],
        },
      },
    ]);
  }

  if (template === "content") {
    return page([
      {
        type: "SectionHeading",
        props: {
          eyebrow: text("صفحة تعريفية", "Content page"),
          title: text("عنوان الصفحة", "Page title"),
          body: text("اكتب هنا مقدمة واضحة تساعد الزائر على فهم محتوى الصفحة.", "Write a clear introduction that helps visitors understand this page."),
          align: "center",
        },
      },
      {
        type: "Text",
        props: {
          body: text(
            "استخدم هذه المساحة لإضافة تفاصيل الصفحة. يمكنك سحب مكونات إضافية من لوحة البناء وتعديلها مباشرة.",
            "Use this space for page details. Drag additional builder components from the panel and edit them directly.",
          ),
          align: "start",
        },
      },
    ]);
  }

  return page([
    hero(
      text("نحو مستقبل عمراني متميز", "Towards a distinguished urban future"),
      text("نطور وحدات سكنية وتجارية بتصاميم عصرية ومواقع استثنائية.", "We develop residential and commercial units with modern designs and exceptional locations."),
      text("اكتشف مشاريعنا", "Discover our projects"),
      "/properties",
    ),
    {
      type: "FeatureGrid",
      props: {
        eyebrow: text("لماذا نحن", "Why us"),
        title: text("أساس قوي لموقعك العقاري", "A strong base for your real estate site"),
        columns: "3",
        items: [
          {
            title: text("محتوى قابل للتعديل", "Editable content"),
            body: text("غيّر النصوص والصور والروابط مباشرة من محرر الصفحات.", "Change copy, images and links directly from the page editor."),
          },
          {
            title: text("نشر فوري", "Instant publishing"),
            body: text("احفظ المسودة وانشر الصفحة عندما تصبح جاهزة للزوار.", "Save drafts and publish when the page is ready for visitors."),
          },
          {
            title: text("هوية موحدة", "Unified brand"),
            body: text("ألوان الموقع والتنقل والنطاقات تدار من لوحة واحدة.", "Site colors, navigation and domains are managed from one dashboard."),
          },
        ],
      },
    },
    {
      type: "StatsStrip",
      props: {
        items: [
          { value: "12+", label: text("مشروع", "Projects") },
          { value: "8", label: text("مواقع نشطة", "Active locations") },
          { value: "24/7", label: text("دعم العملاء", "Client support") },
        ],
      },
    },
    {
      type: "ContactBand",
      props: {
        eyebrow: text("ابدأ الآن", "Start now"),
        title: text("جاهز لإطلاق موقعك؟", "Ready to launch your site?"),
        body: text("خصص الصفحات، اربط نطاقك، وانشر الموقع عندما يصبح جاهزاً.", "Customize pages, connect your domain and publish when the site is ready."),
        ctaLabel: text("تواصل معنا", "Contact us"),
        ctaHref: "/contact",
      },
    },
  ]);
}
