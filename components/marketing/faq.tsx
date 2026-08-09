"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

export function MarketingFaq() {
  const t = useTranslations("marketing.faq");
  const items = t.raw("items") as Array<{ q: string; a: string }>;
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="scroll-mt-20 bg-[#f4f4f2] py-28 md:py-40">
      <div className="mx-auto max-w-5xl px-6 md:px-10">
        <div className="mb-14">
          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-black md:text-6xl">
            {t("title")}
          </h2>
        </div>

        {/* FAQ — structural dividers, no card containers */}
        <div className="divide-y divide-border border-t border-border">
          {items.map((item, i) => (
            <div key={item.q}>
              <button
                className="transition-brand flex w-full items-start justify-between gap-8 py-6 text-left"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="text-sm font-medium text-foreground">
                  {item.q}
                </span>
                {open === i ? (
                  <Minus
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                ) : (
                  <Plus
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                )}
              </button>
              {open === i && (
                <p className="pb-6 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
