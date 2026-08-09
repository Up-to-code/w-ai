import type { Metadata } from "next";

import { geistMono, geistSans, tajawal } from "@/lib/fonts";

import "@/styles/globals.css";

import { SimpleDevIndicator } from "@/components/simple-dev-indicator";
import { SimpleToaster } from "@/components/simple-toaster";

/**
 * Root layout — sets fonts and global providers.
 * next-intl's LocaleLayout (app/[locale]/layout.tsx) sets lang/dir per locale.
 * The tenant shell (app/c/[slug]/layout.tsx) sets its own html/body from org data.
 */
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://www.w-ai.online",
  ),
  title: {
    default: "W-AI",
    template: "%s · W-AI",
  },
  description: "Build, manage, and publish responsive websites with W-AI.",
  applicationName: "W-AI",
  authors: [{ name: "W-AI" }],
  creator: "W-AI",
  publisher: "W-AI",
  category: "technology",
  keywords: [
    "website builder",
    "visual editor",
    "React website builder",
    "CMS",
    "W-AI",
  ],
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icons/w-ai-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/w-ai-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/w-ai-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/icons/w-ai-180.png", type: "image/png", sizes: "180x180" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/icons/w-ai-maskable-512.png",
        color: "#0a0a0a",
      },
    ],
  },
  openGraph: {
    type: "website",
    siteName: "W-AI",
    url: "https://www.w-ai.online/",
    title: "W-AI — Build the web you own",
    description: "Build, manage, and publish responsive websites with W-AI.",
    images: [
      {
        url: "/metadata/w-ai-social-1200x630.png",
        width: 1200,
        height: 630,
        alt: "W-AI — Build the web you own",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "W-AI — Build the web you own",
    description: "Build, manage, and publish responsive websites with W-AI.",
    images: ["/metadata/w-ai-social-1200x630.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body
        className={` ${geistSans.variable} ${geistMono.variable} ${tajawal.variable} bg-background font-sans text-foreground antialiased`}
        suppressHydrationWarning
      >
        {children}
        <SimpleToaster />
        <SimpleDevIndicator />
      </body>
    </html>
  );
}
