"use client";

import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link, useRouter } from "@/i18n/routing";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronRight,
  ChevronsUpDown,
  ExternalLink,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  Globe2,
  Grid2X2,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/brand/brand-mark";
import { ProjectGridSkeleton } from "@/components/dashboard/loading-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type View = "grid" | "list";
type SortOrder = "name-asc" | "name-desc" | "newest" | "oldest";

type FolderRecord = {
  _id: Id<"projectFolders">;
  name: string;
  projectCount: number;
  createdAt: number;
  updatedAt: number;
};

type SiteRecord = {
  _id: Id<"organizations">;
  name: string;
  slug: string;
  plan?: string;
  role: string;
  status?: string;
  createdAt: number;
};

export function WorkspaceDashboard({
  locale,
  folderId,
}: {
  locale: "ar" | "en";
  folderId?: string;
}) {
  const sitesQuery = useQuery(api.organizations.listMine, {});
  const foldersQuery = useQuery(api.projectFolders.listMine, {});
  const userQuery = useQuery(api.users.me, {});
  const createFolder = useMutation(api.projectFolders.create);
  const renameFolder = useMutation(api.projectFolders.rename);
  const removeFolder = useMutation(api.projectFolders.remove);
  const moveProject = useMutation(api.projectFolders.moveProject);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("grid");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [folderDialog, setFolderDialog] = useState<
    { mode: "create" } | { mode: "rename"; folder: FolderRecord } | null
  >(null);
  const [folderName, setFolderName] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);

  const copy = locale === "ar" ? AR_COPY : EN_COPY;
  const folders = foldersQuery?.folders ?? [];
  const currentFolder = folders.find((folder) => folder._id === folderId);
  const assignments = useMemo(
    () =>
      new Map(
        (foldersQuery?.assignments ?? []).map((assignment) => [
          assignment.orgId,
          assignment.folderId,
        ]),
      ),
    [foldersQuery?.assignments],
  );

  const sites = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...(sitesQuery ?? [])]
      .filter((site) => {
        const matchesFolder = folderId
          ? assignments.get(site._id) === folderId
          : true;
        return (
          matchesFolder &&
          (!needle ||
            site.name.toLowerCase().includes(needle) ||
            site.slug.toLowerCase().includes(needle))
        );
      })
      .sort((a, b) => {
        if (sortOrder === "name-asc") return a.name.localeCompare(b.name);
        if (sortOrder === "name-desc") return b.name.localeCompare(a.name);
        if (sortOrder === "oldest") return a.createdAt - b.createdAt;
        return b.createdAt - a.createdAt;
      });
  }, [assignments, folderId, query, sitesQuery, sortOrder]);

  const visibleFolders = useMemo(() => {
    if (folderId) return [];
    const needle = query.trim().toLowerCase();
    return folders
      .filter((folder) => !needle || folder.name.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (sortOrder === "name-asc") return a.name.localeCompare(b.name);
        if (sortOrder === "name-desc") return b.name.localeCompare(a.name);
        if (sortOrder === "oldest") return a.createdAt - b.createdAt;
        return b.createdAt - a.createdAt;
      });
  }, [folderId, folders, query, sortOrder]);

  const userName =
    userQuery?.user.name || userQuery?.user.email || copy.account;

  async function saveFolder() {
    const name = folderName.trim();
    if (!name || !folderDialog) return;
    setSavingFolder(true);
    try {
      if (folderDialog.mode === "create") {
        await createFolder({ name });
        toast.success(copy.folderCreated);
      } else {
        await renameFolder({ folderId: folderDialog.folder._id, name });
        toast.success(copy.folderRenamed);
      }
      setFolderDialog(null);
      setFolderName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.failed);
    } finally {
      setSavingFolder(false);
    }
  }

  async function deleteFolder(folder: FolderRecord) {
    try {
      await removeFolder({ folderId: folder._id });
      if (folderId === folder._id) router.replace("/dashboard");
      toast.success(copy.folderDeleted);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.failed);
    }
  }

  async function move(
    siteId: Id<"organizations">,
    nextFolderId: Id<"projectFolders"> | null,
  ) {
    try {
      await moveProject({ orgId: siteId, folderId: nextFolderId });
      toast.success(copy.projectMoved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.failed);
    }
  }

  const loading = sitesQuery === undefined || foldersQuery === undefined;

  return (
    <div className="flex min-h-svh bg-white text-[#171717]">
      <WorkspaceSidebar
        copy={copy}
        activeSection="projects"
        folders={folders}
        activeFolderId={folderId}
        userName={userName}
        onAddFolder={() => {
          setFolderName("");
          setFolderDialog({ mode: "create" });
        }}
        onRenameFolder={(folder) => {
          setFolderName(folder.name);
          setFolderDialog({ mode: "rename", folder });
        }}
        onDeleteFolder={deleteFolder}
      />

      <main className="min-w-0 flex-1 px-5 py-7 md:px-8 lg:px-12">
        <div className="mx-auto max-w-[1240px]">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              {currentFolder ? (
                <Link
                  href="/dashboard"
                  className="mb-2 inline-flex items-center gap-1.5 text-xs text-black/45 transition-colors hover:text-black"
                >
                  <ArrowLeft className="size-3.5 rtl:rotate-180" />
                  {copy.allProjects}
                </Link>
              ) : null}
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-semibold tracking-[-0.025em]">
                  {currentFolder?.name ?? copy.allProjects}
                </h1>
                <span className="rounded bg-[#f1efff] px-1.5 py-0.5 text-[10px] font-medium text-[#6757d7]">
                  {copy.starter}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-9 rounded-md bg-white px-3 shadow-none"
                onClick={() => {
                  setFolderName("");
                  setFolderDialog({ mode: "create" });
                }}
              >
                <FolderPlus className="me-1.5 size-4" />
                {copy.newFolder}
              </Button>
              <Button
                asChild
                className="h-9 rounded-md bg-black px-4 shadow-none hover:bg-black/80"
              >
                <Link href="/onboarding">
                  <Plus className="me-1.5 size-4" /> {copy.newProject}
                </Link>
              </Button>
            </div>
          </header>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <label className="relative min-w-60 flex-1">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-black/35" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                className="h-10 rounded-md border-black/15 bg-white pe-3 ps-9 shadow-none focus-visible:border-black/35"
              />
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="h-10 rounded-md border-black/15 bg-white shadow-none">
                  <ArrowUpDown className="me-1.5 size-4" /> {copy.sort}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-xl border-black/10 shadow-lg">
                {(["newest", "oldest", "name-asc", "name-desc"] as SortOrder[]).map((order) => (
                  <DropdownMenuItem key={order} onSelect={() => setSortOrder(order)} className={cn(sortOrder === order && "font-semibold")}>
                    {copy[order]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex h-10 items-center rounded-md border border-black/15 bg-white p-1">
              <ViewButton
                active={view === "grid"}
                label={copy.grid}
                onClick={() => setView("grid")}
              >
                <Grid2X2 className="size-4" />
              </ViewButton>
              <ViewButton
                active={view === "list"}
                label={copy.list}
                onClick={() => setView("list")}
              >
                <List className="size-4" />
              </ViewButton>
            </div>
          </div>

          <section className="mt-4">
            {loading ? (
              <ProjectGridSkeleton />
            ) : sites.length === 0 && (folderId || query) ? (
              <EmptyState copy={copy} folder={currentFolder} />
            ) : view === "grid" ? (
              <ProjectGrid
                sites={sites}
                visibleFolders={visibleFolders}
                folders={folders}
                assignments={assignments}
                copy={copy}
                onMove={move}
              />
            ) : (
              <ProjectTable
                sites={sites}
                visibleFolders={visibleFolders}
                folders={folders}
                assignments={assignments}
                copy={copy}
                onMove={move}
              />
            )}
          </section>
        </div>
      </main>

      <Dialog
        open={folderDialog !== null}
        onOpenChange={(open) => !open && setFolderDialog(null)}
      >
        <DialogContent className="max-w-sm rounded-2xl border-black/10 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,.14)]">
          <DialogHeader>
            <DialogTitle>
              {folderDialog?.mode === "rename"
                ? copy.renameFolder
                : copy.createFolder}
            </DialogTitle>
            <DialogDescription>{copy.folderDescription}</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void saveFolder()}
            placeholder={copy.folderPlaceholder}
            maxLength={60}
          />
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button variant="ghost" className="rounded-lg" onClick={() => setFolderDialog(null)}>
              {copy.cancel}
            </Button>
            <Button
              className="rounded-lg bg-black text-white shadow-none hover:bg-black/80"
              disabled={!folderName.trim() || savingFolder}
              onClick={() => void saveFolder()}
            >
              {savingFolder ? copy.saving : copy.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function WorkspaceSidebar({
  copy,
  activeSection = "projects",
  folders,
  activeFolderId,
  userName,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  copy: typeof EN_COPY;
  activeSection?: "projects" | "domains";
  folders: FolderRecord[];
  activeFolderId?: string;
  userName: string;
  onAddFolder?: () => void;
  onRenameFolder?: (folder: FolderRecord) => void;
  onDeleteFolder?: (folder: FolderRecord) => void;
}) {
  return (
    <aside className="hidden w-[208px] shrink-0 flex-col border-e border-black/10 bg-[#fbfbfa] md:flex">
      <div className="flex h-14 items-center border-b border-black/10 px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 text-sm font-semibold"
        >
          <span className="grid size-7 place-items-center rounded-md bg-black text-white">
            <BrandMark className="h-4 w-6" />
          </span>
          W-AI
        </Link>
      </div>
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2.5 text-left text-xs font-medium transition-colors hover:border-black/20"
            >
              <span className="min-w-0 flex-1 truncate">
                {userName}&apos;s Workspace
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-black/35" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[210px] rounded-lg border-black/10 shadow-lg"
          >
            <DropdownMenuItem className="font-medium">
              {userName}&apos;s Workspace
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/onboarding">
                <Plus className="me-2 size-3.5" />
                {copy.newProject}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <nav className="px-2">
        <SidebarLink href="/dashboard" active={activeSection === "projects" && !activeFolderId} icon={Grid2X2}>
          {copy.allProjects}
        </SidebarLink>
        <SidebarLink href="/dashboard/domains" active={activeSection === "domains"} icon={Globe2}>
          {copy.domains}
        </SidebarLink>
        <div className="my-3 border-t border-black/10" />
        <div className="mb-1 flex items-center justify-between px-2">
          <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/35">
            {copy.folders}
          </span>
          {onAddFolder ? <button
            type="button"
            onClick={onAddFolder}
            aria-label={copy.newFolder}
            className="grid size-6 place-items-center rounded text-black/40 hover:bg-black/5 hover:text-black"
          >
            <Plus className="size-3.5" />
          </button> : null}
        </div>
        <div className="space-y-0.5">
          {folders.map((folder) => (
            <div key={folder._id} className="group flex items-center">
              <Link
                href={{
                  pathname: "/dashboard/folders/[folderId]",
                  params: { folderId: folder._id },
                }}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors",
                  activeFolderId === folder._id
                    ? "bg-black/[0.06] font-medium"
                    : "text-black/55 hover:bg-black/[0.035] hover:text-black",
                )}
              >
                <Folder className="size-3.5 shrink-0" />
                <span className="truncate">{folder.name}</span>
                <span className="ms-auto text-[10px] text-black/35">
                  {folder.projectCount}
                </span>
              </Link>
              {onRenameFolder && onDeleteFolder ? <FolderActions
                folder={folder}
                copy={copy}
                onRename={onRenameFolder}
                onDelete={onDeleteFolder}
              /> : null}
            </div>
          ))}
        </div>
      </nav>
      <div className="mt-auto border-t border-black/10 p-2.5">
        <div className="flex items-center gap-2 rounded-md px-1.5 py-1.5">
          <Avatar className="size-7 border border-black/10">
            <AvatarFallback className="bg-black text-[9px] font-semibold text-white">
              {userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0"><p className="truncate text-[11px] font-medium">{userName}</p><p className="text-[9px] text-black/35">Workspace member</p></div>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: "/dashboard" | "/dashboard/domains";
  active: boolean;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors",
        active
          ? "bg-black/[0.06] font-medium"
          : "text-black/55 hover:bg-black/[0.035] hover:text-black",
      )}
    >
      <Icon className="size-4" />
      {children}
    </Link>
  );
}

function FolderActions({
  folder,
  copy,
  onRename,
  onDelete,
}: {
  folder: FolderRecord;
  copy: typeof EN_COPY;
  onRename: (folder: FolderRecord) => void;
  onDelete: (folder: FolderRecord) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${folder.name} ${copy.actions}`}
          className="me-1 grid size-7 place-items-center rounded opacity-0 hover:bg-black/5 group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-40 rounded-lg border-black/10 shadow-lg"
      >
        <DropdownMenuItem onSelect={() => onRename(folder)}>
          {copy.renameFolder}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600"
          onSelect={() => onDelete(folder)}
        >
          <Trash2 className="me-2 size-3.5" />
          {copy.deleteFolder}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectGrid({
  sites,
  visibleFolders,
  folders,
  assignments,
  copy,
  onMove,
}: ProjectListProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {visibleFolders.map((folder) => (
        <Link key={folder._id} href={{ pathname: "/dashboard/folders/[folderId]", params: { folderId: folder._id } }} className="group flex min-h-48 flex-col justify-between rounded-xl border border-black/10 bg-[#fafafa] p-5 transition-colors hover:border-black/25 hover:bg-[#f6f6f5]">
          <Folder className="size-8 stroke-[1.35] text-black/55" />
          <div><h2 className="text-sm font-semibold">{folder.name}</h2><p className="mt-1 text-xs text-black/40">{folder.projectCount} {copy.projects}</p></div>
        </Link>
      ))}
      {sites.map((site) => (
        <article
          key={site._id}
          className="group overflow-hidden rounded-lg border border-black/10 bg-white transition-colors hover:border-black/25"
        >
          <Link
            href={{
              pathname: "/dashboard/[org]/pages",
              params: { org: site.slug },
            }}
            className="block bg-[#f2f2f0] p-2.5"
          >
            <SitePreview />
          </Link>
          <div className="flex items-start gap-3 border-t border-black/10 p-3.5">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xs font-semibold">{site.name}</h2>
              <p className="mt-1 truncate text-[10px] text-black/40" dir="ltr">
                {site.slug}.localhost
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-black/45">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {site.status === "suspended" ? copy.suspended : copy.active}
              </div>
            </div>
            <ProjectActions
              site={site}
              folders={folders}
              currentFolderId={assignments.get(site._id)}
              copy={copy}
              onMove={onMove}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

type ProjectListProps = {
  sites: SiteRecord[];
  visibleFolders: FolderRecord[];
  folders: FolderRecord[];
  assignments: Map<Id<"organizations">, Id<"projectFolders">>;
  copy: typeof EN_COPY;
  onMove: (
    siteId: Id<"organizations">,
    folderId: Id<"projectFolders"> | null,
  ) => Promise<void>;
};

function ProjectTable({
  sites,
  visibleFolders,
  folders,
  assignments,
  copy,
  onMove,
}: ProjectListProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 bg-white">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs rtl:text-right">
        <thead className="bg-[#f7f7f6] text-[10px] font-medium text-black/45">
          <tr>
            <th className="px-4 py-2.5">{copy.name}</th>
            <th className="px-4 py-2.5">{copy.type}</th>
            <th className="px-4 py-2.5">{copy.created}</th>
            <th className="px-4 py-2.5">{copy.plan}</th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {visibleFolders.map((folder) => (
            <tr key={folder._id} className="border-t border-black/10 hover:bg-black/[0.018]">
              <td className="px-4 py-3"><Link href={{ pathname: "/dashboard/folders/[folderId]", params: { folderId: folder._id } }} className="inline-flex items-center gap-2 font-medium hover:underline"><Folder className="size-4" />{folder.name}</Link><p className="mt-0.5 text-[10px] text-black/40">{folder.projectCount} {copy.projects}</p></td>
              <td className="px-4 py-3 text-black/50">{copy.folder}</td>
              <td className="px-4 py-3 text-black/50">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(folder.createdAt)}</td>
              <td className="px-4 py-3 text-black/30">—</td><td />
            </tr>
          ))}
          {sites.map((site) => (
            <tr
              key={site._id}
              className="border-t border-black/10 transition-colors hover:bg-black/[0.018]"
            >
              <td className="px-4 py-3">
                <Link
                  href={{
                    pathname: "/dashboard/[org]/pages",
                    params: { org: site.slug },
                  }}
                  className="font-medium hover:underline"
                >
                  {site.name}
                </Link>
                <p className="mt-0.5 text-[10px] text-black/40" dir="ltr">
                  {site.slug}.localhost
                </p>
              </td>
              <td className="px-4 py-3 text-black/50">
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="size-3.5" />
                  {copy.site}
                </span>
              </td>
              <td className="px-4 py-3 text-black/50">
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                }).format(site.createdAt)}
              </td>
              <td className="px-4 py-3">
                <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] capitalize">
                  {site.plan ?? "free"}
                </span>
              </td>
              <td className="px-2 py-3">
                <ProjectActions
                  site={site}
                  folders={folders}
                  currentFolderId={assignments.get(site._id)}
                  copy={copy}
                  onMove={onMove}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectActions({
  site,
  folders,
  currentFolderId,
  copy,
  onMove,
}: {
  site: SiteRecord;
  folders: FolderRecord[];
  currentFolderId?: Id<"projectFolders">;
  copy: typeof EN_COPY;
  onMove: ProjectListProps["onMove"];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${site.name} ${copy.actions}`}
          className="grid size-7 shrink-0 place-items-center rounded-md text-black/40 transition-colors hover:bg-black/5 hover:text-black"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-lg border-black/10 shadow-lg"
      >
        <DropdownMenuItem asChild>
          <Link
            href={{
              pathname: "/dashboard/[org]/site-settings",
              params: { org: site.slug },
            }}
          >
            <Settings className="me-2 size-3.5" />
            {copy.settings}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={{
              pathname: "/dashboard/[org]/pages",
              params: { org: site.slug },
            }}
          >
            <FileText className="me-2 size-3.5" />
            {copy.pages}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FolderInput className="me-2 size-3.5" />
            {copy.moveToFolder}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44 rounded-lg border-black/10 shadow-lg">
            <DropdownMenuItem
              disabled={!currentFolderId}
              onSelect={() => void onMove(site._id, null)}
            >
              {copy.allProjects}
            </DropdownMenuItem>
            {folders.map((folder) => (
              <DropdownMenuItem
                key={folder._id}
                disabled={folder._id === currentFolderId}
                onSelect={() => void onMove(site._id, folder._id)}
              >
                <Folder className="me-2 size-3.5" />
                {folder.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href={`http://${site.slug}.localhost:3000`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="me-2 size-3.5" />
            {copy.viewSite}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded transition-colors",
        active
          ? "bg-black text-white"
          : "text-black/35 hover:bg-black/5 hover:text-black",
      )}
    >
      {children}
    </button>
  );
}

function SitePreview() {
  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-md border border-black/[0.06] bg-white">
      <div className="absolute inset-x-4 top-4 flex gap-2">
        <span className="h-1.5 w-12 rounded-full bg-black/15" />
        <span className="h-1.5 w-8 rounded-full bg-black/10" />
        <span className="ms-auto size-2 rounded-full bg-black" />
      </div>
      <div className="absolute inset-x-4 top-11 h-[40%] rounded bg-black/[0.055]" />
      <div className="absolute inset-x-4 bottom-4 grid h-[22%] grid-cols-3 gap-2">
        <span className="rounded bg-black/[0.055]" />
        <span className="rounded bg-black/[0.055]" />
        <span className="rounded bg-black/[0.055]" />
      </div>
    </div>
  );
}

function EmptyState({
  copy,
  folder,
}: {
  copy: typeof EN_COPY;
  folder?: FolderRecord;
}) {
  return (
    <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-black/15 bg-[#fbfbfa] text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-white">
          <Folder className="size-5 text-black/45" />
        </span>
        <h2 className="mt-4 text-sm font-semibold">
          {folder ? `${folder.name} ${copy.isEmpty}` : copy.noMatches}
        </h2>
        <p className="mt-1 text-xs text-black/45">{copy.emptyHint}</p>
      </div>
    </div>
  );
}

export const EN_COPY = {
  account: "Account",
  active: "Active",
  actions: "actions",
  allProjects: "All projects",
  cancel: "Cancel",
  createFolder: "Create folder",
  created: "Date created",
  deleteFolder: "Delete folder",
  domains: "Domains",
  emptyHint: "Move a project here or create a new site.",
  failed: "Something went wrong",
  folderCreated: "Folder created",
  folder: "Folder",
  projects: "projects",
  newest: "Newest first",
  oldest: "Oldest first",
  "name-asc": "Name A–Z",
  "name-desc": "Name Z–A",
  folderDeleted: "Folder deleted; its projects are still in All projects",
  folderDescription:
    "Folders keep projects organized without changing site access.",
  folderPlaceholder: "Folder name",
  folderRenamed: "Folder renamed",
  folders: "Folders",
  grid: "Grid view",
  isEmpty: "is empty",
  list: "List view",
  moveToFolder: "Move to folder",
  name: "Name",
  newFolder: "New folder",
  newProject: "New project",
  noMatches: "No matching projects",
  pages: "Open pages",
  plan: "Site plan",
  projectMoved: "Project moved",
  renameFolder: "Rename folder",
  save: "Save",
  saving: "Saving…",
  search: "Search all projects",
  settings: "Site settings",
  site: "Site",
  sites: "Sites",
  sort: "Sort",
  starter: "Starter Workspace",
  suspended: "Suspended",
  type: "Type",
  viewSite: "View published site",
};

export const AR_COPY: typeof EN_COPY = {
  account: "الحساب",
  active: "نشط",
  actions: "إجراءات",
  allProjects: "كل المشاريع",
  cancel: "إلغاء",
  createFolder: "إنشاء مجلد",
  created: "تاريخ الإنشاء",
  deleteFolder: "حذف المجلد",
  domains: "النطاقات",
  emptyHint: "انقل مشروعًا إلى هنا أو أنشئ موقعًا جديدًا.",
  failed: "حدث خطأ",
  folderCreated: "تم إنشاء المجلد",
  folder: "مجلد",
  projects: "مشاريع",
  newest: "الأحدث أولاً",
  oldest: "الأقدم أولاً",
  "name-asc": "الاسم أ–ي",
  "name-desc": "الاسم ي–أ",
  folderDeleted: "تم حذف المجلد وبقيت مشاريعه في كل المشاريع",
  folderDescription: "تنظم المجلدات المشاريع دون تغيير صلاحيات الموقع.",
  folderPlaceholder: "اسم المجلد",
  folderRenamed: "تمت إعادة تسمية المجلد",
  folders: "المجلدات",
  grid: "عرض شبكي",
  isEmpty: "فارغ",
  list: "عرض قائمة",
  moveToFolder: "نقل إلى مجلد",
  name: "الاسم",
  newFolder: "مجلد جديد",
  newProject: "مشروع جديد",
  noMatches: "لا توجد مشاريع مطابقة",
  pages: "فتح الصفحات",
  plan: "خطة الموقع",
  projectMoved: "تم نقل المشروع",
  renameFolder: "إعادة تسمية المجلد",
  save: "حفظ",
  saving: "جارٍ الحفظ…",
  search: "ابحث في كل المشاريع",
  settings: "إعدادات الموقع",
  site: "موقع",
  sites: "المواقع",
  sort: "ترتيب",
  starter: "مساحة Starter",
  suspended: "موقوف",
  type: "النوع",
  viewSite: "عرض الموقع المنشور",
};
