"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { signUp } from "@/lib/auth-client";
import { authErrorKey, validateAuthFields } from "@/lib/auth-errors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fieldError = validateAuthFields({
      name,
      email,
      password,
      mode: "register",
    });
    if (fieldError) {
      setError(fieldError);
      return;
    }

    setLoading(true);
    try {
      const res = await signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if (res.error) {
        setError(authErrorKey(res.error.code, res.error.message));
        setLoading(false);
        return;
      }

      // New accounts have no org — force site creation.
      router.replace("/onboarding");
      router.refresh();
    } catch (err) {
      setError(
        authErrorKey(
          undefined,
          err instanceof Error ? err.message : "network",
        ),
      );
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-8 border-b border-border pb-6">
        <p className="label-meta mb-2">02 — AUTH</p>
        <h1 className="text-h2 font-semibold text-foreground">
          {t("registerTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("registerSubtitle")}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="border border-w-red bg-w-red-soft px-3 py-2 text-xs text-w-red"
          >
            {t(error as Parameters<typeof t>[0])}
          </div>
        )}

        <div className="space-y-1.5">
          <Label
            htmlFor="name"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {t("name")}
          </Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            className="rounded-sm border-border focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="email"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {t("email")}
          </Label>
          <Input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            className="rounded-sm border-border focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="password"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {t("password")}
          </Label>
          <Input
            id="password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            className="rounded-sm border-border focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground"
            required
            minLength={8}
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-sm bg-foreground py-2.5 text-sm font-medium text-background transition-brand hover:bg-w-carbon disabled:opacity-50"
        >
          {loading ? t("loading") : t("register")}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link
          href="/login"
          className="text-foreground underline underline-offset-4 transition-brand hover:text-w-graphite"
        >
          {t("signInHere")}
        </Link>
      </p>
    </div>
  );
}
