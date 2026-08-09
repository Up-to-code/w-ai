"use client";

import { Link } from "@/i18n/routing";

import { useSession } from "@/lib/auth-client";
import { BrandMark } from "@/components/brand/brand-mark";

export function MarketingNavbar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-5 md:px-8">
        <Link
          href="/"
          aria-label="Home"
          className="text-black transition-opacity hover:opacity-60"
        >
          <BrandMark className="h-6 w-9" />
        </Link>

        <nav
          className="hidden items-center gap-9 md:flex"
          aria-label="Main navigation"
        >
          <a
            href="/#journey"
            className="text-xs font-medium text-black/60 transition-colors hover:text-black"
          >
            How it works
          </a>
          <Link
            href="/pricing"
            className="text-xs font-medium text-black/60 transition-colors hover:text-black"
          >
            Pricing
          </Link>
          <a
            href="/#faq"
            className="text-xs font-medium text-black/60 transition-colors hover:text-black"
          >
            Questions
          </a>
        </nav>

        <div className="flex items-center gap-4">
          {session?.user ? (
            <Link
              href="/dashboard"
              className="inline-flex h-8 items-center rounded-full bg-black px-4 text-xs font-medium text-white transition-opacity hover:opacity-75"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-xs font-medium text-black/60 transition-colors hover:text-black sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-8 items-center rounded-full bg-black px-4 text-xs font-medium text-white transition-opacity hover:opacity-75"
              >
                Start building
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
