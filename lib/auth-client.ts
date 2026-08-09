"use client";

import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

/**
 * The base URL for better-auth API calls.
 *
 * - On the client: always derive from the current window origin so the auth
 *   client works correctly regardless of which port Next.js is running on
 *   (3000, 3001, etc.). This also ensures the Origin header matches the
 *   trusted origin configured in convex/auth.ts.
 *
 * - On the server (SSR / RSC): fall back to NEXT_PUBLIC_APP_URL, which must
 *   match SITE_URL in .env.local exactly.
 */
const baseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://qentrah.com"
        : "http://localhost:3000");

export const authClient = createAuthClient({
  baseURL,
  plugins: [convexClient()],
});

export const { signIn, signUp, useSession, signOut } = authClient;
