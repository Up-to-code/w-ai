"use client";

import { useTranslations } from "next-intl";

export function MarketingHowItWorks() {
  const t = useTranslations("marketing.how");
  const steps = t.raw("steps") as Array<{ title: string; description: string }>;

  return (
    <section id="how" className="border-t border-border bg-w-canvas py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14">
          <p className="label-meta mb-3">04 — {t("eyebrow")}</p>
          <h2 className="text-h1 font-semibold text-foreground">{t("title")}</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="border border-border bg-card p-8">
              <p className="mb-8 font-mono text-6xl font-medium tracking-tighter text-border">
                0{i + 1}
              </p>
              <h3 className="text-sm font-medium text-foreground">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
