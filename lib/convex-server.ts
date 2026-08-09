import { ConvexHttpClient } from "convex/browser";

// Singleton used from server components / RSC for public tenant reads.
export const convexClient = new ConvexHttpClient(
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "",
);
