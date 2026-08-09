import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AuthFormPanelProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  className?: string;
}

/** Shared, borderless frame for the login and registration forms. */
export function AuthFormPanel({
  title,
  subtitle,
  children,
  footer,
  className,
}: AuthFormPanelProps) {
  return (
    <section className={cn("w-full max-w-[440px]", className)}>
      <header className="mb-9">
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          {subtitle}
        </p>
      </header>

      {children}

      <footer className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
        {footer}
      </footer>
    </section>
  );
}
