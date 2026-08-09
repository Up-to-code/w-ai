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
      className={cn("inline-block h-6 w-6 shrink-0 bg-current", className)}
      style={{
        WebkitMaskImage: 'url("/brand/brand-mark.svg")',
        maskImage: 'url("/brand/brand-mark.svg")',
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
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
