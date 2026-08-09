"use client";

import { useTranslations } from "next-intl";
import {
  LayoutTemplate,
  Globe,
  Layers,
  Palette,
  Share2,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICONS: LucideIcon[] = [
  LayoutTemplate,
  Layers,
  Globe,
  Palette,
  Share2,
  Zap,
];

export function MarketingFeatures() {
  const t = useTranslations("marketing.features");
  const items = t.raw("items") as Array<{ title: string; description: string }>;

  return (
    <section id="features" className="border-t border-border py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 flex items-end justify-between gap-6">
          <div className="max-w-xl">
            <p className="label-meta mb-3">03 — {t("eyebrow")}</p>
            <h2 className="text-h1 font-semibold text-foreground">{t("title")}</h2>
          </div>
          <p className="hidden max-w-xs text-sm text-muted-foreground md:block">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <div
                key={item.title}
                className="group border border-border bg-card p-6 transition-brand hover:bg-w-canvas"
              >
                <div className="mb-5 flex items-center justify-between">
                  <Icon
                    className="size-5 text-muted-foreground transition-brand group-hover:text-foreground"
                    strokeWidth={1.5}
                  />
                  <span className="label-number">0{i + 1}</span>
                </div>
                <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
