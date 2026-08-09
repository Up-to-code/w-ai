import { Link } from "@/i18n/routing";

import { BrandMark } from "@/components/brand/brand-mark";

export type LegalSection = {
  title: string;
  body: string | string[];
};

export function LegalDocument({
  title,
  summary,
  sections,
}: {
  title: string;
  summary: string;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-svh bg-white text-black">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
          <Link
            href="/"
            aria-label="Home"
            className="text-black transition-opacity hover:opacity-60"
          >
            <BrandMark className="h-6 w-9" />
          </Link>
          <Link
            href="/"
            className="text-xs font-medium text-black/55 hover:text-black"
          >
            Back to home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 pb-28 pt-20 md:pt-28">
        <p className="text-sm text-black/40">Effective August 9, 2026</p>
        <h1 className="mt-5 text-5xl font-semibold tracking-[-0.05em] md:text-7xl">
          {title}
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-black/55">
          {summary}
        </p>

        <div className="mt-16 divide-y divide-black/10 border-t border-black/10">
          {sections.map((section) => (
            <section key={section.title} className="py-10">
              <h2 className="text-xl font-semibold tracking-[-0.02em]">
                {section.title}
              </h2>
              {Array.isArray(section.body) ? (
                <div className="mt-4 space-y-4 text-[15px] leading-7 text-black/60">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[15px] leading-7 text-black/60">
                  {section.body}
                </p>
              )}
            </section>
          ))}
        </div>

        <footer className="mt-14 border-t border-black/10 pt-8 text-sm text-black/55">
          Questions about this policy? Email{" "}
          <a
            href="mailto:support@w-ai.online"
            className="font-medium text-black underline underline-offset-4"
          >
            support@w-ai.online
          </a>
          .
        </footer>
      </article>
    </main>
  );
}
