"use client";

import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

import { useSession } from "@/lib/auth-client";

export function MarketingHero() {
  const t = useTranslations("marketing");
  const { data: session } = useSession();

  return (
    <section className="relative overflow-hidden bg-white pb-24 pt-20 md:pb-32 md:pt-32">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="text-5xl font-semibold tracking-[-0.055em] text-black sm:text-7xl md:text-[92px] md:leading-[0.96]">
            {t("hero.title")}
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-black/55 md:text-xl">
            {t("hero.subtitle")}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={session?.user ? "/dashboard" : "/register"}
              className="inline-flex h-12 items-center rounded-full bg-black px-7 text-sm font-medium text-white transition-opacity hover:opacity-75"
            >
              {session?.user ? "Open dashboard" : t("hero.ctaPrimary")}
            </Link>
            <a
              href="#journey"
              className="inline-flex h-12 items-center rounded-full bg-black/[0.055] px-7 text-sm font-medium text-black transition-colors hover:bg-black/10"
            >
              See how it works
            </a>
          </div>
        </div>

        <div className="mt-20" dir="ltr">
          <div className="overflow-hidden rounded-[28px] bg-[#f3f3f1] md:rounded-[40px]">
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image
                src="/images/platform-builder-hero.png"
                alt="Visual website builder with responsive canvases, component layers, and styling controls"
                fill
                priority
                sizes="(min-width: 1280px) 1200px, calc(100vw - 48px)"
                className="object-cover grayscale"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
