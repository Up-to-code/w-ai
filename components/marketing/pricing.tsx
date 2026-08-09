"use client";

import { Link } from "@/i18n/routing";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

export function MarketingPricing() {
  const t = useTranslations("marketing.pricing");
  const plans = t.raw("plans") as Array<{
    name: string;
    price: string;
    period: string;
    features: string[];
    cta: string;
    highlight: boolean;
  }>;

  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-28 md:py-40">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="mb-16 max-w-3xl">
          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-black md:text-6xl">
            {t("title")}
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-[24px] p-8 ${
                plan.highlight
                  ? "bg-black text-white"
                  : "bg-[#f4f4f2] text-black"
              }`}
            >
              <p
                className={`mb-6 text-sm font-medium ${plan.highlight ? "text-white/55" : "text-black/55"}`}
              >
                {plan.name}
              </p>

              <div className="mb-8 flex items-baseline gap-1.5">
                <span className="text-display-sm font-semibold tracking-tight">
                  ${plan.price}
                </span>
                <span
                  className={`text-sm ${
                    plan.highlight ? "text-white/55" : "text-black/50"
                  }`}
                >
                  {plan.period}
                </span>
              </div>

              <ul className="mb-10 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm"
                  >
                    <Check
                      className={`mt-0.5 size-4 shrink-0 ${
                        plan.highlight ? "text-white/70" : "text-black/45"
                      }`}
                      strokeWidth={1.5}
                    />
                    <span
                      className={
                        plan.highlight ? "text-white/90" : "text-black/75"
                      }
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity hover:opacity-75 ${
                  plan.highlight ? "bg-white text-black" : "bg-black text-white"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
