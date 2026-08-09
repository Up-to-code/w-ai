export type ManagedDomainDnsState = {
  hostname: string;
  routingType: "A" | "CNAME";
  platformVerification: Array<{ type: string; domain: string }>;
};

export type DomainDnsRecordIdentity = {
  type: string;
  name: string;
};

function normalizedDnsName(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

export function dnsNameBelongsToHostname(name: string, hostname: string) {
  const normalizedName = normalizedDnsName(name);
  const normalizedHostname = normalizedDnsName(hostname);
  return (
    normalizedName === normalizedHostname ||
    normalizedName.endsWith(`.${normalizedHostname}`)
  );
}

/**
 * W-AI owns these records because changing them can detach routing, ownership,
 * or TLS verification. They are visible in the DNS manager but read-only.
 */
export function isPlatformManagedDnsRecord(
  record: DomainDnsRecordIdentity,
  domain: ManagedDomainDnsState,
) {
  const type = record.type.trim().toUpperCase();
  const name = normalizedDnsName(record.name);
  const hostname = normalizedDnsName(domain.hostname);

  if (type === domain.routingType && name === hostname) return true;
  if (type === "TXT" && name === `_w-ai-verify.${hostname}`) return true;

  return domain.platformVerification.some(
    (challenge) =>
      challenge.type.trim().toUpperCase() === type &&
      normalizedDnsName(challenge.domain) === name,
  );
}

export function validateDnsRecordInput(input: {
  recordId?: string;
  content: string;
  ttl: number;
}) {
  if (input.recordId !== undefined) {
    const recordId = input.recordId.trim();
    if (!recordId || recordId.length > 256) {
      throw new Error("DNS record id is invalid");
    }
  }
  const content = input.content.trim();
  if (!content || content.length > 8192) {
    throw new Error("DNS record content must be between 1 and 8192 characters");
  }
  if (
    !Number.isSafeInteger(input.ttl) ||
    (input.ttl !== 1 && (input.ttl < 60 || input.ttl > 86400))
  ) {
    throw new Error("TTL must be automatic (1) or between 60 and 86400 seconds");
  }
  return { content, recordId: input.recordId?.trim() };
}
