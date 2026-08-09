"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { ChevronDown, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RecordType = "A" | "AAAA" | "CNAME" | "TXT" | "CAA";

type DnsRecord = {
  id: string;
  type: RecordType | "MX";
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  managed: boolean;
};

const RECORD_TYPES: RecordType[] = ["A", "AAAA", "CNAME", "TXT", "CAA"];

export function DomainDnsRecords({
  domainId,
  hostname,
}: {
  domainId: Id<"domains">;
  hostname: string;
}) {
  const listRecords = useAction(api.domains.listDnsRecords);
  const saveRecord = useAction(api.domains.saveDnsRecord);
  const deleteRecord = useAction(api.domains.deleteDnsRecord);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [type, setType] = useState<RecordType>("A");
  const [name, setName] = useState(hostname);
  const [content, setContent] = useState("");
  const [ttl, setTtl] = useState("300");

  async function refresh() {
    setLoading(true);
    try {
      setRecords((await listRecords({ domainId })) as DnsRecord[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load DNS records");
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && records.length === 0) void refresh();
  }

  async function createRecord() {
    const parsedTtl = Number(ttl);
    if (!name.trim() || !content.trim() || !Number.isFinite(parsedTtl)) return;
    setSaving(true);
    try {
      await saveRecord({
        domainId,
        type,
        name: name.trim(),
        content: content.trim(),
        ttl: parsedTtl,
      });
      setContent("");
      toast.success("DNS record created");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create DNS record");
    } finally {
      setSaving(false);
    }
  }

  async function remove(record: DnsRecord) {
    if (record.managed) return;
    try {
      await deleteRecord({ domainId, recordId: record.id });
      toast.success("DNS record deleted");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete DNS record");
    }
  }

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium hover:bg-black/[0.025]"
      >
        <span>DNS records</span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="space-y-4 border-t border-border p-4">
          <div className="grid gap-2 sm:grid-cols-[86px_minmax(0,1fr)_minmax(0,1.4fr)_80px_auto]">
            <Select value={type} onValueChange={(value) => setType(value as RecordType)}>
              <SelectTrigger className="h-9 rounded-sm bg-white text-xs shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>{RECORD_TYPES.map((recordType) => <SelectItem key={recordType} value={recordType}>{recordType}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={name} onChange={(event) => setName(event.target.value)} aria-label="DNS record name" placeholder={hostname} className="h-9 rounded-sm font-mono text-xs" />
            <Input value={content} onChange={(event) => setContent(event.target.value)} aria-label="DNS record value" placeholder="Record value" className="h-9 rounded-sm font-mono text-xs" />
            <Input inputMode="numeric" value={ttl} onChange={(event) => setTtl(event.target.value)} aria-label="DNS record TTL" className="h-9 rounded-sm font-mono text-xs" />
            <Button type="button" size="sm" onClick={createRecord} disabled={saving || !content.trim()} className="h-9 rounded-sm bg-black text-white hover:bg-black/80">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Add
            </Button>
          </div>
          <p className="text-[10px] leading-4 text-muted-foreground">Names must be {hostname} or a subdomain beneath it. Routing and verification records stay protected.</p>
          <div className="overflow-hidden border border-border">
            <div className="grid grid-cols-[58px_minmax(0,1fr)_minmax(0,1.25fr)_56px_34px] bg-black/[0.025] px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Type</span><span>Name</span><span>Value</span><span>TTL</span>
              <button type="button" onClick={() => void refresh()} aria-label="Refresh DNS records" className="grid place-items-center"><RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} /></button>
            </div>
            {loading && records.length === 0 ? <p className="px-3 py-6 text-center text-xs text-muted-foreground">Loading records…</p> : null}
            {!loading && records.length === 0 ? <p className="px-3 py-6 text-center text-xs text-muted-foreground">No records in this hostname yet.</p> : null}
            {records.map((record) => (
              <div key={record.id} className="grid grid-cols-[58px_minmax(0,1fr)_minmax(0,1.25fr)_56px_34px] items-center border-t border-border px-3 py-2 text-[11px]">
                <span className="font-medium">{record.type}</span>
                <code className="truncate pr-3">{record.name}</code>
                <code className="truncate pr-3">{record.content}</code>
                <span className="text-muted-foreground">{record.ttl === 1 ? "Auto" : record.ttl}</span>
                {record.managed ? <span title="Managed by W-AI" className="text-center text-[9px] font-medium text-muted-foreground">W</span> : <button type="button" onClick={() => void remove(record)} aria-label={`Delete ${record.name}`} className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="size-3" /></button>}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
