"use client";

import { HexColorInput, HexColorPicker } from "react-colorful";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function QentrahColorPicker({
  value,
  onChange,
  label,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={
            compact
              ? "size-5 shrink-0 rounded-full border-2 border-white outline-none ring-blue-400 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950"
              : "flex h-9 w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 text-left text-xs text-zinc-700 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
          }
        >
          <span
            className={
              compact
                ? "block size-full rounded-full"
                : "block size-5 rounded-full border border-zinc-200"
            }
            style={{ backgroundColor: value }}
          />
          {!compact ? (
            <span className="font-mono uppercase">{value}</span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-auto rounded-lg border-zinc-200 bg-white p-3 shadow-none [&_.react-colorful]:h-44 [&_.react-colorful]:w-56"
      >
        <HexColorPicker color={value} onChange={onChange} />
        <div className="mt-3 flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-2.5">
          <span className="text-xs font-medium text-zinc-400">#</span>
          <HexColorInput
            color={value}
            onChange={onChange}
            className="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase text-zinc-800 outline-none"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
