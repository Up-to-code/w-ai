"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  OrgProvider,
  type OrgContextValue,
} from "@/components/dashboard/org-context";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

/**
 * Org chrome. Builder + preview are full-viewport — no sidebar.
 * Always provides OrgProvider so client pages have orgId without re-fetching.
 */
export function OrgShell({
  org,
  children,
}: {
  org: OrgContextValue;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const isCanvas = /\/pages\/[^/]+\/(edit|preview)\/?$/.test(pathname);

  return (
    <OrgProvider value={org}>
      {isCanvas ? (
        <div className="wf-ui min-h-svh bg-background">{children}</div>
      ) : (
        <div className="wf-ui flex min-h-svh bg-background">
          <DashboardSidebar orgSlug={org.orgSlug} orgName={org.orgName} />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      )}
    </OrgProvider>
  );
}
