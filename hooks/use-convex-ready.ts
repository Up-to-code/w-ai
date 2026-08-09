"use client";

import { useConvexAuth } from "convex/react";
import { useSession } from "@/lib/auth-client";

/**
 * Session + Convex auth bridge status.
 *
 * Important: do NOT permanently skip authenticated queries when
 * `isAuthenticated` is briefly false — Convex will re-subscribe once the
 * token is set. Only skip while the browser session itself is unknown.
 */
export function useConvexReady() {
  const session = useSession();
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();

  const sessionPending = session.isPending;
  const hasSession = !!session.data;

  // Allow queries as soon as we know the user has a browser session.
  // Convex auth may lag a tick; queries retry when the token lands.
  const canQuery = !sessionPending && hasSession;

  return {
    session,
    sessionPending,
    hasSession,
    convexAuthLoading,
    isAuthenticated,
    ready: !sessionPending && !convexAuthLoading,
    canQuery,
  };
}
