"use client";

import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  DOMAIN_REDIRECT_STATUS_OPTIONS,
  isDomainRedirectStatusCode,
} from "@/lib/domain-redirect-status";
import { tenantUrl } from "@/lib/tenant-host";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DomainDnsRecords } from "@/components/dashboard/domain-dns-records";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";

type Domain = {
  _id: string;
  hostname: string;
  verified: boolean;
  status?: "pending" | "configuring" | "verified" | "error";
  verificationToken?: string;
  cnameTarget?: string;
  apexTarget?: string;
  routingType?: "A" | "CNAME";
  redirectTo?: string;
  redirectStatusCode?: 301 | 302 | 307 | 308;
  platformVerified?: boolean;
  platformVerification?: Array<{ type: string; domain: string; value: string }>;
  tlsStatus?: "pending" | "active" | "error";
  tlsCheckedAt?: number;
  tlsExpiresAt?: number;
  provider?: "manual" | "cloudflare" | "vercel";
  verificationAttempt?: number;
  nextVerificationAt?: number;
  error?: string;
};

export function DomainsSettings({
  orgId,
  orgSlug,
  initialDomains,
  labels,
}: {
  orgId: Id<"organizations">;
  orgSlug: string;
  initialDomains: Domain[];
  labels: Record<string, string>;
}) {
  const { isAuthenticated } = useConvexAuth();
  const liveDomains = useQuery(
    api.domains.listForOrg,
    isAuthenticated ? { orgId } : "skip",
  );
  const domains = liveDomains ?? initialDomains;
  const providerConnections = useQuery(
    api.domains.listConnections,
    isAuthenticated ? {} : "skip",
  );
  const platformStatus = useQuery(
    api.domains.platformStatus,
    isAuthenticated ? {} : "skip",
  );
  const [domain, setDomain] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [cloudflareToken, setCloudflareToken] = useState("");
  const [connectingCloudflare, setConnectingCloudflare] = useState(false);

  const addDomain = useMutation(api.domains.add);
  const verifyDomain = useAction(api.domains.check);
  const provisionDomain = useAction(api.domains.provision);
  const removeDomain = useAction(api.domains.detach);
  const updateRedirect = useAction(api.domains.setRedirect);
  const connectProvider = useAction(api.domains.connectProvider);
  const host = tenantUrl(orgSlug)
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  async function handleAddDomain() {
    const hostname = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    if (!hostname) return;
    setAddingDomain(true);
    try {
      const domainId = await addDomain({
        orgId,
        hostname,
        provider: "manual",
      });
      setDomain("");
      if (!platformStatus?.vercelRoutingConfigured) {
        toast.info(
          "Domain saved. Configure W-AI's Vercel routing credentials, then use Sync routing.",
        );
        return;
      }
      try {
        await provisionDomain({ domainId, provider: "vercel" });
        toast.success(labels.domainAdded);
      } catch (error) {
        toast.warning(
          error instanceof Error
            ? `Domain saved, but routing needs attention: ${error.message}`
            : "Domain saved, but routing needs attention. Use Sync routing to retry.",
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.saveError);
    } finally {
      setAddingDomain(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success("Copied");
  }

  async function handleConnectCloudflare() {
    if (!cloudflareToken.trim()) return;
    setConnectingCloudflare(true);
    try {
      const result = await connectProvider({
        provider: "cloudflare",
        accessToken: cloudflareToken.trim(),
      });
      setCloudflareToken("");
      toast.success(`Connected ${result.accountName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.saveError);
    } finally {
      setConnectingCloudflare(false);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto bg-white">
      <PageHeader title="Domains" />

      <div className="max-w-5xl space-y-8 p-6 md:p-8">
        <section className="grid gap-5 border-b border-border pb-8 md:grid-cols-[220px_1fr]">
          <div>
            <h2 className="text-sm font-medium">W-AI subdomain</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Always available while you connect a custom domain.
            </p>
          </div>
          <div className="flex min-h-16 items-center justify-between gap-4 border border-border bg-white px-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-8 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-sm">{host}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Active
                </p>
              </div>
            </div>
            <a
              href={tenantUrl(orgSlug)}
              target="_blank"
              rel="noreferrer"
              aria-label="Open subdomain"
              className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-black/[0.04] hover:text-black"
            >
              <ExternalLink className="size-4" />
            </a>
          </div>
        </section>

        <section className="grid gap-5 border-b border-border pb-8 md:grid-cols-[220px_1fr]">
          <div>
            <h2 className="text-sm font-medium">Automatic DNS</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Optional. Connect Cloudflare once to create and manage records
              without leaving W-AI.
            </p>
          </div>
          {providerConnections?.some(
            (connection) => connection.provider === "cloudflare",
          ) ? (
            <div className="flex min-h-12 max-w-2xl items-center justify-between border border-border px-4">
              <div>
                <p className="text-xs font-medium">Cloudflare connected</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Use “Manage with Cloudflare” on any manually connected domain.
                </p>
              </div>
              <StatusBadge status="live" label="Connected" />
            </div>
          ) : (
            <div className="grid max-w-2xl gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                type="password"
                value={cloudflareToken}
                onChange={(event) => setCloudflareToken(event.target.value)}
                placeholder="Cloudflare API token · DNS Write"
                className="h-10 rounded-sm font-mono text-xs"
              />
              <button
                type="button"
                onClick={handleConnectCloudflare}
                disabled={connectingCloudflare || !cloudflareToken.trim()}
                className="h-10 rounded-sm border border-border px-4 text-xs font-medium hover:bg-black/[0.035] disabled:opacity-40"
              >
                {connectingCloudflare ? "Connecting…" : "Connect Cloudflare"}
              </button>
              <p className="text-[10px] leading-4 text-muted-foreground sm:col-span-2">
                Use a scoped token with Zone Read and DNS Write only. The
                encrypted token is stored for your account and never shown
                again.
              </p>
            </div>
          )}
        </section>

        <section className="grid gap-5 border-b border-border pb-8 md:grid-cols-[220px_1fr]">
          <div>
            <h2 className="text-sm font-medium">Connect a domain</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Enter a domain you own. Do not include a protocol or path.
            </p>
          </div>
          <div className="grid max-w-2xl gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <Globe2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                dir="ltr"
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleAddDomain();
                }}
                placeholder="example.com"
                className="h-10 rounded-sm pl-9 font-mono text-xs"
              />
            </div>
            <button
              type="button"
              onClick={handleAddDomain}
              disabled={addingDomain || !domain.trim()}
              className="h-10 shrink-0 rounded-sm bg-black px-4 text-xs font-medium text-white hover:bg-black/80 disabled:opacity-40"
            >
              {addingDomain ? "Adding…" : "Add domain"}
            </button>
          </div>
          <p className="mt-2 max-w-2xl text-[11px] text-muted-foreground">
            W-AI detects root domains—including multi-part endings such as
            example.co.uk—and subdomains automatically, then provides the
            correct DNS record.
          </p>
          {platformStatus?.vercelRoutingConfigured === false ? (
            <p className="mt-2 max-w-2xl text-[11px] text-amber-700">
              Vercel tenant routing is not configured on this deployment.
              Domains can be saved now and synchronized after the platform
              credentials are added.
            </p>
          ) : null}
        </section>

        <section className="grid gap-5 md:grid-cols-[220px_1fr]">
          <div>
            <h2 className="text-sm font-medium">Custom domains</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Review DNS records and connection status.
            </p>
          </div>
          <div className="max-w-2xl space-y-3">
            {domains.length === 0 ? (
              <div className="border border-dashed border-border px-5 py-10 text-center">
                <Globe2 className="mx-auto size-6 text-black/25" />
                <p className="mt-3 text-sm font-medium">No custom domains</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add your first domain above to see its DNS setup.
                </p>
              </div>
            ) : (
              domains.map((item) => {
                const fullItem = item as Domain;
                const routingType = fullItem.routingType ?? "CNAME";
                const routingTarget =
                  (routingType === "A"
                    ? fullItem.apexTarget
                    : fullItem.cnameTarget) ?? host;
                return (
                  <article
                    key={item._id}
                    className="border border-border bg-white"
                  >
                    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p dir="ltr" className="truncate font-mono text-sm">
                          {item.hostname}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {item.redirectTo
                            ? `Redirects to ${item.redirectTo}`
                            : item.verified && item.tlsStatus === "active"
                              ? "Serving this site · TLS active"
                              : item.platformVerified &&
                                  item.tlsStatus !== "active"
                                ? "Routing verified · TLS provisioning"
                                : item.tlsStatus === "active"
                                  ? "TLS active · DNS or routing action required"
                                  : "Waiting for DNS and platform verification"}
                        </p>
                      </div>
                      <StatusBadge
                        status={item.verified ? "live" : "pending"}
                        label={
                          item.verified
                            ? "Active"
                            : item.platformVerified &&
                                item.tlsStatus !== "active"
                              ? "TLS pending"
                              : "DNS pending"
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void provisionDomain({
                            domainId: item._id as Id<"domains">,
                            provider: "vercel",
                          })
                            .then((result) => toast.success(result.message))
                            .catch((error: unknown) =>
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : labels.saveError,
                              ),
                            )
                        }
                        aria-label={`Sync routing for ${item.hostname}`}
                        title="Sync platform routing"
                        className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-black/[0.04] hover:text-black"
                      >
                        <RefreshCw className="size-3.5" />
                      </button>
                      {item.verified ? (
                        <a
                          href={`https://${item.hostname}`}
                          target="_blank"
                          rel="noreferrer"
                          className="grid size-8 place-items-center rounded-md hover:bg-black/[0.04]"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          void removeDomain({
                            domainId: item._id as Id<"domains">,
                          })
                            .then(() => toast.success("Domain removed"))
                            .catch((error: unknown) =>
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : labels.saveError,
                              ),
                            )
                        }
                        aria-label={`Remove ${item.hostname}`}
                        className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    {!item.verified ? (
                      <div className="space-y-3 p-4">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Add ownership, routing, and any Vercel challenge
                            records. W-AI checks the connection automatically.
                          </p>
                          {fullItem.nextVerificationAt ? (
                            <p className="mt-1 text-[10px] text-black/40">
                              Next automatic check{" "}
                              {new Date(
                                fullItem.nextVerificationAt,
                              ).toLocaleString()}{" "}
                              · attempt{" "}
                              {(fullItem.verificationAttempt ?? 0) + 1}
                            </p>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-[76px_1fr_auto] items-center border border-border text-xs">
                          <span className="border-r border-border bg-black/[0.025] px-3 py-2.5 font-medium">
                            {routingType}
                          </span>
                          <code className="min-w-0 truncate px-3 py-2.5">
                            {routingTarget}
                          </code>
                          <button
                            type="button"
                            onClick={() => void copy(routingTarget)}
                            aria-label="Copy DNS target"
                            className="grid size-9 place-items-center border-l border-border hover:bg-black/[0.04]"
                          >
                            <Copy className="size-3.5" />
                          </button>
                        </div>
                        {fullItem.verificationToken ? (
                          <div className="grid grid-cols-[76px_1fr_auto] items-center border border-border text-xs">
                            <span className="border-r border-border bg-black/[0.025] px-3 py-2.5 font-medium">
                              TXT
                            </span>
                            <code className="min-w-0 truncate px-3 py-2.5">
                              _w-ai-verify.{item.hostname} ·{" "}
                              {fullItem.verificationToken}
                            </code>
                            <button
                              type="button"
                              onClick={() =>
                                void copy(fullItem.verificationToken!)
                              }
                              aria-label="Copy ownership token"
                              className="grid size-9 place-items-center border-l border-border hover:bg-black/[0.04]"
                            >
                              <Copy className="size-3.5" />
                            </button>
                          </div>
                        ) : null}
                        {fullItem.platformVerification?.map((record) => (
                          <div
                            key={`${record.type}-${record.domain}-${record.value}`}
                            className="grid grid-cols-[76px_1fr_auto] items-center border border-border text-xs"
                          >
                            <span className="border-r border-border bg-black/[0.025] px-3 py-2.5 font-medium">
                              {record.type}
                            </span>
                            <code className="min-w-0 truncate px-3 py-2.5">
                              {record.domain} · {record.value}
                            </code>
                            <button
                              type="button"
                              onClick={() => void copy(record.value)}
                              aria-label="Copy Vercel verification value"
                              className="grid size-9 place-items-center border-l border-border hover:bg-black/[0.04]"
                            >
                              <Copy className="size-3.5" />
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void provisionDomain({
                                domainId: item._id as Id<"domains">,
                                provider: "vercel",
                              })
                                .then((result) => toast.success(result.message))
                                .catch((error: unknown) =>
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : labels.saveError,
                                  ),
                                )
                            }
                            className="inline-flex h-9 items-center gap-2 rounded-sm border border-border px-3 text-xs font-medium hover:bg-black/[0.035]"
                          >
                            Attach routing
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void verifyDomain({
                                domainId: item._id as Id<"domains">,
                              })
                                .then((result) =>
                                  result.verified
                                    ? toast.success(result.message)
                                    : toast.info(result.message),
                                )
                                .catch((error: unknown) =>
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : labels.saveError,
                                  ),
                                )
                            }
                            className="inline-flex h-9 items-center gap-2 rounded-sm border border-border px-3 text-xs font-medium hover:bg-black/[0.035]"
                          >
                            <RefreshCw className="size-3.5" />
                            Check now
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="grid gap-3 border-t border-border bg-black/[0.015] p-4 sm:grid-cols-[170px_minmax(0,1fr)_150px] sm:items-center">
                      <div>
                        <p className="text-xs font-medium">Traffic behavior</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Serve here or redirect permanently.
                        </p>
                      </div>
                      <Select
                        value={item.redirectTo ?? "__serve__"}
                        onValueChange={(value) => {
                          const target = domains.find(
                            (candidate) => candidate.hostname === value,
                          );
                          void updateRedirect({
                            domainId: item._id as Id<"domains">,
                            targetDomainId: target?._id as
                              Id<"domains"> | undefined,
                            statusCode: target
                              ? (item.redirectStatusCode ?? 308)
                              : undefined,
                          })
                            .then((result) => toast.success(result.message))
                            .catch((error: unknown) =>
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : labels.saveError,
                              ),
                            );
                        }}
                      >
                        <SelectTrigger className="h-9 rounded-sm bg-white text-xs shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__serve__">
                            Serve this site directly
                          </SelectItem>
                          {domains
                            .filter(
                              (candidate) =>
                                candidate._id !== item._id &&
                                candidate.verified &&
                                !candidate.redirectTo,
                            )
                            .map((candidate) => (
                              <SelectItem
                                key={candidate._id}
                                value={candidate.hostname}
                              >
                                Redirect to {candidate.hostname} · 308
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {item.redirectTo ? (
                        <Select
                          value={String(item.redirectStatusCode ?? 308)}
                          onValueChange={(value) => {
                            const statusCode = Number(value);
                            const target = domains.find(
                              (candidate) =>
                                candidate.hostname === item.redirectTo,
                            );
                            if (
                              !target ||
                              !isDomainRedirectStatusCode(statusCode)
                            )
                              return;
                            void updateRedirect({
                              domainId: item._id as Id<"domains">,
                              targetDomainId: target._id as Id<"domains">,
                              statusCode,
                            })
                              .then((result) => toast.success(result.message))
                              .catch((error: unknown) =>
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : labels.saveError,
                                ),
                              );
                          }}
                        >
                          <SelectTrigger className="h-9 rounded-sm bg-white text-xs shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DOMAIN_REDIRECT_STATUS_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={String(option.value)}
                              >
                                <span className="flex flex-col">
                                  <span>{option.label}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {option.description}
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                    </div>
                    {fullItem.provider === "manual" &&
                    providerConnections?.some(
                      (connection) => connection.provider === "cloudflare",
                    ) ? (
                      <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
                        <div>
                          <p className="text-xs font-medium">Cloudflare DNS</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            Create routing and ownership records automatically.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            void provisionDomain({
                              domainId: item._id as Id<"domains">,
                              provider: "cloudflare",
                            })
                              .then((result) => toast.success(result.message))
                              .catch((error: unknown) =>
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : labels.saveError,
                                ),
                              )
                          }
                          className="h-8 rounded-sm border border-border px-3 text-[11px] font-medium hover:bg-black/[0.035]"
                        >
                          Manage with Cloudflare
                        </button>
                      </div>
                    ) : null}
                    {fullItem.provider === "cloudflare" ||
                    fullItem.provider === "vercel" ? (
                      <DomainDnsRecords
                        domainId={item._id as Id<"domains">}
                        hostname={item.hostname}
                      />
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
