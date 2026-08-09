"use client";

import { useEffect, useState } from "react";
import type { FieldProps } from "@puckeditor/core";

import {
  LENGTH_UNITS,
  parseFlexibleLength,
  type LengthUnit,
} from "@/lib/puck/flexible-layout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const KEYWORDS = [
  "auto",
  "none",
  "fit-content",
  "min-content",
  "max-content",
] as const;

export function LayoutLengthControl({
  value,
  onChange,
  label = "Size",
}: Pick<FieldProps, "value" | "onChange"> & { label?: string }) {
  const parsed = parseFlexibleLength(value);
  const mode = parsed.keyword ?? parsed.unit;
  const externalDraft = parsed.keyword ? "" : String(parsed.amount);
  const [draft, setDraft] = useState(externalDraft);

  useEffect(() => setDraft(externalDraft), [externalDraft]);

  const commitDraft = (nextDraft: string) => {
    const amount = Number(nextDraft);
    if (nextDraft.trim() === "" || !Number.isFinite(amount)) return;
    onChange(`${amount}${parsed.unit}`);
  };

  return (
    <div className="grid min-w-0 grid-cols-[54px_minmax(0,1fr)_82px] items-center gap-1.5">
      <span className="truncate text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      <Input
        type="number"
        step="any"
        value={draft}
        disabled={Boolean(parsed.keyword)}
        onChange={(event) => {
          setDraft(event.target.value);
          commitDraft(event.target.value);
        }}
        onBlur={() => {
          if (draft.trim() === "") setDraft(externalDraft);
          else commitDraft(draft);
        }}
        className="h-8 min-w-0 flex-1 rounded-md px-2 text-xs"
        aria-label={`${label} value`}
      />
      <Select
        value={mode}
        onValueChange={(next) => {
          if ((KEYWORDS as readonly string[]).includes(next)) onChange(next);
          else {
            const amount = Number(draft);
            onChange(
              `${Number.isFinite(amount) ? amount : parsed.amount}${next as LengthUnit}`,
            );
          }
        }}
      >
        <SelectTrigger
          className="h-8 w-full rounded-md px-2 text-xs"
          aria-label={`${label} unit`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LENGTH_UNITS.map((unit) => (
            <SelectItem key={unit} value={unit}>
              {unit}
            </SelectItem>
          ))}
          {KEYWORDS.map((keyword) => (
            <SelectItem key={keyword} value={keyword}>
              {keyword}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
