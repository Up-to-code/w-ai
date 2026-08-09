import type { Metadata } from "next";

import { LegalDocument } from "@/components/marketing/legal-document";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How W-AI collects, uses, protects, and retains personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy policy"
      summary="This policy explains what information W-AI processes, why it is needed, and the choices available to you."
      sections={[
        {
          title: "Information we collect",
          body: "We process account details, workspace content, site configuration, usage events, and technical information required to provide and secure the service.",
        },
        {
          title: "How information is used",
          body: "Information is used to authenticate accounts, operate the website builder, publish sites, prevent abuse, provide support, and improve reliability.",
        },
        {
          title: "Your website data",
          body: "Content created inside your workspace remains associated with your account and organization. We do not sell workspace content or personal information.",
        },
        {
          title: "Service providers",
          body: "Infrastructure, authentication, analytics, and payment providers may process limited information on our behalf under appropriate contractual safeguards.",
        },
        {
          title: "Payments",
          body: "Payments are processed by third-party payment providers. W-AI does not store complete card numbers. Payment providers may collect billing and transaction details under their own privacy terms.",
        },
        {
          title: "Cookies and analytics",
          body: "We use essential cookies for authentication, security, and preferences. We may use analytics to understand product usage and reliability. Where required, optional cookies are used only with your consent.",
        },
        {
          title: "Sharing and international processing",
          body: "We share information only with service providers needed to operate W-AI, when you direct us to, or when required by law. Providers may process data in countries other than yours using appropriate safeguards.",
        },
        {
          title: "Retention and deletion",
          body: "Information is retained while your account is active and as needed for security or legal obligations. You may request account and workspace deletion.",
        },
        {
          title: "Your rights",
          body: "Depending on your location, you may request access, correction, deletion, restriction, portability, or an objection to certain processing. You may also withdraw consent where processing relies on consent. Contact support to submit a request.",
        },
        {
          title: "Security and children",
          body: "We use reasonable technical and organizational safeguards to protect information. W-AI is not directed to children under 13, and we do not knowingly collect their personal information.",
        },
        {
          title: "Policy updates",
          body: "We may update this policy as W-AI or applicable requirements change. Material changes will be communicated through the service or by email before they take effect where required.",
        },
      ]}
    />
  );
}
