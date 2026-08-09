import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  title = "W-AI",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      role="img"
      aria-label={title}
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center font-sans font-black leading-none tracking-[-0.12em]",
        className,
      )}
    >
      <span aria-hidden="true" className="-translate-x-[0.04em]">
        W
      </span>
    </span>
  );
}

export function BrandLockup({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark className={cn("h-5 w-7", markClassName)} />
      <span>W-AI</span>
    </span>
  );
}
