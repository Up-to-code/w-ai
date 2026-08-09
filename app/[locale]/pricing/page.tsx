import type { Metadata } from "next";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingPricing } from "@/components/marketing/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare W-AI Free, Pro, and Agency plans for building and publishing websites.",
};

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MarketingNavbar />
      <main className="flex-1">
        <MarketingPricing />
        <section className="border-t border-black/10 px-6 py-16 text-center">
          <p className="mx-auto max-w-2xl text-sm leading-6 text-black/55">
            Prices are in USD. Paid subscriptions renew monthly until cancelled.
            Taxes may apply. See our{" "}
            <a href="/terms" className="text-black underline underline-offset-4">
              terms
            </a>{" "}
            and{" "}
            <a href="/refund" className="text-black underline underline-offset-4">
              refund policy
            </a>{" "}
            for billing details.
          </p>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
