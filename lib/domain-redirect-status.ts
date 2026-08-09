export type DomainRedirectStatusCode = 301 | 302 | 307 | 308;

export const DOMAIN_REDIRECT_STATUS_OPTIONS: ReadonlyArray<{
  value: DomainRedirectStatusCode;
  label: string;
  description: string;
}> = [
  {
    value: 308,
    label: "308 · Permanent",
    description: "Keeps the request method and body",
  },
  {
    value: 301,
    label: "301 · Permanent",
    description: "Legacy clients may change the method to GET",
  },
  {
    value: 307,
    label: "307 · Temporary",
    description: "Keeps the request method and body",
  },
  {
    value: 302,
    label: "302 · Temporary",
    description: "Legacy clients may change the method to GET",
  },
];

export function isDomainRedirectStatusCode(
  value: number,
): value is DomainRedirectStatusCode {
  return value === 301 || value === 302 || value === 307 || value === 308;
}
