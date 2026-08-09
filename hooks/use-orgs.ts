"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

export function useMyOrgs() {
  return useQuery(api.organizations.listMine, {});
}

export function useMe() {
  return useQuery(api.users.me, {});
}
