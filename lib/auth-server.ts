import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

import { resolveConvexAuthEnvironment } from "@/lib/convex-auth-environment";

const { convexSiteUrl, convexUrl } = resolveConvexAuthEnvironment();

export const {
  handler,
  getToken,
  isAuthenticated,
  preloadAuthQuery,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthNextJs({
  convexUrl,
  convexSiteUrl,
});
