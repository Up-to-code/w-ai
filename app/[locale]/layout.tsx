import { notFound } from "next/navigation";
import { Locale, routing } from "@/i18n/routing";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { getToken } from "@/lib/auth-server";
import { HtmlDirSetter } from "@/components/html-dir-setter";
import { ConvexClientProvider } from "@/app/ConvexClientProviderV2";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  const [messages, initialToken] = await Promise.all([
    getMessages(),
    getToken().catch(() => null),
  ]);
  const isArabic = locale === "ar";

  return (
    <HtmlDirSetter lang={locale} dir={isArabic ? "rtl" : "ltr"}>
      <ConvexClientProvider initialToken={initialToken}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </ConvexClientProvider>
    </HtmlDirSetter>
  );
}
