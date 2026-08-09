import type { ReactNode } from "react";

export function PageHeader({
  meta,
  title,
  description,
  actions,
}: {
  meta?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-border bg-card px-6 py-5 md:px-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="min-w-0">
          {meta ? (
            <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">
              {meta}
            </p>
          ) : null}
          <h1 className="text-lg font-semibold tracking-[-.015em] text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
