"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

export function MarketingCta() {
  const t = useTranslations("marketing.cta");

  return (
    <section className="bg-white px-6 py-28 text-center md:px-10 md:py-44">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-5xl font-semibold tracking-[-0.05em] text-black md:text-7xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-black/50">
          {t("subtitle")}
        </p>
        <Link
          href="/register"
          className="mt-9 inline-flex h-12 items-center rounded-full bg-black px-7 text-sm font-medium text-white transition-opacity hover:opacity-75"
        >
          {t("button")}
        </Link>
      </div>
    </section>
  );
}
