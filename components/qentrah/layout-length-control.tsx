"use client";

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
}: Pick<FieldProps, "value" | "onChange">) {
  const parsed = parseFlexibleLength(value);
  const mode = parsed.keyword ?? parsed.unit;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Input
        type="number"
        step="any"
        value={parsed.keyword ? "" : parsed.amount}
        disabled={Boolean(parsed.keyword)}
        onChange={(event) =>
          onChange(
            `${event.target.value === "" ? 0 : Number(event.target.value)}${parsed.unit}`,
          )
        }
        className="h-8 min-w-0 flex-1 rounded-md px-2 text-xs"
        aria-label="Size value"
      />
      <Select
        value={mode}
        onValueChange={(next) => {
          if ((KEYWORDS as readonly string[]).includes(next)) onChange(next);
          else onChange(`${parsed.amount}${next as LengthUnit}`);
        }}
      >
        <SelectTrigger className="h-8 w-[86px] rounded-md px-2 text-xs">
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
