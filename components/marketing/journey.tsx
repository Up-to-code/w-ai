"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

const CHAPTERS = [
  {
    title: "Start with structure, not a template.",
    body: "Create a site, define its pages, and establish the system it will grow from. The workspace stays clear whether you manage one site or many.",
    image: "/images/platform-sites-system.png",
    alt: "A multi-site workspace with reusable sections and responsive previews",
    detail: "Sites, pages, and reusable systems in one workspace.",
  },
  {
    title: "Compose directly on the canvas.",
    body: "Build with real sections and components. Arrange the layout, tune every breakpoint, and edit the content where it appears.",
    image: "/images/platform-builder-canvas.png",
    alt: "A visual website canvas with selected sections and layout controls",
    detail: "Responsive controls without leaving the page.",
  },
  {
    title: "Connect the domain. Publish the site.",
    body: "Preview the result, connect the destination, and ship. Draft and published states remain separate so changes stay deliberate.",
    image: "/images/platform-domains-network.png",
    alt: "A domain network connecting a published website to multiple devices",
    detail: "A direct path from draft to the public web.",
  },
] as const;

export function MarketingJourney() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-journey-step]").forEach((step) => {
        const visual = step.querySelector("[data-journey-visual]");
        const copy = step.querySelector("[data-journey-copy]");

        gsap.fromTo(
          visual,
          { y: 72, scale: 0.94, opacity: 0.25 },
          {
            y: 0,
            scale: 1,
            opacity: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: step,
              start: "top 78%",
              end: "center 45%",
              scrub: 0.7,
            },
          },
        );
        gsap.fromTo(
          copy,
          { y: 36, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: step,
              start: "top 72%",
              end: "top 38%",
              scrub: 0.5,
            },
          },
        );
      });
    }, rootRef);

    return () => context.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      id="journey"
      className="scroll-mt-20 bg-black text-white"
    >
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-28 md:px-10 md:pt-40">
        <p className="max-w-4xl text-4xl font-semibold tracking-[-0.045em] md:text-7xl md:leading-[1.02]">
          From the first blank page to a site people can visit.
        </p>
      </div>

      {CHAPTERS.map((chapter) => (
        <article
          key={chapter.title}
          data-journey-step
          className="grid min-h-[92svh] items-center gap-12 border-t border-white/15 px-6 py-20 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] md:px-10 lg:gap-20"
        >
          <div
            data-journey-copy
            className="mx-auto max-w-xl md:sticky md:top-32"
          >
            <h2 className="text-4xl font-semibold tracking-[-0.04em] md:text-6xl md:leading-[1.02]">
              {chapter.title}
            </h2>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-white/60">
              {chapter.body}
            </p>
            <p className="mt-10 border-t border-white/20 pt-4 text-sm text-white/45">
              {chapter.detail}
            </p>
          </div>

          <div
            data-journey-visual
            className="relative aspect-square overflow-hidden rounded-[28px] bg-[#f4f4f2] md:aspect-[4/5]"
          >
            <Image
              src={chapter.image}
              alt={chapter.alt}
              fill
              sizes="(min-width: 768px) 58vw, calc(100vw - 48px)"
              className="object-cover grayscale"
            />
          </div>
        </article>
      ))}
    </section>
  );
}
