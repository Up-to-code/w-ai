import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import {
  dnsNameBelongsToHostname,
  isPlatformManagedDnsRecord,
  validateDnsRecordInput,
} from "./domainDns";
import {
  customDomainClaimError,
  isApexHostname,
  registrableDomain,
} from "./domainNames";
import {
  logEvent,
  normalizeHostname,
  randomToken,
  requireAdmin,
} from "./helpers";
import { assertWithinLimit } from "./limits";
import {
  preferredVercelDnsTargets,
  type VercelDomainConfiguration,
} from "./vercelDomainConfig";

const providerValidator = v.union(
  v.literal("manual"),
  v.literal("cloudflare"),
  v.literal("vercel"),
);

const domainStatusValidator = v.union(
  v.literal("pending"),
  v.literal("configuring"),
  v.literal("verified"),
  v.literal("error"),
);

const routingTypeValidator = v.union(v.literal("A"), v.literal("CNAME"));

const tlsStatusValidator = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("error"),
);

const redirectStatusValidator = v.union(
  v.literal(301),
  v.literal(302),
  v.literal(307),
  v.literal(308),
);

const registrarProviderValidator = v.union(
  v.literal("openprovider"),
  v.literal("domainee"),
);

const registrationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("expired"),
  v.literal("redemption"),
  v.literal("transferred_out"),
);

const ownershipModelValidator = v.union(
  v.literal("customer_registrant"),
  v.literal("bring_your_own"),
);

const domainValidator = v.object({
  _id: v.id("domains"),
  orgId: v.id("organizations"),
  orgName: v.string(),
  orgSlug: v.string(),
  hostname: v.string(),
  verified: v.boolean(),
  provider: providerValidator,
  status: domainStatusValidator,
  verificationToken: v.string(),
  cnameTarget: v.string(),
  apexTarget: v.string(),
  routingType: v.union(v.literal("A"), v.literal("CNAME")),
  redirectTo: v.optional(v.string()),
  redirectStatusCode: v.optional(redirectStatusValidator),
  registrarProvider: v.optional(registrarProviderValidator),
  registrationStatus: v.optional(registrationStatusValidator),
  registrationExpiresAt: v.optional(v.number()),
  autoRenew: v.optional(v.boolean()),
  ownershipModel: ownershipModelValidator,
  platformVerified: v.boolean(),
  platformVerification: v.array(
    v.object({
      type: v.string(),
      domain: v.string(),
      value: v.string(),
      reason: v.optional(v.string()),
    }),
  ),
  tlsStatus: tlsStatusValidator,
  tlsCheckedAt: v.optional(v.number()),
  tlsExpiresAt: v.optional(v.number()),
  verifiedAt: v.optional(v.number()),
  lastCheckedAt: v.optional(v.number()),
  verificationAttempt: v.optional(v.number()),
  nextVerificationAt: v.optional(v.number()),
  nextHealthCheckAt: v.optional(v.number()),
  error: v.optional(v.string()),
  createdAt: v.number(),
});

function defaultCnameTarget() {
  return process.env.DOMAIN_CNAME_TARGET ?? "cname.vercel-dns.com";
}

function defaultApexTarget() {
  return process.env.DOMAIN_APEX_TARGET ?? "76.76.21.21";
}

function reservedPlatformDomains() {
  const configured = (process.env.PLATFORM_RESERVED_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
  return [...new Set(["w-ai.online", "qentrah.com", ...configured])];
}

function publicDomain(
  domain: {
    _id: Id<"domains">;
    orgId: Id<"organizations">;
    hostname: string;
    verified: boolean;
    provider?: "manual" | "cloudflare" | "vercel";
    status?: "pending" | "configuring" | "verified" | "error";
    verificationToken?: string;
    cnameTarget?: string;
    apexTarget?: string;
    dnsZone?: string;
    dnsTeamId?: string;
    routingType?: "A" | "CNAME";
    redirectTo?: string;
    redirectStatusCode?: 301 | 302 | 307 | 308;
    registrarProvider?: "openprovider" | "domainee";
    registrationStatus?:
      "pending" | "active" | "expired" | "redemption" | "transferred_out";
    registrationExpiresAt?: number;
    autoRenew?: boolean;
    ownershipModel?: "customer_registrant" | "bring_your_own";
    platformVerified?: boolean;
    platformVerification?: Array<{
      type: string;
      domain: string;
      value: string;
      reason?: string;
    }>;
    tlsStatus?: "pending" | "active" | "error";
    tlsCheckedAt?: number;
    tlsExpiresAt?: number;
    verifiedAt?: number;
    lastCheckedAt?: number;
    verificationAttempt?: number;
    nextVerificationAt?: number;
    nextHealthCheckAt?: number;
    error?: string;
    createdAt: number;
  },
  org: { name: string; slug: string },
) {
  return {
    _id: domain._id,
    orgId: domain.orgId,
    orgName: org.name,
    orgSlug: org.slug,
    hostname: domain.hostname,
    verified: domain.verified,
    provider: domain.provider ?? ("manual" as const),
    status:
      domain.status ??
      (domain.verified ? ("verified" as const) : ("pending" as const)),
    verificationToken: domain.verificationToken ?? "",
    cnameTarget: domain.cnameTarget ?? defaultCnameTarget(),
    apexTarget: domain.apexTarget ?? defaultApexTarget(),
    routingType:
      domain.routingType ?? (isApexHostname(domain.hostname) ? "A" : "CNAME"),
    redirectTo: domain.redirectTo,
    redirectStatusCode: domain.redirectStatusCode,
    registrarProvider: domain.registrarProvider,
    registrationStatus: domain.registrationStatus,
    registrationExpiresAt: domain.registrationExpiresAt,
    autoRenew: domain.autoRenew,
    ownershipModel: domain.ownershipModel ?? ("bring_your_own" as const),
    platformVerified: domain.platformVerified ?? false,
    platformVerification: domain.platformVerification ?? [],
    tlsStatus: domain.tlsStatus ?? "pending",
    tlsCheckedAt: domain.tlsCheckedAt,
    tlsExpiresAt: domain.tlsExpiresAt,
    verifiedAt: domain.verifiedAt,
    lastCheckedAt: domain.lastCheckedAt,
    verificationAttempt: domain.verificationAttempt,
    nextVerificationAt: domain.nextVerificationAt,
    nextHealthCheckAt: domain.nextHealthCheckAt,
    error: domain.error,
    createdAt: domain.createdAt,
  };
}

export const listWorkspace = query({
  args: {},
  returns: v.array(domainValidator),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(200);
    const result = [];
    for (const membership of memberships) {
      if (result.length >= 500) break;
      if (membership.role !== "owner" && membership.role !== "admin") continue;
      const org = await ctx.db.get(membership.orgId);
      if (!org || org.status === "deleted") continue;
      const domains = await ctx.db
        .query("domains")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .take(Math.min(100, 500 - result.length));
      result.push(...domains.map((domain) => publicDomain(domain, org)));
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const listForOrg = query({
  args: { orgId: v.id("organizations") },
  returns: v.array(domainValidator),
  handler: async (ctx, args) => {
    const { org } = await requireAdmin(ctx, args.orgId);
    const domains = await ctx.db
      .query("domains")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .take(500);
    return domains.map((domain) => publicDomain(domain, org));
  },
});

export const add = mutation({
  args: {
    orgId: v.id("organizations"),
    hostname: v.string(),
    provider: providerValidator,
  },
  returns: v.id("domains"),
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx, args.orgId);
    await assertWithinLimit(ctx, args.orgId, "domains");
    const hostname = normalizeHostname(args.hostname);
    const claimError = customDomainClaimError(
      hostname,
      reservedPlatformDomains(),
    );
    if (claimError) throw new ConvexError(claimError);
    const existing = await ctx.db
      .query("domains")
      .withIndex("by_hostname", (q) => q.eq("hostname", hostname))
      .first();
    if (existing) throw new ConvexError("This domain is already assigned");

    const id = await ctx.db.insert("domains", {
      orgId: args.orgId,
      hostname,
      provider: args.provider,
      status: "pending",
      verified: false,
      verificationToken: `w-ai-verify=${randomToken(16)}`,
      cnameTarget: defaultCnameTarget(),
      apexTarget: defaultApexTarget(),
      routingType: isApexHostname(hostname) ? "A" : "CNAME",
      platformVerified: false,
      platformVerification: [],
      tlsStatus: "pending",
      createdAt: Date.now(),
    });
    await logEvent(ctx, {
      orgId: args.orgId,
      userId: user._id,
      type: "domain.add",
      title: `Domain added: ${hostname}`,
      metadata: { provider: args.provider },
    });
    return id;
  },
});

export const assign = mutation({
  args: {
    domainId: v.id("domains"),
    orgId: v.id("organizations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) throw new ConvexError("Domain not found");
    await requireAdmin(ctx, domain.orgId);
    await requireAdmin(ctx, args.orgId);
    if (domain.orgId !== args.orgId) {
      const currentOrgDomains = await ctx.db
        .query("domains")
        .withIndex("by_org", (q) => q.eq("orgId", domain.orgId))
        .take(500);
      if (
        domain.redirectTo ||
        currentOrgDomains.some(
          (candidate) => candidate.redirectTo === domain.hostname,
        )
      ) {
        throw new ConvexError(
          "Remove this domain's redirect before assigning it to another site",
        );
      }
      const scopedRedirectRules = await ctx.db
        .query("redirectRules")
        .withIndex("by_org_and_hostname", (q) =>
          q.eq("orgId", domain.orgId).eq("hostname", domain.hostname),
        )
        .take(500);
      const scopedRedirectBlocker = domainTransitionBlockerMessage(
        [],
        scopedRedirectRules.map((rule) => rule.sourcePath),
        "assigning",
      );
      if (scopedRedirectBlocker) throw new ConvexError(scopedRedirectBlocker);
      await assertWithinLimit(ctx, args.orgId, "domains");
    }
    await ctx.db.patch(domain._id, { orgId: args.orgId });
    return null;
  },
});

export function domainTransitionBlockerMessage(
  redirectingHostnames: string[],
  scopedRedirectPaths: string[],
  operation: "assigning" | "detaching" | "redirecting",
): string | null {
  if (redirectingHostnames.length > 0) {
    return `Remove redirects from ${redirectingHostnames.join(", ")} before ${operation} this domain`;
  }
  if (scopedRedirectPaths.length > 0) {
    const preview = scopedRedirectPaths.slice(0, 3).join(", ");
    const remaining = scopedRedirectPaths.length - 3;
    return `Remove hostname-specific redirect rules (${preview}${remaining > 0 ? `, and ${remaining} more` : ""}) before ${operation} this domain`;
  }
  return null;
}

type DomainCheckRecord = {
  _id: Id<"domains">;
  orgId: Id<"organizations">;
  hostname: string;
  verified: boolean;
  verificationToken: string;
  cnameTarget: string;
  apexTarget: string;
  provider: "manual" | "cloudflare" | "vercel";
  dnsZone?: string;
  dnsTeamId?: string;
  routingType: "A" | "CNAME";
  redirectTo?: string;
  redirectStatusCode?: 301 | 302 | 307 | 308;
  platformVerified: boolean;
  platformVerification: Array<{
    type: string;
    domain: string;
    value: string;
    reason?: string;
  }>;
  tlsStatus: "pending" | "active" | "error";
  tlsCheckedAt?: number;
  tlsExpiresAt?: number;
  verificationRunId?: string;
};

const domainCheckRecordValidator = v.object({
  _id: v.id("domains"),
  orgId: v.id("organizations"),
  hostname: v.string(),
  verified: v.boolean(),
  verificationToken: v.string(),
  cnameTarget: v.string(),
  apexTarget: v.string(),
  provider: providerValidator,
  dnsZone: v.optional(v.string()),
  dnsTeamId: v.optional(v.string()),
  routingType: v.union(v.literal("A"), v.literal("CNAME")),
  redirectTo: v.optional(v.string()),
  redirectStatusCode: v.optional(redirectStatusValidator),
  platformVerified: v.boolean(),
  platformVerification: v.array(
    v.object({
      type: v.string(),
      domain: v.string(),
      value: v.string(),
      reason: v.optional(v.string()),
    }),
  ),
  tlsStatus: tlsStatusValidator,
  tlsCheckedAt: v.optional(v.number()),
  tlsExpiresAt: v.optional(v.number()),
  verificationRunId: v.optional(v.string()),
});

function domainCheckRecord(domain: {
  _id: Id<"domains">;
  orgId: Id<"organizations">;
  hostname: string;
  verified: boolean;
  verificationToken?: string;
  cnameTarget?: string;
  apexTarget?: string;
  provider?: "manual" | "cloudflare" | "vercel";
  dnsZone?: string;
  dnsTeamId?: string;
  routingType?: "A" | "CNAME";
  redirectTo?: string;
  redirectStatusCode?: 301 | 302 | 307 | 308;
  platformVerified?: boolean;
  platformVerification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason?: string;
  }>;
  tlsStatus?: "pending" | "active" | "error";
  tlsCheckedAt?: number;
  tlsExpiresAt?: number;
  verificationRunId?: string;
}): DomainCheckRecord {
  return {
    _id: domain._id,
    orgId: domain.orgId,
    hostname: domain.hostname,
    verified: domain.verified,
    verificationToken: domain.verificationToken ?? "",
    cnameTarget: domain.cnameTarget ?? defaultCnameTarget(),
    apexTarget: domain.apexTarget ?? defaultApexTarget(),
    provider: domain.provider ?? "manual",
    dnsZone: domain.dnsZone,
    dnsTeamId: domain.dnsTeamId,
    routingType:
      domain.routingType ?? (isApexHostname(domain.hostname) ? "A" : "CNAME"),
    redirectTo: domain.redirectTo,
    redirectStatusCode: domain.redirectStatusCode,
    platformVerified: domain.platformVerified ?? false,
    platformVerification: domain.platformVerification ?? [],
    tlsStatus: domain.tlsStatus ?? "pending",
    tlsCheckedAt: domain.tlsCheckedAt,
    tlsExpiresAt: domain.tlsExpiresAt,
    verificationRunId: domain.verificationRunId,
  };
}

export const getForCheck = internalQuery({
  args: { domainId: v.id("domains") },
  returns: domainCheckRecordValidator,
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) throw new ConvexError("Domain not found");
    await requireAdmin(ctx, domain.orgId);
    return domainCheckRecord(domain);
  },
});

/** System-only read used by scheduled verification after user authorization. */
export const getForAutomaticCheck = internalQuery({
  args: { domainId: v.id("domains") },
  returns: v.union(v.null(), domainCheckRecordValidator),
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    return domain ? domainCheckRecord(domain) : null;
  },
});

export const getTransitionDependencies = internalQuery({
  args: { domainId: v.id("domains") },
  returns: v.object({
    redirectingHostnames: v.array(v.string()),
    scopedRedirectPaths: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) throw new ConvexError("Domain not found");
    await requireAdmin(ctx, domain.orgId);
    const domains = await ctx.db
      .query("domains")
      .withIndex("by_org", (q) => q.eq("orgId", domain.orgId))
      .take(500);
    const scopedRedirectRules = await ctx.db
      .query("redirectRules")
      .withIndex("by_org_and_hostname", (q) =>
        q.eq("orgId", domain.orgId).eq("hostname", domain.hostname),
      )
      .take(500);
    return {
      redirectingHostnames: domains
        .filter((candidate) => candidate.redirectTo === domain.hostname)
        .map((candidate) => candidate.hostname),
      scopedRedirectPaths: scopedRedirectRules.map((rule) => rule.sourcePath),
    };
  },
});

export const savePlatformState = internalMutation({
  args: {
    domainId: v.id("domains"),
    status: domainStatusValidator,
    providerDomainId: v.optional(v.string()),
    dnsZone: v.optional(v.string()),
    dnsTeamId: v.optional(v.string()),
    provider: v.optional(providerValidator),
    routingType: v.optional(v.union(v.literal("A"), v.literal("CNAME"))),
    cnameTarget: v.optional(v.string()),
    apexTarget: v.optional(v.string()),
    platformVerified: v.optional(v.boolean()),
    platformVerification: v.optional(
      v.array(
        v.object({
          type: v.string(),
          domain: v.string(),
          value: v.string(),
          reason: v.optional(v.string()),
        }),
      ),
    ),
    tlsStatus: v.optional(tlsStatusValidator),
    tlsCheckedAt: v.optional(v.number()),
    tlsExpiresAt: v.optional(v.union(v.number(), v.null())),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) throw new ConvexError("Domain not found");
    // This mutation is internal-only and is also called by scheduled domain
    // verification, which intentionally has no interactive user identity.
    // User-facing actions authorize with `getForCheck` before reaching this
    // boundary; background checks use `getForAutomaticCheck`.
    await ctx.db.patch(domain._id, {
      status: args.status,
      // Reattaching to a different platform project can invalidate a hostname
      // that was previously live. Never keep serving it as verified while the
      // platform still requires an ownership challenge.
      verified:
        args.platformVerified === false ||
        (args.tlsStatus !== undefined && args.tlsStatus !== "active")
          ? false
          : domain.verified,
      ...(args.providerDomainId !== undefined
        ? { providerDomainId: args.providerDomainId }
        : {}),
      ...(args.dnsZone !== undefined ? { dnsZone: args.dnsZone } : {}),
      ...(args.dnsTeamId !== undefined ? { dnsTeamId: args.dnsTeamId } : {}),
      ...(args.provider !== undefined ? { provider: args.provider } : {}),
      ...(args.routingType !== undefined
        ? { routingType: args.routingType }
        : {}),
      ...(args.cnameTarget !== undefined
        ? { cnameTarget: args.cnameTarget }
        : {}),
      ...(args.apexTarget !== undefined ? { apexTarget: args.apexTarget } : {}),
      ...(args.platformVerified !== undefined
        ? { platformVerified: args.platformVerified }
        : {}),
      ...(args.platformVerification !== undefined
        ? { platformVerification: args.platformVerification }
        : {}),
      ...(args.tlsStatus !== undefined ? { tlsStatus: args.tlsStatus } : {}),
      ...(args.tlsCheckedAt !== undefined
        ? { tlsCheckedAt: args.tlsCheckedAt }
        : {}),
      ...(args.tlsExpiresAt !== undefined
        ? { tlsExpiresAt: args.tlsExpiresAt ?? undefined }
        : {}),
      error: args.error,
    });
    return null;
  },
});

export const saveCheckResult = internalMutation({
  args: {
    domainId: v.id("domains"),
    verified: v.boolean(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) throw new ConvexError("Domain not found");
    await ctx.db.patch(domain._id, {
      verified: args.verified,
      status: args.verified
        ? "verified"
        : domain.platformVerified
          ? "configuring"
          : "pending",
      verifiedAt: args.verified ? Date.now() : undefined,
      lastCheckedAt: Date.now(),
      nextHealthCheckAt: args.verified
        ? Date.now() + 24 * 60 * 60 * 1000
        : undefined,
      ...(args.verified
        ? {
            verificationAttempt: undefined,
            nextVerificationAt: undefined,
            verificationRunId: undefined,
          }
        : {}),
      error: args.error,
    });
    return null;
  },
});

export const listDueForHealthCheck = internalQuery({
  args: { now: v.number(), limit: v.number() },
  returns: v.array(v.id("domains")),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(200, Math.floor(args.limit)));
    const domains = await ctx.db
      .query("domains")
      .withIndex("by_verified_and_next_health_check", (q) =>
        q.eq("verified", true).lte("nextHealthCheckAt", args.now),
      )
      .take(limit);
    return domains.map((domain) => domain._id);
  },
});

export const leaseHealthCheck = internalMutation({
  args: {
    domainId: v.id("domains"),
    nextHealthCheckAt: v.number(),
    error: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain?.verified) return false;
    await ctx.db.patch(domain._id, {
      nextHealthCheckAt: args.nextHealthCheckAt,
      ...(args.error !== undefined ? { error: args.error } : {}),
    });
    return true;
  },
});

export const saveAutomaticCheckSchedule = internalMutation({
  args: {
    domainId: v.id("domains"),
    attempt: v.number(),
    runId: v.string(),
    nextVerificationAt: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain || domain.verified) return null;
    await ctx.db.patch(domain._id, {
      verificationAttempt: args.attempt,
      verificationRunId: args.runId,
      nextVerificationAt: args.nextVerificationAt,
      ...(args.error ? { error: args.error } : {}),
    });
    return null;
  },
});

export const saveRedirectState = internalMutation({
  args: {
    domainId: v.id("domains"),
    redirectTo: v.optional(v.string()),
    redirectStatusCode: v.optional(redirectStatusValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) throw new ConvexError("Domain not found");
    const { user } = await requireAdmin(ctx, domain.orgId);
    await ctx.db.patch(domain._id, {
      redirectTo: args.redirectTo,
      redirectStatusCode: args.redirectStatusCode,
    });
    await logEvent(ctx, {
      orgId: domain.orgId,
      userId: user._id,
      type: "domain.redirect",
      title: args.redirectTo
        ? `Domain redirect: ${domain.hostname} to ${args.redirectTo}`
        : `Domain redirect removed: ${domain.hostname}`,
      metadata: args.redirectTo
        ? { redirectTo: args.redirectTo, status: args.redirectStatusCode }
        : undefined,
    });
    return null;
  },
});

type DnsAnswer = { data?: string };

async function resolveDns(name: string, type: "TXT" | "CNAME" | "A") {
  const response = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!response.ok) throw new Error(`DNS lookup failed (${response.status})`);
  const body = (await response.json()) as { Answer?: DnsAnswer[] };
  return (body.Answer ?? [])
    .map((answer) => answer.data?.replace(/^"|"$/g, "").replace(/\.$/, ""))
    .filter((value): value is string => Boolean(value));
}

type VercelCertificate = {
  uid?: string;
  cns?: string[];
  expiration?: string | number;
};

function certificateExpiration(value: string | number | undefined) {
  if (value === undefined) return null;
  const numeric = typeof value === "string" ? Number(value) : value;
  const parsed =
    Number.isFinite(numeric) && numeric > 0
      ? numeric < 1_000_000_000_000
        ? numeric * 1000
        : numeric
      : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

/** True for an exact SAN or a single-label wildcard SAN. */
export function certificateNameCoversHostname(
  certificateName: string,
  hostname: string,
) {
  const name = certificateName.trim().toLowerCase().replace(/\.$/, "");
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (name === host) return true;
  if (!name.startsWith("*.")) return false;
  const suffix = name.slice(2);
  if (!host.endsWith(`.${suffix}`)) return false;
  return host.split(".").length === suffix.split(".").length + 1;
}

export function activeCertificateExpiration(
  certificates: VercelCertificate[],
  hostname: string,
  now = Date.now(),
) {
  return (
    certificates.reduce<number | null>((latest, certificate) => {
      const expiration = certificateExpiration(certificate.expiration);
      if (
        expiration === null ||
        expiration <= now ||
        !(certificate.cns ?? []).some((name) =>
          certificateNameCoversHostname(name, hostname),
        )
      ) {
        return latest;
      }
      return latest === null ? expiration : Math.max(latest, expiration);
    }, null) ?? undefined
  );
}

async function vercelTlsState(token: string, hostname: string) {
  const query = new URLSearchParams({ domain: hostname, limit: "100" });
  const teamId = process.env.VERCEL_TEAM_ID;
  if (teamId) query.set("teamId", teamId);
  // This is the domain-filtered certificate collection used by the official
  // Vercel CLI's certificate commands. It avoids making an HTTPS request to a
  // customer-controlled hostname, which would create an SSRF/rebinding risk.
  const response = await fetch(`https://api.vercel.com/v5/certs?${query}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as {
    certs?: VercelCertificate[];
    error?: { message?: string };
  };
  if (!response.ok || !Array.isArray(body.certs)) {
    throw new ConvexError(
      body.error?.message ??
        `Vercel certificate lookup failed (${response.status})`,
    );
  }
  const checkedAt = Date.now();
  const expiresAt = activeCertificateExpiration(
    body.certs,
    hostname,
    checkedAt,
  );
  return {
    status: expiresAt ? ("active" as const) : ("pending" as const),
    checkedAt,
    expiresAt,
  };
}

export type DomainCheckResult = {
  verified: boolean;
  txtVerified: boolean;
  routingVerified: boolean;
  platformVerified: boolean;
  tlsStatus: "pending" | "active" | "error";
  tlsExpiresAt?: number;
  message: string;
};

export const domainCheckResultValidator = v.object({
  verified: v.boolean(),
  txtVerified: v.boolean(),
  routingVerified: v.boolean(),
  platformVerified: v.boolean(),
  tlsStatus: tlsStatusValidator,
  tlsExpiresAt: v.optional(v.number()),
  message: v.string(),
});

/** Shared by the user-triggered check and the system retry action. */
export async function verifyDomainConnection(
  ctx: ActionCtx,
  domainId: Id<"domains">,
  domain: DomainCheckRecord,
): Promise<DomainCheckResult> {
  const [txt, cname, ipv4] = await Promise.all([
    resolveDns(`_w-ai-verify.${domain.hostname}`, "TXT"),
    resolveDns(domain.hostname, "CNAME"),
    resolveDns(domain.hostname, "A"),
  ]);
  const txtVerified = txt.some((value) =>
    value.includes(domain.verificationToken),
  );
  const target = domain.cnameTarget.replace(/\.$/, "").toLowerCase();
  const routingVerified =
    domain.routingType === "A"
      ? ipv4.includes(domain.apexTarget)
      : cname.some((value) => value.toLowerCase() === target);
  let platformVerified = domain.platformVerified;
  let tlsStatus = domain.tlsStatus;
  let tlsExpiresAt = domain.tlsExpiresAt;

  if (txtVerified && routingVerified) {
    const token = await providerToken(ctx, "vercel");
    const projectId = process.env.VERCEL_PROJECT_ID;
    if (!projectId) {
      throw new ConvexError("Vercel project routing is not configured");
    }
    const teamId = process.env.VERCEL_TEAM_ID;
    const response = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/domains/${encodeURIComponent(domain.hostname)}/verify${teamId ? `?teamId=${teamId}` : ""}`,
      { method: "POST", headers: { authorization: `Bearer ${token}` } },
    );
    const body = (await response.json()) as {
      verified?: boolean;
      error?: { message?: string };
    };
    platformVerified = response.ok && body.verified === true;
    if (!platformVerified && response.status !== 400) {
      throw new ConvexError(
        body.error?.message ??
          `Vercel verification failed (${response.status})`,
      );
    }
    const tls = platformVerified
      ? await vercelTlsState(token, domain.hostname)
      : {
          status: "pending" as const,
          checkedAt: Date.now(),
          expiresAt: undefined,
        };
    tlsStatus = tls.status;
    tlsExpiresAt = tls.expiresAt;
    await ctx.runMutation(internal.domains.savePlatformState, {
      domainId,
      status:
        platformVerified && tlsStatus === "active" ? "verified" : "configuring",
      platformVerified,
      platformVerification: platformVerified ? [] : domain.platformVerification,
      tlsStatus,
      tlsCheckedAt: tls.checkedAt,
      tlsExpiresAt: tls.expiresAt ?? null,
      error: !platformVerified
        ? (body.error?.message ??
          "Vercel is waiting for its ownership challenge")
        : tlsStatus !== "active"
          ? "Vercel is provisioning the TLS certificate"
          : undefined,
    });
  }

  const verified =
    txtVerified &&
    routingVerified &&
    platformVerified &&
    tlsStatus === "active";
  const missing = [
    !txtVerified ? "TXT ownership record" : null,
    !routingVerified ? "routing record" : null,
    !platformVerified ? "Vercel verification" : null,
    platformVerified && tlsStatus !== "active" ? "TLS certificate" : null,
  ].filter(Boolean);
  const message = verified
    ? "DNS ownership, routing, Vercel project verification, and TLS are active"
    : `Waiting for ${missing.join(" and ")}`;
  await ctx.runMutation(internal.domains.saveCheckResult, {
    domainId,
    verified,
    error: verified ? undefined : message,
  });
  return {
    verified,
    txtVerified,
    routingVerified,
    platformVerified,
    tlsStatus,
    tlsExpiresAt,
    message,
  };
}

export const check = action({
  args: { domainId: v.id("domains") },
  returns: domainCheckResultValidator,
  handler: async (ctx, args): Promise<DomainCheckResult> => {
    const domain: DomainCheckRecord = await ctx.runQuery(
      internal.domains.getForCheck,
      args,
    );
    const result = await verifyDomainConnection(ctx, args.domainId, domain);
    if (!result.verified) {
      await queueAutomaticVerification(ctx, args.domainId);
    }
    return result;
  },
});

export const listConnections = query({
  args: {},
  returns: v.array(
    v.object({
      provider: v.union(v.literal("cloudflare"), v.literal("vercel")),
      accountId: v.optional(v.string()),
      accountName: v.optional(v.string()),
      connectedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("dnsProviderConnections")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(20);
    return rows.map((row) => ({
      provider: row.provider,
      accountId: row.accountId,
      accountName: row.accountName,
      connectedAt: row.createdAt,
    }));
  },
});

export const platformStatus = query({
  args: {},
  returns: v.object({
    vercelRoutingConfigured: v.boolean(),
  }),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return { vercelRoutingConfigured: false };
    return {
      vercelRoutingConfigured: Boolean(
        process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID,
      ),
    };
  },
});

export const saveConnection = internalMutation({
  args: {
    provider: v.union(v.literal("cloudflare"), v.literal("vercel")),
    encryptedAccessToken: v.string(),
    accountId: v.optional(v.string()),
    accountName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const existing = await ctx.db
      .query("dnsProviderConnections")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", args.provider),
      )
      .first();
    const values = {
      encryptedAccessToken: args.encryptedAccessToken,
      accountId: args.accountId,
      accountName: args.accountName,
      updatedAt: Date.now(),
    };
    if (existing) await ctx.db.patch(existing._id, values);
    else {
      await ctx.db.insert("dnsProviderConnections", {
        userId: user._id,
        provider: args.provider,
        ...values,
        createdAt: Date.now(),
      });
    }
    return null;
  },
});

export const getConnectionForAction = internalQuery({
  args: {
    provider: v.union(v.literal("cloudflare"), v.literal("vercel")),
  },
  returns: v.union(
    v.null(),
    v.object({
      encryptedAccessToken: v.string(),
      accountId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const row = await ctx.db
      .query("dnsProviderConnections")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", args.provider),
      )
      .first();
    return row
      ? {
          encryptedAccessToken: row.encryptedAccessToken,
          accountId: row.accountId,
        }
      : null;
  },
});

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

async function encryptSecret(secret: string) {
  const rawKey = process.env.DNS_CREDENTIAL_ENCRYPTION_KEY;
  if (!rawKey)
    throw new ConvexError("DNS credential encryption is not configured");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawKey),
  );
  const key = await crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(secret),
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function decryptSecret(payload: string) {
  const rawKey = process.env.DNS_CREDENTIAL_ENCRYPTION_KEY;
  if (!rawKey)
    throw new ConvexError("DNS credential encryption is not configured");
  const [ivValue, encryptedValue] = payload.split(".");
  if (!ivValue || !encryptedValue)
    throw new ConvexError("Stored provider credential is invalid");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawKey),
  );
  const key = await crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "decrypt",
  ]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivValue) },
    key,
    base64ToBytes(encryptedValue),
  );
  return new TextDecoder().decode(decrypted);
}

async function providerToken(
  ctx: ActionCtx,
  provider: "cloudflare" | "vercel",
): Promise<string> {
  // Project routing is infrastructure-owned. Never let a workspace-scoped
  // credential override the W-AI Vercel project token.
  if (provider === "vercel" && process.env.VERCEL_TOKEN)
    return process.env.VERCEL_TOKEN;
  const connection: {
    encryptedAccessToken: string;
    accountId?: string;
  } | null = await ctx.runQuery(internal.domains.getConnectionForAction, {
    provider,
  });
  if (connection) return decryptSecret(connection.encryptedAccessToken);
  throw new ConvexError(
    `Connect ${provider === "cloudflare" ? "Cloudflare" : "Vercel"} first`,
  );
}

type CloudflareEnvelope<T> = {
  success: boolean;
  result: T;
  errors?: Array<{ message?: string }>;
};

async function cloudflareRequest<T>(
  token: string,
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await response.json()) as CloudflareEnvelope<T>;
  if (!response.ok || !body.success) {
    throw new ConvexError(
      body.errors?.[0]?.message ??
        `Cloudflare request failed (${response.status})`,
    );
  }
  return body.result;
}

async function findCloudflareZone(token: string, hostname: string) {
  const labels = hostname.split(".");
  for (let start = 0; start < labels.length - 1; start += 1) {
    const candidate = labels.slice(start).join(".");
    const zones = await cloudflareRequest<Array<{ id: string; name: string }>>(
      token,
      `/zones?name=${encodeURIComponent(candidate)}&per_page=1`,
    );
    if (zones[0]) return zones[0];
  }
  throw new ConvexError(
    "This domain is not available in the connected Cloudflare account",
  );
}

async function upsertCloudflareRecord(
  token: string,
  zoneId: string,
  record: {
    type: string;
    name: string;
    content: string;
    ttl?: number;
    proxied?: boolean;
  },
) {
  const records = await cloudflareRequest<Array<{ id: string }>>(
    token,
    `/zones/${zoneId}/dns_records?type=${record.type}&name=${encodeURIComponent(record.name)}&per_page=1`,
  );
  const path = records[0]
    ? `/zones/${zoneId}/dns_records/${records[0].id}`
    : `/zones/${zoneId}/dns_records`;
  return cloudflareRequest<{ id: string }>(token, path, {
    method: records[0] ? "PUT" : "POST",
    body: JSON.stringify({ ttl: 1, ...record }),
  });
}

type VercelDnsRecord = {
  id: string;
  type: string;
  name: string;
  value: string;
  ttl?: number;
};

async function vercelRequest<T>(
  token: string,
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new ConvexError(
      body.error?.message ?? `Vercel request failed (${response.status})`,
    );
  }
  return body;
}

async function findVercelDnsScope(token: string, zone: string) {
  const teamsBody = await vercelRequest<{
    teams: Array<{ id: string; slug?: string; name?: string }>;
  }>(token, "/v2/teams?limit=100");
  const preferred = process.env.VERCEL_TEAM_ID;
  const teams = [...teamsBody.teams].sort((a, b) =>
    a.id === preferred ? -1 : b.id === preferred ? 1 : 0,
  );
  for (const team of teams) {
    const response = await fetch(
      `https://api.vercel.com/v5/domains/${encodeURIComponent(zone)}?teamId=${team.id}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (response.ok) return { zone, teamId: team.id };
    if (response.status !== 403 && response.status !== 404) {
      const body = (await response.json()) as { error?: { message?: string } };
      throw new ConvexError(body.error?.message ?? `Could not inspect ${zone}`);
    }
  }
  const personal = await fetch(
    `https://api.vercel.com/v5/domains/${encodeURIComponent(zone)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (personal.ok) return { zone, teamId: undefined };
  throw new ConvexError(
    `${zone} is not managed by an accessible Vercel account`,
  );
}

function vercelDnsName(fullName: string, zone: string) {
  const normalized = fullName.toLowerCase().replace(/\.$/, "");
  if (normalized === zone) return "@";
  const suffix = `.${zone}`;
  if (!normalized.endsWith(suffix)) {
    throw new ConvexError(`DNS record must be inside ${zone}`);
  }
  return normalized.slice(0, -suffix.length);
}

function fullVercelDnsName(name: string, zone: string) {
  return name === "@" || name === "" ? zone : `${name}.${zone}`;
}

async function listVercelDnsRecords(
  token: string,
  zone: string,
  teamId?: string,
) {
  const query = new URLSearchParams({ limit: "100" });
  if (teamId) query.set("teamId", teamId);
  const body = await vercelRequest<{ records: VercelDnsRecord[] }>(
    token,
    `/v4/domains/${encodeURIComponent(zone)}/records?${query}`,
  );
  return body.records;
}

async function upsertVercelDnsRecord(
  token: string,
  scope: { zone: string; teamId?: string },
  record: { type: string; name: string; value: string; ttl?: number },
) {
  const relativeName = vercelDnsName(record.name, scope.zone);
  const records = await listVercelDnsRecords(token, scope.zone, scope.teamId);
  const existing = records.find(
    (item) => item.type === record.type && item.name === relativeName,
  );
  const teamQuery = scope.teamId ? `?teamId=${scope.teamId}` : "";
  if (existing) {
    return vercelRequest<VercelDnsRecord>(
      token,
      `/v1/domains/records/${existing.id}${teamQuery}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: relativeName,
          type: record.type,
          value: record.value,
          ttl: record.ttl ?? 60,
        }),
      },
    );
  }
  return vercelRequest<VercelDnsRecord>(
    token,
    `/v2/domains/${encodeURIComponent(scope.zone)}/records${teamQuery}`,
    {
      method: "POST",
      body: JSON.stringify({
        name: relativeName,
        type: record.type,
        value: record.value,
        ttl: record.ttl ?? 60,
      }),
    },
  );
}

function assertDnsNameWithinDomain(name: string, hostname: string) {
  const normalized = name.trim().toLowerCase().replace(/\.$/, "");
  if (
    !normalized ||
    normalized.includes("..") ||
    !/^[a-z0-9_*.-]+$/.test(normalized)
  ) {
    throw new ConvexError("Invalid DNS record name");
  }
  if (normalized !== hostname && !normalized.endsWith(`.${hostname}`)) {
    throw new ConvexError(
      `DNS record must be ${hostname} or a subdomain of it`,
    );
  }
  return normalized;
}

type DomainRedirectCandidate = {
  _id: Id<"domains">;
  orgId: Id<"organizations">;
  hostname: string;
  verified: boolean;
  redirectTo?: string;
};

export function assertDomainRedirectTransition(
  source: DomainRedirectCandidate,
  target: DomainRedirectCandidate | null,
) {
  if (!target) return;
  if (!source.verified) {
    throw new ConvexError(
      "Verify the source domain before redirecting its traffic",
    );
  }
  if (target.orgId !== source.orgId) {
    throw new ConvexError(
      "Redirects can only target a domain assigned to the same site",
    );
  }
  if (target._id === source._id) {
    throw new ConvexError("A domain cannot redirect to itself");
  }
  if (target.redirectTo) {
    throw new ConvexError(
      "Choose a serving domain, not another redirect, as the target",
    );
  }
  if (!target.verified) {
    throw new ConvexError(
      "Verify the destination domain before redirecting traffic to it",
    );
  }
}

export const setRedirect = action({
  args: {
    domainId: v.id("domains"),
    targetDomainId: v.optional(v.id("domains")),
    statusCode: v.optional(redirectStatusValidator),
  },
  returns: v.object({ message: v.string() }),
  handler: async (ctx, args): Promise<{ message: string }> => {
    const source = await ctx.runQuery(internal.domains.getForCheck, {
      domainId: args.domainId,
    });
    const target = args.targetDomainId
      ? await ctx.runQuery(internal.domains.getForCheck, {
          domainId: args.targetDomainId,
        })
      : null;

    assertDomainRedirectTransition(source, target);
    if (target) {
      const dependencies = await ctx.runQuery(
        internal.domains.getTransitionDependencies,
        { domainId: source._id },
      );
      const blocker = domainTransitionBlockerMessage(
        dependencies.redirectingHostnames,
        dependencies.scopedRedirectPaths,
        "redirecting",
      );
      if (blocker) throw new ConvexError(blocker);
    }

    const token = await providerToken(ctx, "vercel");
    const projectId = process.env.VERCEL_PROJECT_ID;
    if (!projectId)
      throw new ConvexError("Vercel project routing is not configured");
    const teamId = process.env.VERCEL_TEAM_ID;
    const query = teamId ? `?teamId=${teamId}` : "";
    const statusCode = target ? (args.statusCode ?? 308) : undefined;

    await vercelRequest(
      token,
      `/v9/projects/${projectId}/domains/${encodeURIComponent(source.hostname)}${query}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          redirect: target?.hostname ?? null,
          redirectStatusCode: statusCode ?? null,
        }),
      },
    );
    await ctx.runMutation(internal.domains.saveRedirectState, {
      domainId: source._id,
      redirectTo: target?.hostname,
      redirectStatusCode: statusCode,
    });
    return {
      message: target
        ? `${source.hostname} now redirects to ${target.hostname}`
        : `${source.hostname} now serves the site directly`,
    };
  },
});

async function queueAutomaticVerification(
  ctx: ActionCtx,
  domainId: Id<"domains">,
) {
  const delay = 30 * 1000;
  const runId = randomToken(12);
  await ctx.runMutation(internal.domains.saveAutomaticCheckSchedule, {
    domainId,
    attempt: 0,
    runId,
    nextVerificationAt: Date.now() + delay,
  });
  await ctx.scheduler.runAfter(delay, internal.domainVerification.check, {
    domainId,
    attempt: 0,
    runId,
  });
}

export const provision = action({
  args: { domainId: v.id("domains"), provider: providerValidator },
  returns: v.object({ message: v.string() }),
  handler: async (ctx, args): Promise<{ message: string }> => {
    const domain: {
      _id: Id<"domains">;
      hostname: string;
      verificationToken: string;
      cnameTarget: string;
      apexTarget: string;
      routingType: "A" | "CNAME";
      provider: "manual" | "cloudflare" | "vercel";
      dnsZone?: string;
      dnsTeamId?: string;
      platformVerification: Array<{
        type: string;
        domain: string;
        value: string;
        reason?: string;
      }>;
    } = await ctx.runQuery(internal.domains.getForCheck, {
      domainId: args.domainId,
    });

    if (args.provider === "cloudflare") {
      const token = await providerToken(ctx, "cloudflare");
      const zone = await findCloudflareZone(token, domain.hostname);
      const apex = domain.routingType === "A";
      await upsertCloudflareRecord(token, zone.id, {
        type: apex ? "A" : "CNAME",
        name: domain.hostname,
        content: apex ? domain.apexTarget : domain.cnameTarget,
        proxied: false,
      });
      await upsertCloudflareRecord(token, zone.id, {
        type: "TXT",
        name: `_w-ai-verify.${domain.hostname}`,
        content: domain.verificationToken,
      });
      for (const record of domain.platformVerification) {
        await upsertCloudflareRecord(token, zone.id, {
          type: record.type,
          name: assertDnsNameWithinDomain(record.domain, domain.hostname),
          content: record.value,
          proxied: false,
        });
      }
      await ctx.runMutation(internal.domains.savePlatformState, {
        domainId: args.domainId,
        status: "configuring",
        provider: "cloudflare",
        dnsZone: zone.name,
        routingType: domain.routingType,
        platformVerification: domain.platformVerification,
      });
      await queueAutomaticVerification(ctx, args.domainId);
      return {
        message: `Cloudflare routing and ownership records were created in ${zone.name}`,
      };
    }

    if (args.provider === "vercel") {
      const token = await providerToken(ctx, "vercel");
      const projectId = process.env.VERCEL_PROJECT_ID;
      if (!projectId)
        throw new ConvexError("Vercel project routing is not configured");
      const teamId = process.env.VERCEL_TEAM_ID;
      const response = await fetch(
        `https://api.vercel.com/v10/projects/${projectId}/domains${teamId ? `?teamId=${teamId}` : ""}`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ name: domain.hostname }),
        },
      );
      let body = (await response.json()) as {
        name?: string;
        apexName?: string;
        projectId?: string;
        verified?: boolean;
        verification?: Array<{
          type: string;
          domain: string;
          value: string;
          reason?: string;
        }>;
        error?: { message?: string };
      };
      if (!response.ok && response.status !== 409) {
        throw new ConvexError(
          body.error?.message ?? `Vercel request failed (${response.status})`,
        );
      }
      if (response.status === 409) {
        const current = await fetch(
          `https://api.vercel.com/v9/projects/${projectId}/domains/${encodeURIComponent(domain.hostname)}${teamId ? `?teamId=${teamId}` : ""}`,
          { headers: { authorization: `Bearer ${token}` } },
        );
        if (!current.ok) {
          const currentBody = (await current.json()) as {
            error?: { message?: string };
          };
          throw new ConvexError(
            currentBody.error?.message ??
              "Could not read the existing Vercel domain",
          );
        }
        body = (await current.json()) as typeof body;
      }
      const routingType = body.apexName
        ? body.name === body.apexName
          ? "A"
          : "CNAME"
        : domain.routingType;
      const configQuery = new URLSearchParams({ projectIdOrName: projectId });
      if (teamId) configQuery.set("teamId", teamId);
      const domainConfig = await vercelRequest<VercelDomainConfiguration>(
        token,
        `/v6/domains/${encodeURIComponent(domain.hostname)}/config?${configQuery}`,
      );
      const routingTargets = preferredVercelDnsTargets(domainConfig, {
        cnameTarget: domain.cnameTarget,
        apexTarget: domain.apexTarget,
      });
      let dnsScope: { zone: string; teamId?: string } | undefined;
      if (domain.provider === "vercel") {
        dnsScope = await findVercelDnsScope(
          token,
          body.apexName ?? domain.dnsZone ?? registrableDomain(domain.hostname),
        );
      }
      await ctx.runMutation(internal.domains.savePlatformState, {
        domainId: args.domainId,
        status: "configuring",
        providerDomainId: body.projectId,
        dnsZone: dnsScope?.zone,
        dnsTeamId: dnsScope?.teamId,
        routingType,
        cnameTarget: routingTargets.cnameTarget,
        apexTarget: routingTargets.apexTarget,
        platformVerified: body.verified ?? false,
        platformVerification: body.verification ?? [],
      });
      await queueAutomaticVerification(ctx, args.domainId);
      if (dnsScope) {
        await upsertVercelDnsRecord(token, dnsScope, {
          type: routingType,
          name: domain.hostname,
          value:
            routingType === "A"
              ? routingTargets.apexTarget
              : routingTargets.cnameTarget,
        });
        await upsertVercelDnsRecord(token, dnsScope, {
          type: "TXT",
          name: `_w-ai-verify.${domain.hostname}`,
          value: domain.verificationToken,
        });
        for (const record of body.verification ?? []) {
          await upsertVercelDnsRecord(token, dnsScope, {
            type: record.type,
            name: record.domain,
            value: record.value,
          });
        }
        return {
          message: `Hostname attached and Vercel DNS records created in ${dnsScope.zone}`,
        };
      }
      return { message: "Hostname attached to the Vercel project" };
    }

    await queueAutomaticVerification(ctx, args.domainId);
    return { message: "Manual DNS instructions are ready" };
  },
});

export const detach = action({
  args: { domainId: v.id("domains") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const dependencies = await ctx.runQuery(
      internal.domains.getTransitionDependencies,
      args,
    );
    const blocker = domainTransitionBlockerMessage(
      dependencies.redirectingHostnames,
      dependencies.scopedRedirectPaths,
      "detaching",
    );
    if (blocker) throw new ConvexError(blocker);
    const domain: {
      hostname: string;
      provider: "manual" | "cloudflare" | "vercel";
      dnsZone?: string;
      dnsTeamId?: string;
      routingType: "A" | "CNAME";
      cnameTarget: string;
      apexTarget: string;
      verificationToken: string;
      platformVerification: Array<{
        type: string;
        domain: string;
        value: string;
      }>;
    } = await ctx.runQuery(internal.domains.getForCheck, args);
    const token = await providerToken(ctx, "vercel");
    const projectId = process.env.VERCEL_PROJECT_ID;
    const teamId = process.env.VERCEL_TEAM_ID;
    if (projectId) {
      const response = await fetch(
        `https://api.vercel.com/v9/projects/${projectId}/domains/${encodeURIComponent(domain.hostname)}${teamId ? `?teamId=${teamId}` : ""}`,
        { method: "DELETE", headers: { authorization: `Bearer ${token}` } },
      );
      if (!response.ok && response.status !== 404) {
        const body = (await response.json()) as {
          error?: { message?: string };
        };
        throw new ConvexError(
          body.error?.message ?? `Vercel detach failed (${response.status})`,
        );
      }
    }
    const managedRecords = [
      {
        type: domain.routingType,
        name: domain.hostname,
        value:
          domain.routingType === "A" ? domain.apexTarget : domain.cnameTarget,
      },
      {
        type: "TXT",
        name: `_w-ai-verify.${domain.hostname}`,
        value: domain.verificationToken,
      },
      ...domain.platformVerification.map((record) => ({
        type: record.type,
        name: record.domain,
        value: record.value,
      })),
    ];
    if (domain.provider === "vercel") {
      const scope = domain.dnsZone
        ? { zone: domain.dnsZone, teamId: domain.dnsTeamId }
        : await findVercelDnsScope(token, registrableDomain(domain.hostname));
      const records = await listVercelDnsRecords(
        token,
        scope.zone,
        scope.teamId,
      );
      const teamQuery = scope.teamId ? `?teamId=${scope.teamId}` : "";
      for (const record of records) {
        const fullName = fullVercelDnsName(record.name, scope.zone);
        if (
          managedRecords.some(
            (managed) =>
              managed.type === record.type &&
              managed.name === fullName &&
              managed.value.replace(/\.$/, "") ===
                record.value.replace(/\.$/, ""),
          )
        ) {
          await vercelRequest(
            token,
            `/v2/domains/${encodeURIComponent(scope.zone)}/records/${record.id}${teamQuery}`,
            { method: "DELETE" },
          );
        }
      }
    } else if (domain.provider === "cloudflare") {
      const cloudflareToken = await providerToken(ctx, "cloudflare");
      const zone = await findCloudflareZone(cloudflareToken, domain.hostname);
      const records = await cloudflareRequest<
        Array<{
          id: string;
          type: string;
          name: string;
          content: string;
        }>
      >(cloudflareToken, `/zones/${zone.id}/dns_records?per_page=100`);
      for (const record of records) {
        if (
          managedRecords.some(
            (managed) =>
              managed.type === record.type &&
              managed.name === record.name &&
              managed.value.replace(/\.$/, "") ===
                record.content.replace(/\.$/, ""),
          )
        ) {
          await cloudflareRequest(
            cloudflareToken,
            `/zones/${zone.id}/dns_records/${record.id}`,
            { method: "DELETE" },
          );
        }
      }
    }
    await ctx.runMutation(internal.domains.deleteAfterDetach, args);
    return null;
  },
});

export const deleteAfterDetach = internalMutation({
  args: { domainId: v.id("domains") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) return null;
    const { user } = await requireAdmin(ctx, domain.orgId);
    await ctx.db.delete(domain._id);
    await logEvent(ctx, {
      orgId: domain.orgId,
      userId: user._id,
      type: "domain.detach",
      title: `Domain detached: ${domain.hostname}`,
    });
    return null;
  },
});

const dnsRecordTypeValidator = v.union(
  v.literal("A"),
  v.literal("AAAA"),
  v.literal("CNAME"),
  v.literal("TXT"),
  v.literal("MX"),
  v.literal("CAA"),
);

const dnsWritableRecordTypeValidator = v.union(
  v.literal("A"),
  v.literal("AAAA"),
  v.literal("CNAME"),
  v.literal("TXT"),
  v.literal("CAA"),
);

const dnsRecordValidator = v.object({
  id: v.string(),
  type: dnsRecordTypeValidator,
  name: v.string(),
  content: v.string(),
  ttl: v.number(),
  proxied: v.optional(v.boolean()),
  managed: v.boolean(),
});

type DnsRecord = {
  id: string;
  type: "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "CAA";
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  managed: boolean;
};

export const listDnsRecords = action({
  args: { domainId: v.id("domains") },
  returns: v.array(dnsRecordValidator),
  handler: async (ctx, args): Promise<DnsRecord[]> => {
    const domain: {
      hostname: string;
      provider: "manual" | "cloudflare" | "vercel";
      dnsZone?: string;
      dnsTeamId?: string;
      routingType: "A" | "CNAME";
      platformVerification: Array<{ type: string; domain: string }>;
    } = await ctx.runQuery(internal.domains.getForCheck, args);
    if (domain.provider === "vercel") {
      const token = await providerToken(ctx, "vercel");
      const scope = domain.dnsZone
        ? { zone: domain.dnsZone, teamId: domain.dnsTeamId }
        : await findVercelDnsScope(token, registrableDomain(domain.hostname));
      const records = await listVercelDnsRecords(
        token,
        scope.zone,
        scope.teamId,
      );
      const supported = new Set(["A", "AAAA", "CNAME", "TXT", "MX", "CAA"]);
      return records
        .map((record) => ({
          ...record,
          fullName: fullVercelDnsName(record.name, scope.zone),
        }))
        .filter(
          (record) =>
            supported.has(record.type) &&
            (record.fullName === domain.hostname ||
              record.fullName.endsWith(`.${domain.hostname}`)),
        )
        .map((record) => ({
          id: record.id,
          type: record.type as DnsRecord["type"],
          name: record.fullName,
          content: record.value,
          ttl: record.ttl ?? 60,
          managed: isPlatformManagedDnsRecord(
            { type: record.type, name: record.fullName },
            domain,
          ),
        }));
    }
    if (domain.provider !== "cloudflare") {
      throw new ConvexError(
        "Choose Cloudflare or Vercel DNS to manage records here",
      );
    }
    const token: string = await providerToken(ctx, "cloudflare");
    const zone = await findCloudflareZone(token, domain.hostname);
    const records: Array<{
      id: string;
      type: string;
      name: string;
      content: string;
      ttl: number;
      proxied?: boolean;
    }> = await cloudflareRequest<
      Array<{
        id: string;
        type: string;
        name: string;
        content: string;
        ttl: number;
        proxied?: boolean;
      }>
    >(token, `/zones/${zone.id}/dns_records?per_page=100`);
    const supported = new Set(["A", "AAAA", "CNAME", "TXT", "MX", "CAA"]);
    return records
      .filter(
        (record) =>
          supported.has(record.type) &&
          (record.name === domain.hostname ||
            record.name.endsWith(`.${domain.hostname}`)),
      )
      .map((record) => ({
        id: record.id,
        type: record.type as "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "CAA",
        name: record.name,
        content: record.content,
        ttl: record.ttl,
        proxied: record.proxied,
        managed: isPlatformManagedDnsRecord(record, domain),
      }));
  },
});

export const saveDnsRecord = action({
  args: {
    domainId: v.id("domains"),
    recordId: v.optional(v.string()),
    type: dnsWritableRecordTypeValidator,
    name: v.string(),
    content: v.string(),
    ttl: v.number(),
    proxied: v.optional(v.boolean()),
  },
  returns: dnsRecordValidator,
  handler: async (ctx, args): Promise<DnsRecord> => {
    const domain: {
      hostname: string;
      provider: "manual" | "cloudflare" | "vercel";
      dnsZone?: string;
      dnsTeamId?: string;
      routingType: "A" | "CNAME";
      platformVerification: Array<{ type: string; domain: string }>;
    } = await ctx.runQuery(internal.domains.getForCheck, {
      domainId: args.domainId,
    });
    const recordName = assertDnsNameWithinDomain(args.name, domain.hostname);
    const validated = validateDnsRecordInput(args);
    if (
      isPlatformManagedDnsRecord({ type: args.type, name: recordName }, domain)
    ) {
      throw new ConvexError(
        "This record is managed by W-AI routing and cannot be changed here",
      );
    }
    if (domain.provider === "vercel") {
      const token = await providerToken(ctx, "vercel");
      const scope = domain.dnsZone
        ? { zone: domain.dnsZone, teamId: domain.dnsTeamId }
        : await findVercelDnsScope(token, registrableDomain(domain.hostname));
      const teamQuery = scope.teamId ? `?teamId=${scope.teamId}` : "";
      let record: VercelDnsRecord;
      if (validated.recordId) {
        const existingRecords = await listVercelDnsRecords(
          token,
          scope.zone,
          scope.teamId,
        );
        const existing = existingRecords.find(
          (candidate) => candidate.id === validated.recordId,
        );
        if (!existing)
          throw new ConvexError("DNS record was not found in this domain");
        const existingName = fullVercelDnsName(existing.name, scope.zone);
        if (!dnsNameBelongsToHostname(existingName, domain.hostname)) {
          throw new ConvexError("DNS record does not belong to this domain");
        }
        if (
          isPlatformManagedDnsRecord(
            { type: existing.type, name: existingName },
            domain,
          )
        ) {
          throw new ConvexError(
            "This record is managed by W-AI routing and cannot be changed here",
          );
        }
        record = await vercelRequest<VercelDnsRecord>(
          token,
          `/v1/domains/records/${validated.recordId}${teamQuery}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              name: vercelDnsName(recordName, scope.zone),
              type: args.type,
              value: validated.content,
              ttl: Math.max(60, args.ttl),
            }),
          },
        );
      } else {
        record = await upsertVercelDnsRecord(token, scope, {
          type: args.type,
          name: recordName,
          value: validated.content,
          ttl: Math.max(60, args.ttl),
        });
      }
      return {
        id: record.id,
        type: record.type as DnsRecord["type"],
        name: fullVercelDnsName(record.name, scope.zone),
        content: record.value,
        ttl: record.ttl ?? 60,
        managed: false,
      };
    }
    if (domain.provider !== "cloudflare") {
      throw new ConvexError(
        "Choose Cloudflare or Vercel DNS to manage records here",
      );
    }
    const token = await providerToken(ctx, "cloudflare");
    const zone = await findCloudflareZone(token, domain.hostname);
    if (validated.recordId) {
      const existing = await cloudflareRequest<{
        id: string;
        type: string;
        name: string;
      }>(token, `/zones/${zone.id}/dns_records/${validated.recordId}`);
      if (!dnsNameBelongsToHostname(existing.name, domain.hostname)) {
        throw new ConvexError("DNS record does not belong to this domain");
      }
      if (isPlatformManagedDnsRecord(existing, domain)) {
        throw new ConvexError(
          "This record is managed by W-AI routing and cannot be changed here",
        );
      }
    }
    const path = validated.recordId
      ? `/zones/${zone.id}/dns_records/${validated.recordId}`
      : `/zones/${zone.id}/dns_records`;
    const record = await cloudflareRequest<{
      id: string;
      type: string;
      name: string;
      content: string;
      ttl: number;
      proxied?: boolean;
    }>(token, path, {
      method: validated.recordId ? "PUT" : "POST",
      body: JSON.stringify({
        type: args.type,
        name: recordName,
        content: validated.content,
        ttl: args.ttl,
        proxied: args.proxied ?? false,
      }),
    });
    return {
      id: record.id,
      type: record.type as "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "CAA",
      name: record.name,
      content: record.content,
      ttl: record.ttl,
      proxied: record.proxied,
      managed: false,
    };
  },
});

export const deleteDnsRecord = action({
  args: { domainId: v.id("domains"), recordId: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const domain: {
      hostname: string;
      provider: "manual" | "cloudflare" | "vercel";
      dnsZone?: string;
      dnsTeamId?: string;
      routingType: "A" | "CNAME";
      platformVerification: Array<{ type: string; domain: string }>;
    } = await ctx.runQuery(internal.domains.getForCheck, {
      domainId: args.domainId,
    });
    if (domain.provider === "vercel") {
      const token = await providerToken(ctx, "vercel");
      const scope = domain.dnsZone
        ? { zone: domain.dnsZone, teamId: domain.dnsTeamId }
        : await findVercelDnsScope(token, registrableDomain(domain.hostname));
      const teamQuery = scope.teamId ? `?teamId=${scope.teamId}` : "";
      const records = await listVercelDnsRecords(
        token,
        scope.zone,
        scope.teamId,
      );
      const existing = records.find(
        (candidate) => candidate.id === args.recordId.trim(),
      );
      if (!existing)
        throw new ConvexError("DNS record was not found in this domain");
      const existingName = fullVercelDnsName(existing.name, scope.zone);
      if (!dnsNameBelongsToHostname(existingName, domain.hostname)) {
        throw new ConvexError("DNS record does not belong to this domain");
      }
      if (
        isPlatformManagedDnsRecord(
          { type: existing.type, name: existingName },
          domain,
        )
      ) {
        throw new ConvexError(
          "This record is managed by W-AI routing and cannot be deleted",
        );
      }
      await vercelRequest(
        token,
        `/v2/domains/${encodeURIComponent(scope.zone)}/records/${args.recordId.trim()}${teamQuery}`,
        {
          method: "DELETE",
        },
      );
      return null;
    }
    if (domain.provider !== "cloudflare") {
      throw new ConvexError(
        "Choose Cloudflare or Vercel DNS to manage records here",
      );
    }
    const token = await providerToken(ctx, "cloudflare");
    const zone = await findCloudflareZone(token, domain.hostname);
    const existing = await cloudflareRequest<{
      id: string;
      type: string;
      name: string;
    }>(token, `/zones/${zone.id}/dns_records/${args.recordId}`);
    if (!dnsNameBelongsToHostname(existing.name, domain.hostname)) {
      throw new ConvexError("DNS record does not belong to this domain");
    }
    if (isPlatformManagedDnsRecord(existing, domain)) {
      throw new ConvexError(
        "This record is managed by W-AI routing and cannot be deleted",
      );
    }
    await cloudflareRequest(
      token,
      `/zones/${zone.id}/dns_records/${args.recordId}`,
      {
        method: "DELETE",
      },
    );
    return null;
  },
});

export const connectProvider = action({
  args: {
    provider: v.union(v.literal("cloudflare"), v.literal("vercel")),
    accessToken: v.string(),
    accountId: v.optional(v.string()),
  },
  returns: v.object({
    accountId: v.optional(v.string()),
    accountName: v.string(),
  }),
  handler: async (ctx, args) => {
    const token = args.accessToken.trim();
    if (!token) throw new ConvexError("Access token is required");
    let accountId = args.accountId?.trim() || undefined;
    let accountName = args.provider === "cloudflare" ? "Cloudflare" : "Vercel";
    if (args.provider === "cloudflare") {
      const verification = await fetch(
        "https://api.cloudflare.com/client/v4/user/tokens/verify",
        {
          headers: { authorization: `Bearer ${token}` },
        },
      );
      if (!verification.ok)
        throw new ConvexError("Cloudflare rejected this API token");
      const accountsResponse = await fetch(
        "https://api.cloudflare.com/client/v4/accounts?per_page=50",
        {
          headers: { authorization: `Bearer ${token}` },
        },
      );
      if (accountsResponse.ok) {
        const body = (await accountsResponse.json()) as {
          result?: Array<{ id: string; name: string }>;
        };
        const account = accountId
          ? body.result?.find((item) => item.id === accountId)
          : body.result?.[0];
        accountId = account?.id ?? accountId;
        accountName = account?.name ?? accountName;
      }
    } else {
      const response = await fetch("https://api.vercel.com/v2/user", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok)
        throw new ConvexError("Vercel rejected this access token");
      const body = (await response.json()) as {
        user?: { id?: string; username?: string; name?: string };
      };
      accountId = body.user?.id;
      accountName = body.user?.name ?? body.user?.username ?? accountName;
    }
    const encryptedAccessToken = await encryptSecret(token);
    await ctx.runMutation(internal.domains.saveConnection, {
      provider: args.provider,
      encryptedAccessToken,
      accountId,
      accountName,
    });
    return { accountId, accountName };
  },
});
