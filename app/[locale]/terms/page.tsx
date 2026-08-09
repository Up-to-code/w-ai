import type { Metadata } from "next";

import { LegalDocument } from "@/components/marketing/legal-document";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing your use of W-AI and its paid services.",
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of service"
      summary="These terms describe the rules for using W-AI to create, manage, and publish websites."
      sections={[
        {
          title: "Using the service",
          body: "You must provide accurate account information, keep access credentials secure, and use the service in compliance with applicable law.",
        },
        {
          title: "Your content",
          body: "You retain ownership of content you upload or create. You grant us the limited permission required to store, process, preview, and publish that content at your direction.",
        },
        {
          title: "Acceptable use",
          body: "You may not use the service to distribute unlawful or harmful content, infringe intellectual property, interfere with the platform, or attempt unauthorized access.",
        },
        {
          title: "Plans and billing",
          body: [
            "Paid features are provided according to the plan you select. Current prices, included features, billing intervals, and applicable taxes are shown on the pricing and checkout pages before purchase.",
            "Subscriptions renew automatically at the end of each billing period until cancelled. You authorize us and our payment processor to charge your selected payment method for recurring fees and applicable taxes.",
          ],
        },
        {
          title: "Trials, upgrades, and cancellation",
          body: "Trial eligibility and duration are shown when offered. Plan changes may take effect immediately or at the next renewal, as displayed before confirmation. You may cancel at any time; cancellation stops future renewals and does not normally create a refund for the current period.",
        },
        {
          title: "Availability",
          body: "We work to keep the service reliable but cannot guarantee uninterrupted availability. Features may change when necessary for security, performance, or product development.",
        },
        {
          title: "Ending service",
          body: "You may stop using the service at any time. We may suspend accounts that materially violate these terms or create security risk.",
        },
        {
          title: "Liability",
          body: "To the extent permitted by law, W-AI is provided without implied warranties and we are not liable for indirect, incidental, special, or consequential losses. Our total liability relating to the service will not exceed the amount you paid to W-AI during the 12 months before the claim.",
        },
        {
          title: "Changes to these terms",
          body: "We may update these terms to reflect product, legal, or security changes. Material updates will be communicated through the service or by email and will apply from the stated effective date.",
        },
      ]}
    />
  );
}
