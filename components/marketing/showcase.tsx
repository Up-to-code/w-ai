"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

const CARDS = [
  {
    index: "01",
    image: "/images/platform-builder-canvas.png",
    alt: "Visual builder canvas with selected sections, layers, and responsive controls",
    tag: { label: "● Builder", schema: "schema-blue" },
    titleKey: "builder" as const,
  },
  {
    index: "02",
    image: "/images/platform-domains-network.png",
    alt: "Secure domain network connecting one published site to multiple devices",
    tag: { label: "● Domains", schema: "schema-green" },
    titleKey: "domains" as const,
  },
  {
    index: "03",
    image: "/images/platform-sites-system.png",
    alt: "Multi-site system with reusable components and responsive previews",
    tag: { label: "● Sites", schema: "schema-purple" },
    titleKey: "sites" as const,
  },
];

export function MarketingShowcase() {
  const t = useTranslations("marketing.showcase");

  return (
    <section id="showcase" className="border-t border-border py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 flex items-end justify-between gap-6">
          <div className="max-w-xl">
            <p className="label-meta mb-3">02 — {t("eyebrow")}</p>
            <h2 className="text-h1 font-semibold text-foreground">
              {t("title")}
            </h2>
          </div>
          <p className="hidden max-w-xs text-sm text-muted-foreground md:block">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {CARDS.map((card) => (
            <div
              key={card.index}
              className="transition-brand group flex flex-col border border-border bg-card hover:bg-w-canvas"
            >
              <div className="relative aspect-[4/3] overflow-hidden border-b border-border bg-w-canvas">
                <Image
                  src={card.image}
                  alt={card.alt}
                  fill
                  sizes="(min-width: 768px) 33vw, calc(100vw - 48px)"
                  className="transition-brand object-cover group-hover:scale-[1.02]"
                />
                <div className="absolute end-3 top-3">
                  <span className={`tag-schema ${card.tag.schema} text-xs`}>
                    {card.tag.label}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="label-meta">{t(`${card.titleKey}.meta`)}</p>
                  <span className="label-number">{card.index} / 03</span>
                </div>
                <h3 className="text-sm font-medium text-foreground">
                  {t(`${card.titleKey}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`${card.titleKey}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
