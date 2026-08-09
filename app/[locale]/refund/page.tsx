import type { Metadata } from "next";

import { LegalDocument } from "@/components/marketing/legal-document";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Cancellation and refund terms for W-AI subscriptions.",
};

export default function RefundPage() {
  return (
    <LegalDocument
      title="Refund policy"
      summary="We want billing to be predictable and fair. This policy explains when a paid subscription may be refunded."
      sections={[
        {
          title: "Subscription cancellation",
          body: "You can cancel a paid subscription at any time. Access continues until the end of the current billing period unless otherwise stated.",
        },
        {
          title: "Refund window",
          body: "First-time subscription purchases may be eligible for a refund when requested within 14 days, provided there has not been substantial usage or abuse of paid resources.",
        },
        {
          title: "Renewals",
          body: "Renewal charges are normally non-refundable. Contact support promptly if a renewal was accidental and the new billing period has not been materially used.",
        },
        {
          title: "Domains and third-party costs",
          body: "Domain registration, transfer, usage-based infrastructure, and other non-recoverable third-party charges are not refundable once incurred.",
        },
        {
          title: "Requesting a refund",
          body: "Email support@w-ai.online with the account email, workspace name, charge date, transaction reference, and reason for the request. We normally review complete requests within 5 business days.",
        },
        {
          title: "Approved refunds",
          body: "Approved refunds are returned to the original payment method. Your bank or payment provider may require an additional 5–10 business days to post the funds. Any associated paid access may end when a full refund is issued.",
        },
        {
          title: "Consumer rights",
          body: "Nothing in this policy limits any non-waivable refund, cancellation, or consumer rights provided by applicable law.",
        },
      ]}
    />
  );
}
