import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  title = "W-AI",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 96 64"
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
      fill="none"
    >
      <path
        d="M16 10 43 54"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="m45 10 27 44"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="m84 10-12 21"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path d="m43 34 5 8-5 8-5-8 5-8Z" fill="currentColor" />
    </svg>
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
