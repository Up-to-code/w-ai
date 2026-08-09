import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";

import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

// SITE_URL must match the Next.js server origin exactly so better-auth can
// validate the Origin header. Falls back to localhost:3000 for local dev.
const siteUrl =
  process.env.SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

const trustedOrigins = [
  siteUrl,
  "https://w-ai.online",
  "https://www.w-ai.online",
  "https://qentrah.com",
  "https://www.qentrah.com",
  ...(process.env.AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    // Keep the canonical production URLs trusted even when a deployment uses
    // a preview URL as SITE_URL. Additional explicit origins remain opt-in.
    trustedOrigins: [...new Set(trustedOrigins)],
    database: authComponent.adapter(ctx),
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    plugins: [convex({ authConfig })],
  });
};

/** Current user document, or null when unauthenticated. */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.safeGetAuthUser(ctx);
  },
});
