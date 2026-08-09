"use client";

import { Link } from "@/i18n/routing";

export function MarketingFooter() {
  return (
    <footer className="border-t border-black/10 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 text-xs text-black/45 sm:flex-row sm:items-center sm:justify-between md:px-10">
        <p>© {new Date().getFullYear()} W-AI</p>
        <nav className="flex flex-wrap gap-6" aria-label="Footer navigation">
          <a href="/#journey" className="transition-colors hover:text-black">
            How it works
          </a>
          <Link href="/pricing" className="transition-colors hover:text-black">
            Pricing
          </Link>
          <Link href="/login" className="transition-colors hover:text-black">
            Sign in
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-black">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-black">
            Terms
          </Link>
          <Link href="/refund" className="transition-colors hover:text-black">
            Refunds
          </Link>
          <Link href="/reviews" className="transition-colors hover:text-black">
            Reviews
          </Link>
        </nav>
      </div>
    </footer>
  );
}
