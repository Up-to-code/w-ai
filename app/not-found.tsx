import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] px-6 text-[#171717]">
      <section className="w-full max-w-lg text-center">
        <span className="mx-auto grid size-10 place-items-center rounded-lg bg-black text-white"><BrandMark className="h-4 w-6" /></span>
        <p className="mt-10 font-mono text-[11px] tracking-[.18em] text-black/35">404</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.045em]">Page not found</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-black/50">The address may have changed, or the page may no longer exist.</p>
        <div className="mt-8 flex justify-center gap-2"><Link href="/dashboard" className="inline-flex h-10 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-black/80"><ArrowLeft className="size-3.5" />Back to dashboard</Link><Link href="/" className="inline-flex h-10 items-center gap-2 rounded-md border border-black/15 px-4 text-xs font-medium hover:bg-black/[0.035]"><Search className="size-3.5" />W-AI home</Link></div>
      </section>
    </main>
  );
}
