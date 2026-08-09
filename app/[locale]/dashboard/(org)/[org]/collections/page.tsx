"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Database, Filter, Plus, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useOrg } from "@/components/dashboard/org-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Preset = "blank" | "posts" | "products" | "team";

export default function CollectionsPage() {
  const { orgId, orgName } = useOrg();
  const collections = useQuery(api.cms.listCollections, { orgId });
  const createCollection = useMutation(api.cms.createCollection);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"updated" | "name">("updated");
  const [filter, setFilter] = useState<"all" | "simple" | "structured">("all");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<Preset>("blank");
  const visible = useMemo(() => [...(collections ?? [])].filter((item) => item.name.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || (filter === "simple" ? item.fields.length <= 2 : item.fields.length > 2))).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : b.updatedAt - a.updatedAt), [collections, filter, query, sort]);

  async function create() {
    try { await createCollection({ orgId, name: name.trim(), preset }); setName(""); setOpen(false); toast.success("Collection created"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not create collection"); }
  }

  return <main className="min-w-0 flex-1 overflow-y-auto bg-white px-6 py-8 text-[#171717] md:px-10">
    <div className="mx-auto max-w-[1180px]">
      <header className="flex items-start justify-between gap-4"><div><p className="text-[10px] text-black/35">{orgName}</p><h1 className="mt-1 text-xl font-semibold tracking-[-.025em]">CMS collections</h1><p className="mt-1 text-xs text-black/45">Structure reusable content and connect it to pages.</p></div><Button onClick={() => setOpen(true)} className="h-9 rounded-lg bg-black px-4 text-white shadow-none hover:bg-black/80"><Plus className="me-1.5 size-4"/>New collection</Button></header>
      <div className="mt-7 flex gap-2"><label className="relative flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-black/30"/><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search collections" className="h-10 rounded-xl border-black/10 ps-9 shadow-none"/></label><Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}><SelectTrigger className="h-10 w-36 rounded-xl border-black/10 shadow-none"><SlidersHorizontal className="size-3.5"/><SelectValue/></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="updated">Last updated</SelectItem><SelectItem value="name">Name</SelectItem></SelectContent></Select><Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}><SelectTrigger className="h-10 w-36 rounded-xl border-black/10 shadow-none"><Filter className="size-3.5"/><SelectValue/></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="all">All schemas</SelectItem><SelectItem value="simple">Simple</SelectItem><SelectItem value="structured">Structured</SelectItem></SelectContent></Select></div>
      <div className="mt-5 overflow-hidden rounded-xl border border-black/10"><div className="grid grid-cols-[1fr_120px_120px] bg-black/[.025] px-4 py-2.5 text-[10px] text-black/40"><span>Name</span><span>Fields</span><span>Updated</span></div>{visible.map((collection) => <article key={collection._id} className="grid grid-cols-[1fr_120px_120px] items-center border-t border-black/10 px-4 py-4 hover:bg-black/[.018]"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-black text-white"><Database className="size-4"/></span><div><h2 className="text-sm font-medium">{collection.name}</h2><p className="text-[11px] text-black/40">{collection.slug}</p></div></div><span className="text-xs text-black/50">{collection.fields.length}</span><span className="text-xs text-black/50">{new Intl.DateTimeFormat(undefined,{dateStyle:"medium"}).format(collection.updatedAt)}</span></article>)}{collections !== undefined && visible.length === 0 ? <div className="py-16 text-center text-sm text-black/40">No collections found.</div> : null}</div>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md rounded-2xl border-black/10 p-6 shadow-[0_24px_80px_rgba(0,0,0,.16)]"><DialogHeader><DialogTitle>New collection</DialogTitle></DialogHeader><div className="space-y-4"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Collection name" className="h-11 rounded-xl border-black/10 shadow-none"/><Select value={preset} onValueChange={(value) => setPreset(value as Preset)}><SelectTrigger className="h-11 rounded-xl border-black/10 shadow-none"><SelectValue/></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="blank">Blank</SelectItem><SelectItem value="posts">Posts</SelectItem><SelectItem value="products">Products</SelectItem><SelectItem value="team">Team</SelectItem></SelectContent></Select></div><DialogFooter><Button variant="ghost" onClick={() => setOpen(false)} className="rounded-lg">Cancel</Button><Button onClick={() => void create()} disabled={name.trim().length < 2} className="rounded-lg bg-black text-white shadow-none hover:bg-black/80">Create collection</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}
