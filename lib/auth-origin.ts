const PUBLIC_AUTH_ORIGIN = "https://www.w-ai.online";
const TRUSTED_AUTH_ORIGIN = "https://w-ai.online";

function replacePublicOrigin(value: string | null): string | null {
  if (!value) return value;

  try {
    const url = new URL(value);
    if (url.origin !== PUBLIC_AUTH_ORIGIN) return value;

    const trustedUrl = new URL(TRUSTED_AUTH_ORIGIN);
    url.protocol = trustedUrl.protocol;
    url.host = trustedUrl.host;
    return url.toString();
  } catch {
    return value;
  }
}

/**
 * The deployed Better Auth service currently uses the apex W-AI URL as its
 * canonical origin. Normalize requests arriving through the public `www`
 * alias before the Convex proxy sets its forwarded-host security headers.
 */
export async function normalizeAuthOrigin(request: Request): Promise<Request> {
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== PUBLIC_AUTH_ORIGIN) return request;

  const trustedUrl = new URL(TRUSTED_AUTH_ORIGIN);
  requestUrl.protocol = trustedUrl.protocol;
  requestUrl.host = trustedUrl.host;

  const headers = new Headers(request.headers);
  headers.set("origin", TRUSTED_AUTH_ORIGIN);

  const referer = replacePublicOrigin(headers.get("referer"));
  if (referer) headers.set("referer", referer);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  return new Request(requestUrl, {
    method: request.method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
    redirect: "manual",
  });
}
