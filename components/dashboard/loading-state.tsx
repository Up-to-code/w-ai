import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingRegion({
  children,
  className,
  label = "Loading page",
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "relative overflow-hidden bg-white text-zinc-950",
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      <div className="absolute inset-x-0 top-0 z-20 h-px overflow-hidden bg-zinc-200">
        <div className="h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] bg-blue-600" />
      </div>
      {children}
    </div>
  );
}

function Block({ className }: { className?: string }) {
  return <Skeleton className={cn("rounded-md bg-zinc-200/75", className)} />;
}

function BrandBar({ compact = false }: { compact?: boolean }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 px-5">
      <div className="flex items-center gap-4">
        <Block className="size-6 rounded" />
        <Block className={compact ? "h-3 w-20" : "h-3 w-24"} />
      </div>
      <div className="flex items-center gap-2">
        <Block className="hidden h-8 w-20 sm:block" />
        <Block className="size-8 rounded-full" />
      </div>
    </header>
  );
}

function WorkspaceSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-zinc-200 p-3 md:block">
      <Block className="mb-4 h-10 w-full" />
      <div className="space-y-1">
        {["w-full", "w-3/4", "w-2/3"].map((width, index) => (
          <div key={index} className="flex h-9 items-center gap-3 px-2">
            <Block className="size-4" />
            <Block className={cn("h-2.5", width)} />
          </div>
        ))}
      </div>
      <div className="my-4 h-px bg-zinc-200" />
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex h-9 items-center gap-3 px-2">
            <Block className="size-4" />
            <Block className="h-2.5 w-24" />
          </div>
        ))}
      </div>
    </aside>
  );
}

export function ProjectGridSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading projects</span>
      {Array.from({ length: cards }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
        >
          <div className="aspect-[1.65] bg-zinc-100 p-3">
            <Block className="h-full w-full bg-zinc-200/60" />
          </div>
          <div className="space-y-2 p-4">
            <Block className="h-3 w-2/3" />
            <Block className="h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <LoadingRegion className="min-h-svh" label="Loading workspace">
      <BrandBar />
      <div className="flex min-h-[calc(100svh-3.5rem)]">
        <WorkspaceSidebar />
        <main className="min-w-0 flex-1 p-5 md:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <Block className="h-4 w-52" />
              <Block className="h-3 w-32" />
            </div>
            <div className="flex gap-2">
              <Block className="h-9 w-28" />
              <Block className="h-9 w-32 bg-blue-100" />
            </div>
          </div>
          <div className="mb-5 flex gap-2">
            <Block className="h-10 min-w-48 flex-1" />
            <Block className="h-10 w-28" />
          </div>
          <ProjectGridSkeleton />
        </main>
      </div>
    </LoadingRegion>
  );
}

export function PageSkeleton({
  cards = 3,
  className,
}: {
  cards?: number;
  className?: string;
}) {
  return (
    <LoadingRegion className={cn("min-h-full flex-1", className)}>
      <div className="border-b border-zinc-200 px-6 py-6 md:px-8">
        <Block className="mb-3 h-2.5 w-24" />
        <Block className="h-7 w-48" />
        <Block className="mt-3 h-3 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 p-6 md:grid-cols-2 md:p-8 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-zinc-200 bg-white p-5"
          >
            <div className="mb-8 flex items-center justify-between">
              <Block className="h-3 w-16" />
              <Block className="h-5 w-14" />
            </div>
            <Block className="mb-2 h-3 w-2/3" />
            <Block className="h-2.5 w-1/2" />
            <div className="mt-8 flex gap-2 border-t border-zinc-200 pt-4">
              <Block className="h-8 w-16" />
              <Block className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function FormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <LoadingRegion
      className="min-h-full flex-1 p-6 md:p-8"
      label="Loading form"
    >
      <div className="mb-8 border-b border-zinc-200 pb-6">
        <Block className="mb-3 h-2.5 w-20" />
        <Block className="h-7 w-40" />
        <Block className="mt-3 h-3 w-72 max-w-full" />
      </div>
      <div className="max-w-2xl space-y-5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Block className="h-2.5 w-24" />
            <Block className="h-10 w-full" />
          </div>
        ))}
        <Block className="mt-4 h-10 w-32 bg-blue-100" />
      </div>
    </LoadingRegion>
  );
}

export function CanvasSkeleton() {
  return (
    <LoadingRegion
      className="flex h-svh flex-col bg-zinc-100"
      label="Loading editor"
    >
      <div className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <Block className="size-8" />
          <div className="space-y-1.5">
            <Block className="h-3 w-20" />
            <Block className="h-2 w-12" />
          </div>
        </div>
        <div className="flex gap-2">
          <Block className="h-9 w-32" />
          <Block className="h-9 w-24" />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[52px_minmax(0,1fr)] md:grid-cols-[52px_230px_minmax(0,1fr)_280px]">
        <div className="space-y-2 border-r border-zinc-200 bg-white p-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Block key={index} className="size-9" />
          ))}
        </div>
        <div className="hidden space-y-3 border-r border-zinc-200 bg-white p-3 md:block">
          <Block className="h-9 w-full" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Block key={index} className="h-16 w-full" />
          ))}
        </div>
        <div className="min-w-0 p-6 md:p-10">
          <div className="mx-auto max-w-4xl bg-white p-8 shadow-[0_15px_45px_rgba(15,23,42,0.08)]">
            <Block className="h-12 w-3/4" />
            <Block className="mt-5 h-3 w-2/3" />
            <Block className="mt-8 h-9 w-28 bg-blue-100" />
            <div className="mt-10 grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Block key={index} className="h-24" />
              ))}
            </div>
          </div>
        </div>
        <div className="hidden space-y-4 border-l border-zinc-200 bg-white p-4 md:block">
          <Block className="h-3 w-20" />
          <Block className="h-9 w-full" />
          <Block className="h-9 w-full" />
          <Block className="h-28 w-full" />
        </div>
      </div>
    </LoadingRegion>
  );
}

export function PreviewSkeleton() {
  return (
    <LoadingRegion
      className="flex min-h-svh flex-col bg-zinc-100"
      label="Loading preview"
    >
      <BrandBar compact />
      <div className="flex flex-1 items-start justify-center p-5 md:p-10">
        <div className="w-full max-w-6xl bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <Block className="h-3 w-24" />
            <Block className="h-8 w-28" />
          </div>
          <Block className="mt-20 h-12 w-3/5" />
          <Block className="mt-5 h-4 w-2/3" />
          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Block key={index} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

export function AuthCardSkeleton() {
  return (
    <div className="w-full space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading authentication</span>
      <div className="border-b border-zinc-200 pb-6">
        <Block className="mb-3 h-2.5 w-16" />
        <Block className="h-7 w-40" />
        <Block className="mt-2 h-3 w-56" />
      </div>
      <div className="space-y-4">
        <Block className="h-10 w-full" />
        <Block className="h-10 w-full" />
        <Block className="h-10 w-full bg-blue-100" />
      </div>
    </div>
  );
}

export function AuthPageSkeleton() {
  return (
    <LoadingRegion
      className="flex min-h-svh flex-col"
      label="Loading authentication"
    >
      <BrandBar compact />
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8">
          <AuthCardSkeleton />
        </div>
      </main>
    </LoadingRegion>
  );
}

export function OnboardingSkeleton() {
  return (
    <LoadingRegion className="flex min-h-svh flex-col" label="Loading setup">
      <BrandBar compact />
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-zinc-200 p-8">
          <Block className="h-2.5 w-20" />
          <Block className="mt-4 h-8 w-56" />
          <Block className="mt-3 h-3 w-full" />
          <div className="my-7 h-px bg-zinc-200" />
          <Block className="h-10 w-full" />
          <Block className="mt-4 h-10 w-full" />
          <Block className="mt-6 h-11 w-full bg-blue-100" />
        </div>
      </main>
    </LoadingRegion>
  );
}

export function MarketingSkeleton() {
  return (
    <LoadingRegion className="min-h-svh" label="Loading website">
      <BrandBar />
      <main className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <Block className="mx-auto mt-6 h-14 w-full max-w-3xl" />
        <Block className="mx-auto mt-4 h-4 w-full max-w-xl" />
        <div className="mt-10 flex justify-center gap-3">
          <Block className="h-11 w-32 rounded-full bg-zinc-900" />
          <Block className="h-11 w-32" />
        </div>
        <Block className="mt-20 aspect-[16/10] w-full rounded-[32px]" />
      </main>
    </LoadingRegion>
  );
}

export function TenantSkeleton() {
  return (
    <LoadingRegion className="min-h-svh" label="Loading site">
      <BrandBar />
      <main className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <Block className="h-3 w-24" />
        <Block className="mt-6 h-12 w-3/4 max-w-2xl" />
        <Block className="mt-5 h-4 w-2/3 max-w-xl" />
        <Block className="mt-9 h-11 w-36 bg-blue-100" />
        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Block key={index} className="h-36" />
          ))}
        </div>
      </main>
    </LoadingRegion>
  );
}
