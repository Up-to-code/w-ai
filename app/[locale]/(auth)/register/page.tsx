"use client";

import { useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";

import { signUp } from "@/lib/auth-client";
import { authErrorKey, validateAuthFields } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormPanel } from "@/components/auth/auth-form-panel";

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
        authErrorKey(undefined, err instanceof Error ? err.message : "network"),
      );
      setLoading(false);
    }
  }

  return (
    <AuthFormPanel
      title={t("registerTitle")}
      subtitle={t("registerSubtitle")}
      footer={
        <p>
          {t("haveAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4 transition-opacity hover:opacity-60"
          >
            {t("signInHere")}
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-md border border-w-red/30 bg-w-red-soft px-3 py-2.5 text-sm text-w-red"
          >
            {t(error as Parameters<typeof t>[0])}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium text-foreground">
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
            className="h-11 rounded-md border-border bg-white px-3 focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-sm font-medium text-foreground"
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
            className="h-11 rounded-md border-border bg-white px-3 focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-sm font-medium text-foreground"
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
            className="h-11 rounded-md border-border bg-white px-3 focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground"
            required
            minLength={8}
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="mt-3 h-11 w-full rounded-md bg-foreground text-sm font-medium text-background hover:bg-w-carbon"
        >
          {loading ? t("loading") : t("register")}
        </Button>
      </form>
    </AuthFormPanel>
  );
}
