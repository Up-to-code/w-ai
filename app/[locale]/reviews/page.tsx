import { LegalDocument } from "@/components/marketing/legal-document";

export default function ReviewsPage() {
  return (
    <LegalDocument
      title="Reviews and feedback"
      summary="Product feedback should be useful, attributable, and published with permission. We do not invent testimonials."
      sections={[
        {
          title: "Submitting feedback",
          body: "Workspace owners and team members may share feedback through the support channel associated with their account.",
        },
        {
          title: "Publishing reviews",
          body: "A review is published only after the author approves the wording, name, role, and organization attribution that will appear publicly.",
        },
        {
          title: "Editing or removal",
          body: "Review authors may request a correction or removal. We may remove content that is misleading, unlawful, abusive, or unrelated to the product experience.",
        },
        {
          title: "Incentives",
          body: "If a review was collected through an incentive or research program, that relationship will be disclosed alongside the review.",
        },
      ]}
    />
  );
}
