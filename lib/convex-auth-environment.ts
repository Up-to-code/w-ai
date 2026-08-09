type ConvexAuthEnvironment = Readonly<Record<string, string | undefined>>;

function nonEmpty(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function deriveConvexSiteUrl(convexUrl: string) {
  try {
    const url = new URL(convexUrl);
    if (!url.hostname.endsWith(".convex.cloud")) return undefined;

    url.hostname = `${url.hostname.slice(0, -".convex.cloud".length)}.convex.site`;
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.origin;
  } catch {
    return undefined;
  }
}

export function resolveConvexAuthEnvironment(
  environment: ConvexAuthEnvironment = process.env,
) {
  const convexUrl = nonEmpty(environment.NEXT_PUBLIC_CONVEX_URL);
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set.");
  }

  const convexSiteUrl =
    nonEmpty(environment.NEXT_PUBLIC_CONVEX_SITE_URL) ??
    nonEmpty(environment.CONVEX_SITE_URL) ??
    deriveConvexSiteUrl(convexUrl);

  if (!convexSiteUrl) {
    throw new Error(
      "Set NEXT_PUBLIC_CONVEX_SITE_URL (or CONVEX_SITE_URL) to the Convex HTTP Actions URL.",
    );
  }

  return { convexSiteUrl, convexUrl };
}
