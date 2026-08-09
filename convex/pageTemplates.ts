type Localized = { ar: string; en: string };

type PuckComponent = {
  type: string;
  props: Record<string, unknown>;
};

export type PageTemplate = "blank" | "landing" | "content" | "contact" | "properties";

export function loc(ar: string, en: string): Localized {
  return { ar, en };
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
    root: { props: { id: "root" } },
    content: withIds(content),
  };
}

const hero = (
  title: Localized,
  subtitle: Localized,
  ctaLabel = loc("اكتشف المزيد", "Explore"),
  ctaHref = "/contact",
): PuckComponent => ({
  type: "Hero",
  props: {
    eyebrow: loc("موقع عقاري", "Real estate site"),
    title,
    subtitle,
    ctaLabel,
    ctaHref,
    secondaryCtaLabel: loc("تواصل معنا", "Contact us"),
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
        loc("تواصل معنا", "Contact us"),
        loc("فريقنا جاهز للإجابة عن أسئلتك ومساعدتك في الخطوة التالية.", "Our team is ready to answer questions and help with the next step."),
        loc("ابدأ المحادثة", "Start the conversation"),
      ),
      {
        type: "ContactBand",
        props: {
          eyebrow: loc("قنوات التواصل", "Contact channels"),
          title: loc("يسعدنا سماعك", "We would like to hear from you"),
          body: loc("اتصل بنا أو أرسل رسالة وسنعود إليك في أقرب وقت.", "Call us or send a message and we will respond soon."),
          phone: "+966 500 000 000",
          email: "hello@example.com",
          ctaLabel: loc("إرسال رسالة", "Send a message"),
          ctaHref: "mailto:hello@example.com",
        },
      },
    ]);
  }

  if (template === "properties") {
    return page([
      hero(
        loc("وحدات تلائم أسلوب حياتك", "Homes that fit your lifestyle"),
        loc("استعرض مجموعة مختارة من الوحدات السكنية والتجارية.", "Explore selected residential and commercial units."),
        loc("عرض الوحدات", "View properties"),
        "/properties",
      ),
      {
        type: "PropertyShowcase",
        props: {
          eyebrow: loc("مختارات", "Featured"),
          title: loc("وحدات بارزة", "Highlighted properties"),
          items: [
            {
              title: loc("شقة عصرية", "Modern apartment"),
              location: loc("الرياض", "Riyadh"),
              price: "SAR 1.2M",
              href: "/properties",
            },
            {
              title: loc("فيلا عائلية", "Family villa"),
              location: loc("جدة", "Jeddah"),
              price: "SAR 3.8M",
              href: "/properties",
            },
            {
              title: loc("مكتب تجاري", "Commercial office"),
              location: loc("الخبر", "Khobar"),
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
          eyebrow: loc("صفحة تعريفية", "Content page"),
          title: loc("عنوان الصفحة", "Page title"),
          body: loc("اكتب هنا مقدمة واضحة تساعد الزائر على فهم محتوى الصفحة.", "Write a clear introduction that helps visitors understand this page."),
          align: "center",
        },
      },
      {
        type: "Text",
        props: {
          body: loc(
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
      loc("نحو مستقبل عمراني متميز", "Towards a distinguished urban future"),
      loc("نطور وحدات سكنية وتجارية بتصاميم عصرية ومواقع استثنائية.", "We develop residential and commercial units with modern designs and exceptional locations."),
      loc("اكتشف مشاريعنا", "Discover our projects"),
      "/properties",
    ),
    {
      type: "FeatureGrid",
      props: {
        eyebrow: loc("لماذا نحن", "Why us"),
        title: loc("أساس قوي لموقعك العقاري", "A strong base for your real estate site"),
        columns: "3",
        items: [
          {
            title: loc("محتوى قابل للتعديل", "Editable content"),
            body: loc("غيّر النصوص والصور والروابط مباشرة من محرر الصفحات.", "Change copy, images and links directly from the page editor."),
          },
          {
            title: loc("نشر فوري", "Instant publishing"),
            body: loc("احفظ المسودة وانشر الصفحة عندما تصبح جاهزة للزوار.", "Save drafts and publish when the page is ready for visitors."),
          },
          {
            title: loc("هوية موحدة", "Unified brand"),
            body: loc("ألوان الموقع والتنقل والنطاقات تدار من لوحة واحدة.", "Site colors, navigation and domains are managed from one dashboard."),
          },
        ],
      },
    },
    {
      type: "StatsStrip",
      props: {
        items: [
          { value: "12+", label: loc("مشروع", "Projects") },
          { value: "8", label: loc("مواقع نشطة", "Active locations") },
          { value: "24/7", label: loc("دعم العملاء", "Client support") },
        ],
      },
    },
    {
      type: "ContactBand",
      props: {
        eyebrow: loc("ابدأ الآن", "Start now"),
        title: loc("جاهز لإطلاق موقعك؟", "Ready to launch your site?"),
        body: loc("خصص الصفحات، اربط نطاقك، وانشر الموقع عندما يصبح جاهزاً.", "Customize pages, connect your domain and publish when the site is ready."),
        ctaLabel: loc("تواصل معنا", "Contact us"),
        ctaHref: "/contact",
      },
    },
  ]);
}
