"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Id } from "@/convex/_generated/dataModel";

export type OrgDomain = {
  _id: string;
  hostname: string;
  verified: boolean;
};

export type OrgContextValue = {
  orgId: Id<"organizations">;
  orgSlug: string;
  orgName: string;
  role: string;
  domains: OrgDomain[];
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({
  value,
  children,
}: {
  value: OrgContextValue;
  children: ReactNode;
}) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error("useOrg must be used within OrgProvider");
  }
  return ctx;
}

export function useOrgOptional() {
  return useContext(OrgContext);
}
