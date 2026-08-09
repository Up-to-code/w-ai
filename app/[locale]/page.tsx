import { MarketingCta } from "@/components/marketing/cta";
import { MarketingFaq } from "@/components/marketing/faq";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHero } from "@/components/marketing/hero";
import { MarketingJourney } from "@/components/marketing/journey";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingPricing } from "@/components/marketing/pricing";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingNavbar />
      <main className="flex-1">
        <MarketingHero />
        <MarketingJourney />
        <MarketingPricing />
        <MarketingFaq />
        <MarketingCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
