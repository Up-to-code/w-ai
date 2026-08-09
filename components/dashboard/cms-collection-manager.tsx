"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ArrowLeft, Copy, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useOrg } from "@/components/dashboard/org-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FieldType = "text" | "richText" | "number" | "boolean" | "date" | "image" | "file" | "select" | "slug" | "reference" | "multiReference";
type SchemaField = {
  id?: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  localizable?: boolean;
  indexable?: boolean;
  options?: string[];
  validation?: unknown;
  defaultValue?: unknown;
  referenceCollectionId?: Id<"cmsCollections">;
};

export function CmsCollectionManager({ collectionId }: { collectionId: Id<"cmsCollections"> }) {
  const params = useParams<{ locale?: string }>();
  const { orgId, orgSlug } = useOrg();
  const collections = useQuery(api.cms.listCollections, { orgId });
  const pages = useQuery(api.pages.listPages, { orgId });
  const languages = useQuery(api.languages.list, { orgId });
  const collection = collections?.find((item) => item._id === collectionId);
  const { results, status, loadMore } = usePaginatedQuery(
    api.cms.listEntries,
    { orgId, collectionId },
    { initialNumItems: 30 },
  );
  const createEntry = useMutation(api.cms.createEntry);
  const updateEntry = useMutation(api.cms.updateEntry);
  const duplicateEntry = useMutation(api.cms.duplicateEntry);
  const publishEntry = useMutation(api.cms.publishEntry);
  const unpublishEntry = useMutation(api.cms.unpublishEntry);
  const deleteEntry = useMutation(api.cms.deleteEntry);
  const updateCollection = useMutation(api.cms.updateCollection);

  const [search, setSearch] = useState("");
  const [locale, setLocale] = useState("en");
  const [entryOpen, setEntryOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"cmsEntries"> | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [detailPageSlug, setDetailPageSlug] = useState("");

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return results.filter((entry) => !needle || JSON.stringify(entry.values).toLowerCase().includes(needle));
  }, [results, search]);

  function openNew() {
    setEditingId(null);
    setValues(Object.fromEntries((collection?.fields ?? []).map((field) => [field.key, field.localizable ? { [locale]: field.defaultValue ?? "" } : field.defaultValue ?? ""])));
    setEntryOpen(true);
  }

  function openEdit(entry: (typeof results)[number]) {
    setEditingId(entry._id);
    setValues(entry.values as Record<string, unknown>);
    setEntryOpen(true);
  }

  function valueFor(field: SchemaField) {
    const value = values[field.key];
    if (field.localizable && value && typeof value === "object" && !Array.isArray(value)) return (value as Record<string, unknown>)[locale] ?? "";
    return value ?? "";
  }

  function setFieldValue(field: SchemaField, value: unknown) {
    setValues((current) => {
      if (!field.localizable) return { ...current, [field.key]: value };
      const previous = current[field.key] && typeof current[field.key] === "object" ? current[field.key] as Record<string, unknown> : {};
      return { ...current, [field.key]: { ...previous, [locale]: value } };
    });
  }

  async function saveItem() {
    try {
      if (editingId) await updateEntry({ orgId, entryId: editingId, values });
      else await createEntry({ orgId, collectionId, values });
      setEntryOpen(false);
      toast.success("Entry saved");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save entry"); }
  }

  async function saveSchema() {
    if (!collection) return;
    try {
      await updateCollection({
        orgId,
        collectionId,
        name: collection.name,
        fields,
        detailPageSlug:
          (detailPageSlug || collection.detailPageSlug) === "__none"
            ? undefined
            : detailPageSlug || collection.detailPageSlug,
      });
      setSchemaOpen(false);
      toast.success("Schema saved");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save schema"); }
  }

  if (!collection) return <main className="p-10 text-sm text-muted-foreground">Loading collection…</main>;

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-white px-6 py-8 text-[#171717] md:px-10">
      <div className="mx-auto max-w-[1180px]">
        <header className="flex items-start justify-between gap-4">
          <div>
            <a href={`/${params.locale ?? "en"}/dashboard/${orgSlug}/collections`} className="mb-3 inline-flex items-center gap-1 text-xs text-black/45"><ArrowLeft className="size-3" /> Collections</a>
            <h1 className="text-xl font-semibold tracking-[-.025em]">{collection.name}</h1>
            <p className="mt-1 text-xs text-black/45">{collection.fields.length} fields · Draft and published snapshots</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setFields(collection.fields as SchemaField[]); setSchemaOpen(true); }} className="rounded-lg shadow-none">Edit schema</Button>
            <Button onClick={openNew} className="rounded-lg bg-black text-white shadow-none hover:bg-black/80"><Plus className="me-1.5 size-4" />New item</Button>
          </div>
        </header>
        <div className="mt-7 flex gap-2">
          <label className="relative flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-black/30"/><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items" className="h-10 rounded-xl border-black/10 ps-9 shadow-none"/></label>
          <Select value={locale} onValueChange={setLocale}><SelectTrigger className="h-10 w-44 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{(languages ?? []).filter((item) => item.enabled).map((item) => <SelectItem key={item.code} value={item.code}>{item.nativeName ?? item.name}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="mt-3 grid gap-2 rounded-xl border border-black/10 p-4 md:grid-cols-[1fr_280px] md:items-center">
          <div>
            <p className="text-xs font-medium">Dynamic detail page</p>
            <p className="mt-1 text-[11px] text-black/40">
              Published items resolve at /{collection.slug}/item-slug using this Puck page as the template.
            </p>
          </div>
          <Select
            value={detailPageSlug || collection.detailPageSlug || "__none"}
            onValueChange={async (value) => {
              setDetailPageSlug(value);
              try {
                await updateCollection({
                  orgId,
                  collectionId,
                  name: collection.name,
                  fields: collection.fields,
                  detailPageSlug: value === "__none" ? undefined : value,
                });
                toast.success("Detail template updated");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not update template");
              }
            }}
          >
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Choose a page" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No detail route</SelectItem>
              {(pages ?? []).map((page) => (
                <SelectItem key={page.slug} value={page.slug}>
                  {page.title.en ?? Object.values(page.title)[0] ?? page.slug} · /{page.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-black/10">
          <div className="grid grid-cols-[1fr_120px_210px] bg-black/[.025] px-4 py-2.5 text-[10px] text-black/40"><span>Item</span><span>Status</span><span>Actions</span></div>
          {visible.map((entry) => {
            const first = collection.fields[0];
            const raw = first ? (entry.values as Record<string, unknown>)[first.key] : entry._id;
            const label = first?.localizable && raw && typeof raw === "object" ? String((raw as Record<string, unknown>)[locale] ?? Object.values(raw as object)[0] ?? "Untitled") : String(raw || "Untitled");
            return <article key={entry._id} className="grid grid-cols-[1fr_120px_210px] items-center border-t border-black/10 px-4 py-3"><button type="button" onClick={() => openEdit(entry)} className="text-start"><span className="text-sm font-medium">{label}</span><span className="block text-[11px] text-black/35">Updated {new Date(entry.updatedAt).toLocaleDateString()}</span></button><span className="text-xs capitalize">● {entry.status}</span><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => void (entry.status === "published" ? unpublishEntry({ orgId, entryId: entry._id }) : publishEntry({ orgId, entryId: entry._id }))}>{entry.status === "published" ? "Unpublish" : "Publish"}</Button><Button size="icon" variant="ghost" onClick={() => void duplicateEntry({ orgId, entryId: entry._id })}><Copy className="size-3.5" /></Button><Button size="icon" variant="ghost" onClick={() => void deleteEntry({ orgId, entryId: entry._id })}><Trash2 className="size-3.5" /></Button></div></article>;
          })}
          {visible.length === 0 ? <div className="py-16 text-center text-sm text-black/40">No items found.</div> : null}
        </div>
        {status === "CanLoadMore" ? <Button variant="outline" onClick={() => loadMore(30)} className="mt-4">Load more</Button> : null}
      </div>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}><DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>{editingId ? "Edit item" : "New item"}</DialogTitle></DialogHeader><div className="space-y-4">{collection.fields.map((field) => <label key={field.id ?? field.key} className="block"><span className="mb-1.5 flex items-center justify-between text-xs font-medium"><span>{field.label}{field.required ? " *" : ""}</span>{field.localizable ? <span className="text-black/35">{locale}</span> : null}</span>{field.type === "boolean" ? <Checkbox checked={Boolean(valueFor(field))} onCheckedChange={(checked) => setFieldValue(field, checked === true)} /> : <Input type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={String(valueFor(field))} onChange={(event) => setFieldValue(field, field.type === "number" ? Number(event.target.value) : event.target.value)} />}</label>)}</div><DialogFooter><Button variant="ghost" onClick={() => setEntryOpen(false)}>Cancel</Button><Button onClick={() => void saveItem()}><Save className="me-1.5 size-4" />Save</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={schemaOpen} onOpenChange={setSchemaOpen}><DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Collection schema</DialogTitle></DialogHeader><div className="space-y-3">{fields.map((field, index) => <div key={field.id ?? index} className="grid grid-cols-[1fr_1fr_150px_auto] gap-2 border border-border p-3"><Input value={field.label} onChange={(event) => setFields((current) => current.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} placeholder="Label"/><Input value={field.key} onChange={(event) => setFields((current) => current.map((item, i) => i === index ? { ...item, key: event.target.value } : item))} placeholder="Key"/><Select value={field.type} onValueChange={(value) => setFields((current) => current.map((item, i) => i === index ? { ...item, type: value as FieldType } : item))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["text","richText","number","boolean","date","image","file","select","slug","reference","multiReference"].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><Button size="icon" variant="ghost" onClick={() => setFields((current) => current.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button><label className="flex items-center gap-2 text-xs"><Checkbox checked={field.required} onCheckedChange={(checked) => setFields((current) => current.map((item, i) => i === index ? { ...item, required: checked === true } : item))}/>Required</label><label className="flex items-center gap-2 text-xs"><Checkbox checked={field.localizable} onCheckedChange={(checked) => setFields((current) => current.map((item, i) => i === index ? { ...item, localizable: checked === true } : item))}/>Localizable</label><label className="flex items-center gap-2 text-xs"><Checkbox checked={field.indexable} onCheckedChange={(checked) => setFields((current) => current.map((item, i) => i === index ? { ...item, indexable: checked === true } : item))}/>Indexable</label></div>)}</div><DialogFooter className="justify-between"><Button variant="outline" onClick={() => setFields((current) => [...current, { key: `field_${current.length + 1}`, label: "New field", type: "text", required: false, localizable: false, indexable: false }])}><Plus className="me-1.5 size-4"/>Add field</Button><Button onClick={() => void saveSchema()}>Save schema</Button></DialogFooter></DialogContent></Dialog>
    </main>
  );
}
