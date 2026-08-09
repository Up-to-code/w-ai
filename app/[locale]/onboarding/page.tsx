"use client";

import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Link, useRouter } from "@/i18n/routing";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";

import { useConvexReady } from "@/hooks/use-convex-ready";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand/brand-mark";
import { OnboardingSkeleton } from "@/components/dashboard/loading-state";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function orgErrorKey(message: string | undefined): string {
  if (!message) return "errorGeneric";
  const m = message.toLowerCase();
  if (m.includes("already taken")) return "slugTaken";
  if (m.includes("invalid site address") || m.includes("lowercase")) {
    return "slugInvalid";
  }
  if (m.includes("at least 2 characters")) return "errorNameTooShort";
  if (m.includes("beta access")) return "errorBetaRequired";
  if (m.includes("not allowed") || m.includes("signup"))
    return "errorNotAllowed";
  if (m.includes("limit") || m.includes("plan")) return "errorLimit";
  if (m.includes("invalid or inactive invite")) return "errorInviteInvalid";
  if (m.includes("expired")) return "errorInviteExpired";
  if (m.includes("no remaining")) return "errorInviteExhausted";
  return "errorGeneric";
}

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const tErr = useTranslations("auth");
  const router = useRouter();
  const { session, sessionPending, hasSession, canQuery, ready } =
    useConvexReady();
  const beta = useQuery(api.beta.status, canQuery ? {} : "skip");
  const createOrg = useMutation(api.organizations.create);
  const redeemInvite = useMutation(api.beta.redeemInvite);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!hasSession) router.replace("/login");
  }, [ready, hasSession, router]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const trimmedName = name.trim();
  const trimmedSlug = slug.trim().toLowerCase();
  const nameValid = trimmedName.length >= 2;
  const slugValid =
    trimmedSlug.length >= 3 &&
    trimmedSlug.length <= 40 &&
    SLUG_RE.test(trimmedSlug);

  const nameError = name && !nameValid ? tErr("errorNameTooShort") : null;
  const slugError = slug && !slugValid ? t("slugInvalid") : null;

  // Only gate on beta when we actually have a status payload.
  // Never block the form forever on an unresolved query.
  const betaKnown = beta !== undefined;
  const needsBeta = betaKnown && !!beta.betaRequired && !beta.betaAccess;
  const canCreate = hasSession && (!betaKnown || !needsBeta);

  const submitDisabled =
    loading ||
    sessionPending ||
    !hasSession ||
    !canCreate ||
    !nameValid ||
    !slugValid;

  async function onRedeemInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    const code = inviteCode.trim();
    if (!code) {
      setInviteError("errorInviteRequired");
      return;
    }
    setRedeeming(true);
    try {
      await redeemInvite({ code });
      setInviteCode("");
    } catch (err) {
      setInviteError(
        orgErrorKey(err instanceof Error ? err.message : undefined),
      );
    } finally {
      setRedeeming(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!hasSession) {
      router.replace("/login");
      return;
    }
    if (!nameValid || !slugValid) return;

    setLoading(true);
    try {
      await createOrg({ name: trimmedName, slug: trimmedSlug });
      router.replace({
        pathname: "/dashboard/[org]/pages",
        params: { org: trimmedSlug },
      });
      router.refresh();
    } catch (err) {
      setError(orgErrorKey(err instanceof Error ? err.message : undefined));
      setLoading(false);
    }
  }

  function translateError(key: string) {
    const authKeys = new Set([
      "errorNameTooShort",
      "errorGeneric",
      "errorNotAllowed",
      "errorLimit",
      "errorBetaRequired",
      "errorInviteInvalid",
      "errorInviteExpired",
      "errorInviteExhausted",
      "errorInviteRequired",
    ]);
    if (authKeys.has(key)) return tErr(key as Parameters<typeof tErr>[0]);
    return t(key as Parameters<typeof t>[0]);
  }

  // Only skeleton while the browser session is unknown.
  // Never block on Convex auth bridge — form must remain usable.
  if (sessionPending) {
    return <OnboardingSkeleton />;
  }

  if (!hasSession) {
    return null;
  }

  return (
    <div className="flex min-h-svh flex-col bg-white text-[#171717]">
      <header className="border-b border-black/10 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-foreground"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-black text-white"><BrandMark className="h-4 w-6" /></span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-black">
              {t("title")}
            </h1>
            <p className="mt-2 text-sm text-black/45">
              {t("subtitle")}
            </p>
          </div>

          {needsBeta ? (
            <form
              key="access"
              onSubmit={onRedeemInvite}
              className="animate-in space-y-5 fade-in slide-in-from-bottom-2 duration-300"
            >
              <div>
                <p className="mb-2 text-xs font-semibold">Beta access</p>
                <p className="text-sm text-muted-foreground">{t("betaHint")}</p>
              </div>
              {inviteError && (
                <div
                  role="alert"
                  className="border border-w-red bg-w-red-soft px-3 py-2 text-xs text-w-red"
                >
                  {translateError(inviteError)}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="invite" className="label-meta">
                  {t("inviteCode")}
                </Label>
                <Input
                  id="invite"
                  type="text"
                  dir="ltr"
                  autoComplete="off"
                  placeholder={t("invitePlaceholder")}
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value.toUpperCase());
                    if (inviteError) setInviteError(null);
                  }}
                className="h-11 rounded-xl border-black/10 bg-white font-mono shadow-none"
                  disabled={redeeming}
                />
              </div>
              <button
                type="submit"
                disabled={redeeming || !inviteCode.trim()}
                className="w-full rounded-xl border border-black/10 bg-white py-2.5 text-sm font-medium transition-colors hover:bg-black/[0.03] disabled:opacity-50"
              >
                {redeeming ? t("redeeming") : t("redeem")}
              </button>
            </form>
          ) : (
          <form key="details" onSubmit={onSubmit} className="animate-in space-y-5 fade-in slide-in-from-bottom-2 duration-300" noValidate>
            {error && (
              <div
                role="alert"
                className="border border-w-red bg-w-red-soft px-3 py-2 text-xs text-w-red"
              >
                {translateError(error)}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="orgName" className="label-meta">
                {t("orgName")}
              </Label>
              <Input
                id="orgName"
                type="text"
                placeholder={t("orgNamePlaceholder")}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                className="h-11 rounded-xl border-black/10 shadow-none"
                required
                disabled={loading || needsBeta}
                aria-invalid={!!nameError}
              />
              {nameError && <p className="text-xs text-w-red">{nameError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug" className="label-meta">
                {t("slug")}
              </Label>
              <div className="flex items-center rounded-xl border border-black/10 bg-white focus-within:border-black/35 focus-within:ring-1 focus-within:ring-black/10">
                <input
                  id="slug"
                  type="text"
                  dir="ltr"
                  placeholder="my-site"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase());
                    if (error) setError(null);
                  }}
                  className="min-w-0 flex-1 border-none bg-transparent px-3 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                  required
                  disabled={loading || needsBeta}
                />
                <span
                  className="shrink-0 border-s border-black/10 bg-[#f7f7f5] px-3 py-3 font-mono text-xs text-black/45"
                  dir="ltr"
                >
                  .qentrah.com
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("slugHint")}{" "}
                <span className="font-mono" dir="ltr">
                  {trimmedSlug || "my-site"}.qentrah.com
                </span>
              </p>
              {slugError && <p className="text-xs text-w-red">{slugError}</p>}
            </div>

            <button
              type="submit"
              disabled={submitDisabled}
              className="w-full rounded-xl bg-black py-3 text-sm font-medium text-white transition-colors hover:bg-black/80 disabled:opacity-40"
            >
              {loading ? t("creating") : t("create")} ↗
            </button>
          </form>
          )}

        </div>
      </main>
    </div>
  );
}
