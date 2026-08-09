"use client";

import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { ArrowRight, Globe2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/page-header";

type DomainOption = {
  _id: Id<"domains">;
  hostname: string;
  verified: boolean;
  redirectTo?: string;
  redirectStatusCode?: 301 | 302 | 307 | 308;
};
type RedirectRule = {
  _id: Id<"redirectRules">;
  orgId: Id<"organizations">;
  hostname?: string;
  matchType: "exact" | "prefix";
  sourcePath: string;
  destination: string;
  statusCode: 307 | 308;
  preserveQuery: boolean;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

const ALL_HOSTS = "__all__";

export function RedirectsManager({
  orgId,
  domains: initialDomains,
}: {
  orgId: Id<"organizations">;
  domains: DomainOption[];
}) {
  const liveDomains = useQuery(api.domains.listForOrg, { orgId });
  const domains = liveDomains ?? initialDomains;
  const {
    results: rules,
    status: rulesStatus,
    loadMore,
  } = usePaginatedQuery(api.redirects.list, { orgId }, { initialNumItems: 50 });
  const createRule = useMutation(api.redirects.create);
  const updateRule = useMutation(api.redirects.update);
  const setEnabled = useMutation(api.redirects.setEnabled);
  const removeRule = useMutation(api.redirects.remove);
  const setDomainRedirect = useAction(api.domains.setRedirect);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RedirectRule | null>(null);
  const [hostname, setHostname] = useState(ALL_HOSTS);
  const [matchType, setMatchType] = useState<"exact" | "prefix">("exact");
  const [sourcePath, setSourcePath] = useState("");
  const [destination, setDestination] = useState("");
  const [statusCode, setStatusCode] = useState<307 | 308>(308);
  const [preserveQuery, setPreserveQuery] = useState(true);
  const [saving, setSaving] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainOption | null>(null);
  const [domainTarget, setDomainTarget] = useState("__serve__");
  const [domainStatusCode, setDomainStatusCode] = useState<
    301 | 302 | 307 | 308
  >(308);
  const [savingDomain, setSavingDomain] = useState(false);
  const [deletingRule, setDeletingRule] = useState<RedirectRule | null>(null);
  const [removingRule, setRemovingRule] = useState(false);

  const verifiedDomains = useMemo(
    () => domains.filter((domain) => domain.verified),
    [domains],
  );

  const filteredRules = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rules;
    return rules.filter((rule) =>
      [rule.hostname ?? "all domains", rule.sourcePath, rule.destination]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [query, rules]);

  function resetForm() {
    setEditing(null);
    setHostname(ALL_HOSTS);
    setMatchType("exact");
    setSourcePath("");
    setDestination("");
    setStatusCode(308);
    setPreserveQuery(true);
  }

  function beginCreate() {
    resetForm();
    setOpen(true);
  }

  function beginEdit(rule: RedirectRule) {
    setEditing(rule);
    setHostname(rule.hostname ?? ALL_HOSTS);
    setMatchType(rule.matchType);
    setSourcePath(rule.sourcePath);
    setDestination(rule.destination);
    setStatusCode(rule.statusCode);
    setPreserveQuery(rule.preserveQuery);
    setOpen(true);
  }

  function beginDomainEdit(domain: DomainOption) {
    setEditingDomain(domain);
    setDomainTarget(domain.redirectTo ?? "__serve__");
    setDomainStatusCode(domain.redirectStatusCode ?? 308);
    setDomainOpen(true);
  }

  async function saveDomainRedirect() {
    if (!editingDomain) return;
    const target = domains.find((domain) => domain.hostname === domainTarget);
    setSavingDomain(true);
    try {
      const result = await setDomainRedirect({
        domainId: editingDomain._id,
        targetDomainId: target?._id,
        statusCode: target ? domainStatusCode : undefined,
      });
      toast.success(result.message);
      setDomainOpen(false);
      setEditingDomain(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update domain redirect",
      );
    } finally {
      setSavingDomain(false);
    }
  }

  async function confirmRemoveRule() {
    if (!deletingRule) return;
    setRemovingRule(true);
    try {
      await removeRule({ redirectId: deletingRule._id });
      toast.success("Redirect removed");
      setDeletingRule(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove redirect",
      );
    } finally {
      setRemovingRule(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        hostname: hostname === ALL_HOSTS ? undefined : hostname,
        matchType,
        sourcePath,
        destination,
        statusCode,
        preserveQuery,
      };
      if (editing) {
        await updateRule({ redirectId: editing._id, ...payload });
        toast.success("Redirect updated");
      } else {
        await createRule({ orgId, ...payload });
        toast.success("Redirect created");
      }
      setOpen(false);
      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save redirect",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto bg-white">
      <PageHeader
        title="Redirects"
        description="Send old URLs to the right page across every hostname connected to this site."
        actions={
          <Button
            onClick={beginCreate}
            className="h-9 rounded-sm bg-black px-3 text-xs text-white hover:bg-black/80"
          >
            <Plus className="me-1.5 size-3.5" /> New redirect
          </Button>
        }
      />

      <div className="max-w-6xl space-y-5 p-6 md:p-8">
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Domain redirects</h2>
            <p className="mt-1 text-xs text-black/45">
              Choose which connected hostname serves the site and which ones
              forward to it.
            </p>
          </div>
          <div className="overflow-hidden border border-border bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-black/[0.02] hover:bg-black/[0.02]">
                  <TableHead className="h-10 text-[10px] uppercase tracking-wide">
                    Hostname
                  </TableHead>
                  <TableHead className="h-10 text-[10px] uppercase tracking-wide">
                    Traffic
                  </TableHead>
                  <TableHead className="h-10 w-28 text-[10px] uppercase tracking-wide">
                    Status
                  </TableHead>
                  <TableHead className="h-10 w-14">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifiedDomains.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-xs text-black/40"
                    >
                      Verify a connected domain before configuring its traffic.
                    </TableCell>
                  </TableRow>
                ) : (
                  verifiedDomains.map((domain) => (
                    <TableRow key={domain._id}>
                      <TableCell className="py-3">
                        <span className="flex items-center gap-2 font-mono text-xs">
                          <Globe2 className="size-3.5 text-black/30" />
                          {domain.hostname}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-xs">
                        {domain.redirectTo ? (
                          <span className="flex items-center gap-2">
                            <ArrowRight className="size-3 text-black/30" />
                            <span className="font-mono" dir="ltr">
                              {domain.redirectTo}
                            </span>
                          </span>
                        ) : (
                          <span className="text-black/55">
                            Serves this site
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-black/55">
                        {domain.redirectTo
                          ? (domain.redirectStatusCode ?? 308)
                          : "—"}
                      </TableCell>
                      <TableCell className="py-3">
                        <button
                          type="button"
                          aria-label={`Edit redirect for ${domain.hostname}`}
                          className="grid size-8 place-items-center rounded-md text-black/35 hover:bg-black/[0.04] hover:text-black"
                          onClick={() => beginDomainEdit(domain)}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <div className="border-t border-border pt-5">
          <h2 className="text-sm font-semibold">URL redirects</h2>
          <p className="mt-1 text-xs text-black/45">
            Forward an old page or section to its current location.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative max-w-xl flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-black/35" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search loaded redirects"
              className="h-9 rounded-sm pl-9 text-xs shadow-none"
            />
          </div>
          <span className="text-[11px] text-black/40">
            {rules.length} loaded
          </span>
        </div>

        <div className="overflow-hidden border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-black/[0.02] hover:bg-black/[0.02]">
                <TableHead className="h-10 text-[10px] uppercase tracking-wide">
                  Source
                </TableHead>
                <TableHead className="h-10 text-[10px] uppercase tracking-wide">
                  Destination
                </TableHead>
                <TableHead className="h-10 text-[10px] uppercase tracking-wide">
                  Scope
                </TableHead>
                <TableHead className="h-10 text-[10px] uppercase tracking-wide">
                  Type
                </TableHead>
                <TableHead className="h-10 w-24 text-[10px] uppercase tracking-wide">
                  Active
                </TableHead>
                <TableHead className="h-10 w-14">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rulesStatus === "LoadingFirstPage" ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-28 text-center text-xs text-black/40"
                  >
                    Loading redirects…
                  </TableCell>
                </TableRow>
              ) : filteredRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-36 text-center">
                    <p className="text-sm font-medium">No redirects found</p>
                    <p className="mt-1 text-xs text-black/40">
                      Create a rule when a page moves or a URL changes.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRules.map((rule) => (
                  <TableRow
                    key={rule._id}
                    className="group cursor-pointer"
                    onClick={() => beginEdit(rule)}
                  >
                    <TableCell className="py-3 font-mono text-xs">
                      {rule.sourcePath}
                      {rule.matchType === "prefix" ? "/*" : ""}
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="flex max-w-sm items-center gap-2">
                        <ArrowRight className="size-3 shrink-0 text-black/30" />
                        <span className="truncate font-mono text-xs" dir="ltr">
                          {rule.destination}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-xs text-black/55">
                      {rule.hostname ?? "All site domains"}
                    </TableCell>
                    <TableCell className="py-3 text-xs">
                      {rule.statusCode === 308
                        ? "Permanent · 308"
                        : "Temporary · 307"}
                    </TableCell>
                    <TableCell
                      className="py-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Switch
                        checked={rule.enabled}
                        aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.sourcePath}`}
                        onCheckedChange={(enabled) =>
                          void setEnabled({
                            redirectId: rule._id,
                            enabled,
                          }).catch((error: unknown) =>
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Could not update redirect",
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell
                      className="py-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label={`Delete redirect ${rule.sourcePath}`}
                        className="grid size-8 place-items-center rounded-md text-black/25 opacity-0 hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                        onClick={() => setDeletingRule(rule)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {rulesStatus === "CanLoadMore" || rulesStatus === "LoadingMore" ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={rulesStatus === "LoadingMore"}
              onClick={() => loadMore(50)}
              className="h-9 rounded-sm px-4 text-xs shadow-none"
            >
              {rulesStatus === "LoadingMore" ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) resetForm();
        }}
      >
        <DialogContent className="max-w-xl rounded-sm p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="text-base">
              {editing ? "Edit redirect" : "New redirect"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Redirects run before the destination page is rendered.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 px-5 py-4">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium">Hostname scope</label>
              <Select value={hostname} onValueChange={setHostname}>
                <SelectTrigger className="h-10 rounded-sm shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_HOSTS}>All site domains</SelectItem>
                  {domains
                    .filter((domain) => domain.verified && !domain.redirectTo)
                    .map((domain) => (
                      <SelectItem key={domain.hostname} value={domain.hostname}>
                        {domain.hostname}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium">Match</label>
                <Select
                  value={matchType}
                  onValueChange={(value) =>
                    setMatchType(value as "exact" | "prefix")
                  }
                >
                  <SelectTrigger className="h-10 rounded-sm shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">One URL · exact</SelectItem>
                    <SelectItem value="prefix">
                      Whole section · prefix
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium">From</label>
                <Input
                  dir="ltr"
                  value={sourcePath}
                  onChange={(event) =>
                    setSourcePath(event.target.value.replace(/\/\*$/, ""))
                  }
                  placeholder={matchType === "prefix" ? "/blog" : "/old-page"}
                  className="h-10 rounded-sm font-mono text-xs shadow-none"
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium">To</label>
                <Input
                  dir="ltr"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder={
                    matchType === "prefix" ? "/journal/:splat" : "/new-page"
                  }
                  className="h-10 rounded-sm font-mono text-xs shadow-none"
                />
                {matchType === "prefix" ? (
                  <p className="text-[10px] text-black/40">
                    Use :splat where the remaining path belongs. Without it, the
                    remaining path is appended.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium">Redirect type</label>
                <Select
                  value={String(statusCode)}
                  onValueChange={(value) =>
                    setStatusCode(Number(value) as 307 | 308)
                  }
                >
                  <SelectTrigger className="h-10 rounded-sm shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="308">Permanent · 308</SelectItem>
                    <SelectItem value="307">Temporary · 307</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex min-h-10 items-center justify-between gap-3 self-end border border-border px-3 py-2 text-xs">
                <span>
                  <span className="block font-medium">
                    Keep query parameters
                  </span>
                  <span className="mt-0.5 block text-[10px] text-black/40">
                    Carry ?campaign=… to the destination.
                  </span>
                </span>
                <Switch
                  checked={preserveQuery}
                  onCheckedChange={setPreserveQuery}
                />
              </label>
            </div>
          </div>
          <DialogFooter className="border-t border-border px-5 py-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={saving || !sourcePath.trim() || !destination.trim()}
              onClick={() => void save()}
              className="bg-black text-white hover:bg-black/80"
            >
              {saving
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Create redirect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingRule)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !removingRule) setDeletingRule(null);
        }}
      >
        <AlertDialogContent className="max-w-md rounded-sm shadow-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              Remove redirect?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Requests to{" "}
              <span className="font-mono text-foreground">
                {deletingRule?.sourcePath}
              </span>{" "}
              will stop forwarding immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingRule} className="rounded-sm">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={removingRule}
              onClick={(event) => {
                event.preventDefault();
                void confirmRemoveRule();
              }}
              className="rounded-sm bg-red-600 text-white hover:bg-red-700"
            >
              {removingRule ? "Removing…" : "Remove redirect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={domainOpen}
        onOpenChange={(nextOpen) => {
          setDomainOpen(nextOpen);
          if (!nextOpen) setEditingDomain(null);
        }}
      >
        <DialogContent className="max-w-md rounded-sm p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="text-base">Domain traffic</DialogTitle>
            <DialogDescription className="text-xs">
              {editingDomain?.hostname}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 px-5 py-4">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium">Behavior</label>
              <Select value={domainTarget} onValueChange={setDomainTarget}>
                <SelectTrigger className="h-10 rounded-sm shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__serve__">
                    Serve this site directly
                  </SelectItem>
                  {verifiedDomains
                    .filter(
                      (candidate) =>
                        candidate._id !== editingDomain?._id &&
                        !candidate.redirectTo,
                    )
                    .map((candidate) => (
                      <SelectItem
                        key={candidate._id}
                        value={candidate.hostname}
                      >
                        Redirect to {candidate.hostname}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {domainTarget !== "__serve__" ? (
              <div className="grid gap-1.5">
                <label className="text-xs font-medium">Redirect type</label>
                <Select
                  value={String(domainStatusCode)}
                  onValueChange={(value) =>
                    setDomainStatusCode(Number(value) as 301 | 302 | 307 | 308)
                  }
                >
                  <SelectTrigger className="h-10 rounded-sm shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="308">Permanent · 308</SelectItem>
                    <SelectItem value="301">Permanent · 301</SelectItem>
                    <SelectItem value="307">Temporary · 307</SelectItem>
                    <SelectItem value="302">Temporary · 302</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter className="border-t border-border px-5 py-4">
            <Button variant="ghost" onClick={() => setDomainOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={savingDomain}
              onClick={() => void saveDomainRedirect()}
              className="bg-black text-white hover:bg-black/80"
            >
              {savingDomain ? "Saving…" : "Save traffic rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
