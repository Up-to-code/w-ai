import { cn } from "@/lib/utils";

type Status = "live" | "draft" | "pending" | "error" | "cms" | "ai";

const MAP: Record<Status, { cls: string; label: string }> = {
  live: { cls: "schema-green", label: "● Live" },
  draft: { cls: "schema-yellow", label: "● Draft" },
  pending: { cls: "schema-yellow", label: "● Pending" },
  error: { cls: "schema-red", label: "● Error" },
  cms: { cls: "schema-blue", label: "● CMS" },
  ai: { cls: "schema-purple", label: "● AI" },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: Status;
  label?: string;
  className?: string;
}) {
  const item = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
        item.cls,
        className,
      )}
    >
      {label ?? item.label}
    </span>
  );
}
