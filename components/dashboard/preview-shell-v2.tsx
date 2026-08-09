"use client";

import { useState, type ReactNode } from "react";
import { Link } from "@/i18n/routing";
import {
  Check,
  Edit2,
  ExternalLink,
  Laptop,
  Monitor,
  Smartphone,
} from "lucide-react";

import { cn } from "@/lib/utils";

const DEVICES = {
  desktop: { width: "100%", label: "Desktop", icon: Monitor },
  tablet: { width: "820px", label: "Tablet", icon: Laptop },
  mobile: { width: "390px", label: "Mobile", icon: Smartphone },
} as const;

type Device = keyof typeof DEVICES;

export function PreviewShell({
  children,
  orgSlug,
  pageSlug,
  title,
  published,
  publicUrl,
}: {
  children: ReactNode;
  orgSlug: string;
  pageSlug: string;
  title: string;
  published: boolean;
  publicUrl: string;
}) {
  const [device, setDevice] = useState<Device>("desktop");

  return (
    <div className="wf-ui flex min-h-svh flex-col bg-[#e9e9e9] text-foreground">
      <header className="sticky top-0 z-50 border-b border-[#d8d8d8] bg-white px-3 py-2">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={{
                pathname: "/dashboard/[org]/pages/[slug]/edit",
                params: { org: orgSlug, slug: pageSlug },
              }}
              className="transition-brand inline-flex h-9 items-center gap-2 rounded border border-border bg-card px-3 text-xs font-medium hover:bg-[#f2f2f2]"
            >
              <Edit2 className="size-3.5" strokeWidth={1.75} />
              Edit
            </Link>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-medium">{title}</p>
              <p
                className="font-mono text-[10px] text-muted-foreground"
                dir="ltr"
              >
                /{pageSlug}
              </p>
            </div>
            <span
              className={cn(
                "tag-schema",
                published ? "schema-green" : "schema-yellow",
              )}
            >
              {published ? <Check className="size-3" /> : null}
              {published ? "Live" : "Draft preview"}
            </span>
          </div>

          <div className="order-3 flex w-full items-center justify-center sm:order-none sm:w-auto">
            <div
              className="flex rounded-lg border border-border bg-background p-1 shadow-xs"
              aria-label="Preview size"
            >
              {(Object.keys(DEVICES) as Device[]).map((key) => {
                const item = DEVICES[key];
                const Icon = item.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    title={item.label}
                    aria-pressed={device === key}
                    onClick={() => setDevice(key)}
                    className={cn(
                      "transition-brand inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px]",
                      device === key
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" strokeWidth={1.75} />
                    <span className="hidden md:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {published ? (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="transition-brand inline-flex h-9 items-center gap-2 rounded bg-[#4353ff] px-3 text-xs font-medium text-white hover:bg-[#3545e8]"
            >
              Open live <ExternalLink className="size-3.5" strokeWidth={1.75} />
            </a>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Publish from the editor when ready
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-x-auto p-3 sm:p-6">
        <div
          className="t-preview-resize mx-auto min-h-[calc(100svh-7rem)] overflow-hidden bg-background shadow-[0_24px_80px_rgba(17,17,17,.14)] ring-1 ring-black/5"
          style={{ width: DEVICES[device].width }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
