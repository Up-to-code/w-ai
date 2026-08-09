"use client";

import { useEffect } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] px-6 text-[#171717]">
      <section className="w-full max-w-md border border-black/10 bg-white p-8">
        <span className="grid size-9 place-items-center rounded-lg bg-black text-white"><BrandMark className="h-4 w-6" /></span>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[.14em] text-black/40">Temporary problem</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-.03em]">This page could not load.</h1>
        <p className="mt-2 text-sm leading-6 text-black/50">Your data is safe. Retry the request, or return to the dashboard and continue working.</p>
        <div className="mt-7 flex gap-2"><button type="button" onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-black/80"><RefreshCw className="size-3.5" />Try again</button><a href="/dashboard" className="inline-flex h-10 items-center gap-2 rounded-md border border-black/15 px-4 text-xs font-medium hover:bg-black/[0.035]"><ArrowLeft className="size-3.5" />Dashboard</a></div>
        {error.digest ? <p className="mt-6 font-mono text-[10px] text-black/30">Reference {error.digest}</p> : null}
      </section>
    </main>
  );
}
