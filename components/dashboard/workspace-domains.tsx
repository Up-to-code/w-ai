"use client";

import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  DOMAIN_REDIRECT_STATUS_OPTIONS,
  isDomainRedirectStatusCode,
} from "@/lib/domain-redirect-status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AR_COPY,
  EN_COPY,
  WorkspaceSidebar,
} from "@/components/dashboard/workspace-dashboard-v2";

export function WorkspaceDomains({ locale }: { locale: "ar" | "en" }) {
  const copy = locale === "ar" ? AR_COPY : EN_COPY;
  const domains = useQuery(api.domains.listWorkspace, {});
  const sites = useQuery(api.organizations.listMine, {});
  const foldersResult = useQuery(api.projectFolders.listMine, {});
  const userResult = useQuery(api.users.me, {});
  const platformStatus = useQuery(api.domains.platformStatus, {});
  const addDomain = useMutation(api.domains.add);
  const assignDomain = useMutation(api.domains.assign);
  const detachDomain = useAction(api.domains.detach);
  const checkDomain = useAction(api.domains.check);
  const provisionDomain = useAction(api.domains.provision);
  const updateRedirect = useAction(api.domains.setRedirect);

  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [hostname, setHostname] = useState("");
  const [siteId, setSiteId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const visibleDomains = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (domains ?? []).filter(
      (domain) =>
        !needle ||
        domain.hostname.includes(needle) ||
        domain.orgName.toLowerCase().includes(needle) ||
        domain.orgSlug.toLowerCase().includes(needle),
    );
  }, [domains, query]);

  const userName =
    userResult?.user.name || userResult?.user.email || copy.account;

  async function createDomain() {
    if (!siteId || !hostname.trim()) return;
    setBusy("add");
    try {
      const domainId = await addDomain({
        orgId: siteId as Id<"organizations">,
        hostname,
        provider: "manual",
      });
      setAddOpen(false);
      setHostname("");
      setSiteId("");
      if (!platformStatus?.vercelRoutingConfigured) {
        toast.info(
          "Domain saved. Configure W-AI's Vercel routing credentials, then use Sync routing.",
        );
        return;
      }
      try {
        await provisionDomain({ domainId, provider: "vercel" });
        toast.success("Domain added. Publish both DNS records to verify it.");
      } catch (error) {
        toast.warning(
          error instanceof Error
            ? `Domain saved, but routing needs attention: ${error.message}`
            : "Domain saved, but routing needs attention. Use Sync routing to retry.",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add domain",
      );
    } finally {
      setBusy(null);
    }
  }

  async function copyValue(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success("Copied");
  }

  return (
    <div className="flex min-h-svh bg-white text-[#171717]">
      <WorkspaceSidebar
        copy={copy}
        activeSection="domains"
        folders={foldersResult?.folders ?? []}
        userName={userName}
      />

      <main className="min-w-0 flex-1 px-5 py-7 md:px-8 lg:px-12">
        <div className="mx-auto max-w-[1240px]">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-[-0.025em]">
                Domains
              </h1>
              <p className="mt-1 text-xs text-black/45">
                Assign domains to sites, verify ownership, and manage routing.
              </p>
            </div>
            <Button
              onClick={() => {
                setSiteId(sites?.[0]?._id ?? "");
                setAddOpen(true);
              }}
              className="h-9 rounded-md bg-black px-4 shadow-none hover:bg-black/80"
            >
              <Plus className="me-1.5 size-4" /> Add domain
            </Button>
          </header>

          <div className="mt-7">
            <label className="relative block">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-black/35" />
              <Input
                name="workspace-domain-search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search domains or sites"
                className="h-10 rounded-md border-black/15 ps-9 shadow-none"
              />
            </label>
          </div>

          <section className="mt-4 overflow-hidden rounded-lg border border-black/10">
            <div className="grid grid-cols-[minmax(180px,1.4fr)_minmax(150px,1fr)_160px_120px_76px] gap-4 border-b border-black/10 bg-[#fafafa] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[.08em] text-black/40">
              <span>Domain</span>
              <span>Assigned site</span>
              <span>Traffic</span>
              <span>Status</span>
              <span />
            </div>
            {domains === undefined ? (
              <div className="grid min-h-36 place-items-center">
                <Loader2 className="size-5 animate-spin text-black/35" />
              </div>
            ) : visibleDomains.length === 0 ? (
              <div className="grid min-h-48 place-items-center text-center">
                <div>
                  <Globe2 className="mx-auto size-6 text-black/25" />
                  <p className="mt-3 text-sm font-medium">No domains yet</p>
                  <p className="mt-1 text-xs text-black/40">
                    Connect the first hostname to one of your sites.
                  </p>
                </div>
              </div>
            ) : (
              visibleDomains.map((domain) => {
                const routingType = domain.routingType;
                const routingValue =
                  routingType === "A" ? domain.apexTarget : domain.cnameTarget;
                return (
                  <article
                    key={domain._id}
                    className="border-b border-black/10 last:border-b-0"
                  >
                    <div className="grid grid-cols-[minmax(180px,1.4fr)_minmax(150px,1fr)_160px_120px_76px] items-center gap-4 px-4 py-3.5 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-mono font-medium" dir="ltr">
                          {domain.hostname}
                        </p>
                        <p className="mt-1 text-[10px] text-black/40">
                          {domain.ownershipModel === "customer_registrant"
                            ? "Customer registrant"
                            : "Bring your own"}{" "}
                          · Added{" "}
                          {new Date(domain.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Select
                        value={domain.orgId}
                        onValueChange={(nextOrgId) =>
                          void assignDomain({
                            domainId: domain._id,
                            orgId: nextOrgId as Id<"organizations">,
                          })
                            .then(() => toast.success("Domain assigned"))
                            .catch((error: unknown) =>
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Assignment failed",
                              ),
                            )
                        }
                      >
                        <SelectTrigger className="h-8 min-w-0 border-0 bg-transparent px-0 text-xs shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sites?.map((site) => (
                            <SelectItem key={site._id} value={site._id}>
                              {site.name} · {site.slug}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="min-w-0 space-y-1">
                        <Select
                          value={domain.redirectTo ?? "__serve__"}
                          onValueChange={(value) => {
                            const target = domains.find(
                              (candidate) => candidate.hostname === value,
                            );
                            void updateRedirect({
                              domainId: domain._id,
                              targetDomainId: target?._id,
                              statusCode: target
                                ? (domain.redirectStatusCode ?? 308)
                                : undefined,
                            })
                              .then((result) => toast.success(result.message))
                              .catch((error: unknown) =>
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Redirect update failed",
                                ),
                              );
                          }}
                        >
                          <SelectTrigger className="h-7 min-w-0 border-0 bg-transparent px-0 text-xs shadow-none focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__serve__">Serve</SelectItem>
                            {domains
                              .filter(
                                (candidate) =>
                                  candidate.orgId === domain.orgId &&
                                  candidate._id !== domain._id &&
                                  candidate.verified &&
                                  !candidate.redirectTo,
                              )
                              .map((candidate) => (
                                <SelectItem
                                  key={candidate._id}
                                  value={candidate.hostname}
                                >
                                  → {candidate.hostname}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {domain.redirectTo ? (
                          <Select
                            value={String(domain.redirectStatusCode ?? 308)}
                            onValueChange={(value) => {
                              const statusCode = Number(value);
                              const target = domains.find(
                                (candidate) =>
                                  candidate.hostname === domain.redirectTo,
                              );
                              if (
                                !target ||
                                !isDomainRedirectStatusCode(statusCode)
                              )
                                return;
                              void updateRedirect({
                                domainId: domain._id,
                                targetDomainId: target._id,
                                statusCode,
                              })
                                .then((result) => toast.success(result.message))
                                .catch((error: unknown) =>
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : "Redirect update failed",
                                  ),
                                );
                            }}
                          >
                            <SelectTrigger className="h-6 min-w-0 border-0 bg-transparent px-0 text-[10px] text-black/45 shadow-none focus:ring-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DOMAIN_REDIRECT_STATUS_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={String(option.value)}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                      </div>
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/[0.045] px-2 py-1 text-[10px] font-medium">
                        <span
                          className={`size-1.5 rounded-full ${domain.verified ? "bg-emerald-500" : domain.status === "error" ? "bg-red-500" : "bg-amber-500"}`}
                        />
                        {domain.verified
                          ? "Active"
                          : domain.platformVerified &&
                              domain.tlsStatus !== "active"
                            ? "TLS pending"
                            : "DNS pending"}
                      </span>
                      <div className="flex items-center">
                        <button
                          type="button"
                          aria-label={`Sync routing for ${domain.hostname}`}
                          title="Sync platform routing"
                          onClick={() =>
                            void provisionDomain({
                              domainId: domain._id,
                              provider: "vercel",
                            })
                              .then((result) => toast.success(result.message))
                              .catch((error: unknown) =>
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Routing sync failed",
                                ),
                              )
                          }
                          className="grid size-8 place-items-center rounded-md text-black/35 hover:bg-black/[0.04] hover:text-black"
                        >
                          <RefreshCw className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Detach ${domain.hostname}`}
                          onClick={() =>
                            void detachDomain({ domainId: domain._id })
                              .then(() =>
                                toast.success(
                                  "Domain detached from the site and Vercel",
                                ),
                              )
                              .catch((error: unknown) =>
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Could not detach domain",
                                ),
                              )
                          }
                          className="grid size-8 place-items-center rounded-md text-black/35 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    {!domain.verified ? (
                      <div className="grid gap-2 bg-[#fafafa] px-4 py-3 md:grid-cols-2">
                        <DnsRecord
                          type={routingType}
                          name={domain.hostname}
                          value={routingValue}
                          onCopy={copyValue}
                        />
                        <DnsRecord
                          type="TXT"
                          name={`_w-ai-verify.${domain.hostname}`}
                          value={domain.verificationToken}
                          onCopy={copyValue}
                        />
                        {domain.platformVerification.map((record) => (
                          <DnsRecord
                            key={`${record.type}-${record.domain}-${record.value}`}
                            type={record.type}
                            name={record.domain}
                            value={record.value}
                            onCopy={copyValue}
                          />
                        ))}
                        <div className="flex items-center justify-between gap-3 md:col-span-2">
                          <p className="text-[10px] text-black/45">
                            {domain.nextVerificationAt
                              ? `${domain.error ?? "Waiting for DNS propagation."} Next automatic check ${new Date(domain.nextVerificationAt).toLocaleString()}.`
                              : (domain.error ??
                                "Both records are required. DNS changes may take time to propagate.")}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              className="h-8 rounded-md bg-white px-3 text-[11px] shadow-none"
                              onClick={() =>
                                void provisionDomain({
                                  domainId: domain._id,
                                  provider: "vercel",
                                })
                                  .then((result) =>
                                    toast.success(result.message),
                                  )
                                  .catch((error: unknown) =>
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "Routing attachment failed",
                                    ),
                                  )
                              }
                            >
                              Attach routing
                            </Button>
                            <Button
                              variant="outline"
                              className="h-8 shrink-0 rounded-md bg-white px-3 text-[11px] shadow-none"
                              disabled={busy === domain._id}
                              onClick={() => {
                                setBusy(domain._id);
                                void checkDomain({ domainId: domain._id })
                                  .then((result) =>
                                    result.verified
                                      ? toast.success(result.message)
                                      : toast.info(result.message),
                                  )
                                  .catch((error: unknown) =>
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "DNS check failed",
                                    ),
                                  )
                                  .finally(() => setBusy(null));
                              }}
                            >
                              {busy === domain._id ? (
                                <Loader2 className="me-1.5 size-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="me-1.5 size-3.5" />
                              )}
                              Check now
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-[#fafafa] px-4 py-2.5 text-[10px] text-black/45">
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                          Traffic routes securely to {domain.orgName}
                        </span>
                        <a
                          href={`https://${domain.hostname}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-black hover:underline"
                        >
                          Open <ExternalLink className="size-3" />
                        </a>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </section>
        </div>
      </main>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md rounded-xl border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,.14)]">
          <DialogHeader>
            <DialogTitle>Add domain</DialogTitle>
            <DialogDescription>
              Assign a hostname to a site. W-AI will require ownership and
              routing records before serving traffic.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium">Domain</label>
              <Input
                dir="ltr"
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
                placeholder="www.example.com"
                className="font-mono"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium">Site</label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a site" />
                </SelectTrigger>
                <SelectContent>
                  {sites?.map((site) => (
                    <SelectItem key={site._id} value={site._id}>
                      {site.name} · {site.slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="rounded-md bg-black/[0.035] px-3 py-2.5 text-[10px] leading-4 text-black/50">
              W-AI automatically detects whether this is a root domain or
              subdomain, then provides the correct A or CNAME record. W-AI
              manages Vercel routing and TLS.
            </p>
            {platformStatus?.vercelRoutingConfigured === false ? (
              <p className="rounded-md bg-amber-50 px-3 py-2.5 text-[10px] leading-4 text-amber-800">
                Vercel tenant routing is not configured on this deployment. The
                hostname will be saved and can be synchronized later.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!hostname.trim() || !siteId || busy === "add"}
              onClick={() => void createDomain()}
              className="bg-black text-white hover:bg-black/80"
            >
              {busy === "add" ? (
                <Loader2 className="me-1.5 size-4 animate-spin" />
              ) : null}
              Add domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DnsRecord({
  type,
  name,
  value,
  onCopy,
}: {
  type: string;
  name: string;
  value: string;
  onCopy: (value: string) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-[54px_minmax(0,1fr)_32px] items-center overflow-hidden rounded-md border border-black/10 bg-white text-[10px]">
      <span className="border-e border-black/10 bg-black/[0.025] px-2 py-2.5 font-semibold">
        {type}
      </span>
      <div className="min-w-0 px-2">
        <p className="truncate font-mono text-black/45" dir="ltr">
          {name}
        </p>
        <p className="truncate font-mono font-medium" dir="ltr">
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void onCopy(value)}
        aria-label={`Copy ${type} value`}
        className="grid size-8 place-items-center border-s border-black/10 hover:bg-black/[0.035]"
      >
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}
