import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { logEvent, requireAdmin } from "./helpers";

type RedirectReadCtx = Pick<QueryCtx, "db">;

const statusCodeValidator = v.union(v.literal(307), v.literal(308));
const matchTypeValidator = v.union(v.literal("exact"), v.literal("prefix"));

const redirectRuleValidator = v.object({
  _id: v.id("redirectRules"),
  orgId: v.id("organizations"),
  hostname: v.optional(v.string()),
  matchType: matchTypeValidator,
  sourcePath: v.string(),
  destination: v.string(),
  statusCode: statusCodeValidator,
  preserveQuery: v.boolean(),
  enabled: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const resolvedRedirectValidator = v.union(
  v.null(),
  v.object({
    destination: v.string(),
    statusCode: v.union(
      v.literal(301),
      v.literal(302),
      v.literal(307),
      v.literal(308),
    ),
    preserveQuery: v.boolean(),
  }),
);

function normalizeHost(host: string) {
  return host.trim().toLowerCase().split(":")[0].replace(/\.$/, "");
}

function normalizeSourcePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    throw new ConvexError("Source must be a site path beginning with /");
  }
  if (trimmed.includes("?") || trimmed.includes("#")) {
    throw new ConvexError(
      "Source paths cannot contain a query string or fragment",
    );
  }
  const normalized = trimmed.replace(/\/{2,}/g, "/");
  return normalized.length > 1 ? normalized.replace(/\/$/, "") : normalized;
}

function normalizeDestination(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    const parsed = new URL(trimmed, "https://redirect.invalid");
    const pathname = normalizeSourcePath(parsed.pathname);
    return `${pathname}${parsed.search}${parsed.hash}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ConvexError(
      "Destination must be a site path or a complete HTTPS URL",
    );
  }
  if (parsed.protocol !== "https:") {
    throw new ConvexError("External redirect destinations must use HTTPS");
  }
  return parsed.toString();
}

function destinationPath(destination: string) {
  if (!destination.startsWith("/")) return null;
  return normalizeSourcePath(
    new URL(destination, "https://redirect.invalid").pathname,
  );
}

type RedirectState = { hostname: string; path: string };

function platformTenantRoots() {
  const configured = (process.env.PLATFORM_TENANT_DOMAINS ?? "")
    .split(",")
    .map((domain) => normalizeHost(domain))
    .filter(Boolean);
  return [
    ...new Set(["qentrah.com", "w-ai.online", "localhost", ...configured]),
  ];
}

const RESERVED_PLATFORM_SUBDOMAINS = new Set([
  "app",
  "www",
  "admin",
  "cms",
  "docs",
  "api",
  "billing",
]);

/** Returns a tenant slug only when the public hostname itself proves it. */
function platformTenantSlug(hostname: string) {
  for (const root of platformTenantRoots()) {
    const suffix = `.${root}`;
    if (!hostname.endsWith(suffix)) continue;
    const slug = hostname.slice(0, -suffix.length);
    if (!slug || slug.includes(".") || RESERVED_PLATFORM_SUBDOMAINS.has(slug)) {
      return null;
    }
    return slug;
  }
  return null;
}

async function internalDestinationState(
  ctx: RedirectReadCtx,
  orgId: Id<"organizations">,
  currentHostname: string,
  destination: string,
): Promise<RedirectState | null> {
  const relativePath = destinationPath(destination);
  if (relativePath) return { hostname: currentHostname, path: relativePath };

  const parsed = new URL(destination);
  const hostname = normalizeHost(parsed.hostname);
  const domain = await ctx.db
    .query("domains")
    .withIndex("by_hostname", (q) => q.eq("hostname", hostname))
    .first();
  if (domain?.verified && domain.orgId === orgId) {
    return {
      hostname: domain.redirectTo ?? hostname,
      path: normalizeSourcePath(parsed.pathname),
    };
  }

  const org = await ctx.db.get(orgId);
  if (
    org &&
    platformTenantRoots().some((root) => hostname === `${org.slug}.${root}`)
  ) {
    return { hostname, path: normalizeSourcePath(parsed.pathname) };
  }
  return null;
}

async function redirectScopes(
  ctx: RedirectReadCtx,
  orgId: Id<"organizations">,
  hostname: string | undefined,
) {
  if (hostname) return [hostname];
  const org = await ctx.db.get(orgId);
  if (!org) throw new ConvexError("Site not found");
  const domains = await ctx.db
    .query("domains")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(500);
  return [
    ...new Set([
      ...platformTenantRoots().map((root) => `${org.slug}.${root}`),
      ...domains
        .filter((domain) => domain.verified && !domain.redirectTo)
        .map((domain) => domain.hostname),
    ]),
  ];
}

function applyPrefixDestination(
  destination: string,
  sourcePath: string,
  requestPath: string,
) {
  const suffix = requestPath.slice(sourcePath.length).replace(/^\//, "");
  if (destination.includes(":splat")) {
    return destination.replaceAll(":splat", suffix);
  }
  if (!suffix) return destination;
  if (destination.startsWith("/")) {
    const parsed = new URL(destination, "https://redirect.invalid");
    const basePath =
      parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    return `${basePath}/${suffix}${parsed.search}${parsed.hash}`;
  }
  const parsed = new URL(destination);
  parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/${suffix}`;
  return parsed.toString();
}

async function ruleForPath(
  ctx: RedirectReadCtx,
  orgId: Id<"organizations">,
  hostname: string | undefined,
  sourcePath: string,
  excludedId?: Id<"redirectRules">,
) {
  async function exactForScope(scope: string | undefined) {
    const candidates = await ctx.db
      .query("redirectRules")
      .withIndex("by_org_and_hostname_and_source_path", (q) =>
        q.eq("orgId", orgId).eq("hostname", scope).eq("sourcePath", sourcePath),
      )
      .collect();
    return (
      candidates.find(
        (rule) =>
          rule._id !== excludedId &&
          rule.enabled &&
          (rule.matchType ?? "exact") === "exact",
      ) ?? null
    );
  }

  if (hostname !== undefined) {
    const scopedExact = await exactForScope(hostname);
    if (scopedExact) return scopedExact;
  }
  const globalExact = await exactForScope(undefined);
  if (globalExact) return globalExact;

  const prefixSources = (() => {
    if (sourcePath === "/") return ["/"];
    const segments = sourcePath.split("/").filter(Boolean);
    const sources = segments.map(
      (_, index) => `/${segments.slice(0, segments.length - index).join("/")}`,
    );
    sources.push("/");
    return sources;
  })();
  async function prefixForScope(scope: string | undefined) {
    for (const prefixSource of prefixSources) {
      const candidate = await ctx.db
        .query("redirectRules")
        .withIndex("by_org_hostname_match_type_and_source_path", (q) =>
          q
            .eq("orgId", orgId)
            .eq("hostname", scope)
            .eq("matchType", "prefix")
            .eq("sourcePath", prefixSource),
        )
        .first();
      if (candidate && candidate._id !== excludedId && candidate.enabled) {
        return candidate;
      }
    }
    return null;
  }

  if (hostname !== undefined) {
    const scopedPrefix = await prefixForScope(hostname);
    if (scopedPrefix) return scopedPrefix;
  }
  return prefixForScope(undefined);
}

export async function assertHostname(
  ctx: RedirectReadCtx,
  orgId: Id<"organizations">,
  hostname: string | undefined,
) {
  if (!hostname) return undefined;
  const normalized = normalizeHost(hostname);
  const domain = await ctx.db
    .query("domains")
    .withIndex("by_hostname", (q) => q.eq("hostname", normalized))
    .first();
  if (!domain || domain.orgId !== orgId) {
    throw new ConvexError("This hostname is not assigned to the site");
  }
  if (!domain.verified) {
    throw new ConvexError(
      "Verify the hostname before creating redirects for it",
    );
  }
  if (domain.redirectTo) {
    throw new ConvexError(
      "Path redirects can only be scoped to a domain that serves this site",
    );
  }
  return normalized;
}

export async function assertNoDuplicateOrLoop(
  ctx: RedirectReadCtx,
  args: {
    orgId: Id<"organizations">;
    hostname?: string;
    matchType: "exact" | "prefix";
    sourcePath: string;
    destination: string;
    ruleId?: Id<"redirectRules">;
  },
) {
  async function hasDuplicate(matchType: "exact" | "prefix" | undefined) {
    const candidates = await ctx.db
      .query("redirectRules")
      .withIndex("by_org_hostname_match_type_and_source_path", (q) =>
        q
          .eq("orgId", args.orgId)
          .eq("hostname", args.hostname)
          .eq("matchType", matchType)
          .eq("sourcePath", args.sourcePath),
      )
      .take(2);
    return candidates.some((rule) => rule._id !== args.ruleId);
  }
  const duplicate =
    (await hasDuplicate(args.matchType)) ||
    (args.matchType === "exact" && (await hasDuplicate(undefined)));
  if (duplicate) {
    throw new ConvexError(
      "A redirect already exists for this path, hostname, and match type",
    );
  }

  const probePath =
    args.matchType === "prefix"
      ? `${args.sourcePath === "/" ? "" : args.sourcePath}/__w_ai_redirect_probe__`
      : args.sourcePath;
  const scopes = await redirectScopes(ctx, args.orgId, args.hostname);
  for (const originHostname of scopes) {
    const visited = new Set([`${originHostname}\n${probePath}`]);
    let state = await internalDestinationState(
      ctx,
      args.orgId,
      originHostname,
      args.matchType === "prefix"
        ? applyPrefixDestination(args.destination, args.sourcePath, probePath)
        : args.destination,
    );
    for (let depth = 0; depth < 12 && state; depth += 1) {
      const key = `${state.hostname}\n${state.path}`;
      if (visited.has(key)) {
        throw new ConvexError(
          depth === 0
            ? "A path cannot redirect to itself"
            : "This redirect would create a loop",
        );
      }
      visited.add(key);
      const nextRule = await ruleForPath(
        ctx,
        args.orgId,
        state.hostname,
        state.path,
        args.ruleId,
      );
      if (!nextRule) {
        state = null;
        break;
      }
      const nextDestination =
        nextRule.matchType === "prefix"
          ? applyPrefixDestination(
              nextRule.destination,
              nextRule.sourcePath,
              state.path,
            )
          : nextRule.destination;
      state = await internalDestinationState(
        ctx,
        args.orgId,
        state.hostname,
        nextDestination,
      );
    }
    if (state) throw new ConvexError("Redirect chains are limited to 12 steps");
  }
}

export const list = query({
  args: {
    orgId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(redirectRuleValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.orgId);
    const result = await ctx.db
      .query("redirectRules")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((rule) => ({
        _id: rule._id,
        orgId: rule.orgId,
        hostname: rule.hostname,
        matchType: rule.matchType ?? "exact",
        sourcePath: rule.sourcePath,
        destination: rule.destination,
        statusCode: rule.statusCode,
        preserveQuery: rule.preserveQuery,
        enabled: rule.enabled,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      })),
    };
  },
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    hostname: v.optional(v.string()),
    matchType: matchTypeValidator,
    sourcePath: v.string(),
    destination: v.string(),
    statusCode: statusCodeValidator,
    preserveQuery: v.boolean(),
  },
  returns: v.id("redirectRules"),
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx, args.orgId);
    const hostname = await assertHostname(ctx, args.orgId, args.hostname);
    const sourcePath = normalizeSourcePath(args.sourcePath);
    const destination = normalizeDestination(args.destination);
    await assertNoDuplicateOrLoop(ctx, {
      orgId: args.orgId,
      hostname,
      matchType: args.matchType,
      sourcePath,
      destination,
    });
    const now = Date.now();
    const redirectId = await ctx.db.insert("redirectRules", {
      orgId: args.orgId,
      hostname,
      matchType: args.matchType,
      sourcePath,
      destination,
      statusCode: args.statusCode,
      preserveQuery: args.preserveQuery,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    await logEvent(ctx, {
      orgId: args.orgId,
      userId: user._id,
      type: "redirect.create",
      title: `Redirect created: ${sourcePath}`,
      metadata: { hostname: hostname ?? "all", destination },
    });
    return redirectId;
  },
});

export const update = mutation({
  args: {
    redirectId: v.id("redirectRules"),
    hostname: v.optional(v.string()),
    matchType: matchTypeValidator,
    sourcePath: v.string(),
    destination: v.string(),
    statusCode: statusCodeValidator,
    preserveQuery: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.redirectId);
    if (!rule) throw new ConvexError("Redirect not found");
    const { user } = await requireAdmin(ctx, rule.orgId);
    const hostname = await assertHostname(ctx, rule.orgId, args.hostname);
    const sourcePath = normalizeSourcePath(args.sourcePath);
    const destination = normalizeDestination(args.destination);
    await assertNoDuplicateOrLoop(ctx, {
      orgId: rule.orgId,
      hostname,
      matchType: args.matchType,
      sourcePath,
      destination,
      ruleId: rule._id,
    });
    await ctx.db.patch(rule._id, {
      hostname,
      matchType: args.matchType,
      sourcePath,
      destination,
      statusCode: args.statusCode,
      preserveQuery: args.preserveQuery,
      updatedAt: Date.now(),
    });
    await logEvent(ctx, {
      orgId: rule.orgId,
      userId: user._id,
      type: "redirect.update",
      title: `Redirect updated: ${sourcePath}`,
      metadata: {
        previous: {
          hostname: rule.hostname ?? "all",
          matchType: rule.matchType ?? "exact",
          sourcePath: rule.sourcePath,
          destination: rule.destination,
          statusCode: rule.statusCode,
          preserveQuery: rule.preserveQuery,
        },
        next: {
          hostname: hostname ?? "all",
          matchType: args.matchType,
          sourcePath,
          destination,
          statusCode: args.statusCode,
          preserveQuery: args.preserveQuery,
        },
      },
    });
    return null;
  },
});

export const setEnabled = mutation({
  args: { redirectId: v.id("redirectRules"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.redirectId);
    if (!rule) throw new ConvexError("Redirect not found");
    const { user } = await requireAdmin(ctx, rule.orgId);
    if (args.enabled) {
      const hostname = await assertHostname(ctx, rule.orgId, rule.hostname);
      await assertNoDuplicateOrLoop(ctx, {
        orgId: rule.orgId,
        hostname,
        matchType: rule.matchType ?? "exact",
        sourcePath: rule.sourcePath,
        destination: rule.destination,
        ruleId: rule._id,
      });
    }
    await ctx.db.patch(rule._id, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
    await logEvent(ctx, {
      orgId: rule.orgId,
      userId: user._id,
      type: args.enabled ? "redirect.enable" : "redirect.disable",
      title: `${args.enabled ? "Redirect enabled" : "Redirect disabled"}: ${rule.sourcePath}`,
    });
    return null;
  },
});

export const remove = mutation({
  args: { redirectId: v.id("redirectRules") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.redirectId);
    if (!rule) throw new ConvexError("Redirect not found");
    const { user } = await requireAdmin(ctx, rule.orgId);
    await ctx.db.delete(rule._id);
    await logEvent(ctx, {
      orgId: rule.orgId,
      userId: user._id,
      type: "redirect.remove",
      title: `Redirect removed: ${rule.sourcePath}`,
    });
    return null;
  },
});

export const resolve = query({
  args: { slug: v.string(), host: v.string(), path: v.string() },
  returns: resolvedRedirectValidator,
  handler: async (ctx, args) => {
    const hostname = normalizeHost(args.host);
    const path = normalizeSourcePath(args.path);
    const hostSlug = platformTenantSlug(hostname);
    let org =
      hostSlug && hostSlug === args.slug
        ? await ctx.db
            .query("organizations")
            .withIndex("by_slug", (q) => q.eq("slug", hostSlug))
            .first()
        : null;
    const domain = await ctx.db
      .query("domains")
      .withIndex("by_hostname", (q) => q.eq("hostname", hostname))
      .first();

    if (domain?.verified) {
      if (org && org._id !== domain.orgId) return null;
      org = await ctx.db.get(domain.orgId);
    }
    if (!org || org.status === "suspended" || org.status === "deleted")
      return null;

    if (domain?.verified && domain.orgId === org._id && domain.redirectTo) {
      return {
        destination: `https://${domain.redirectTo}${path}`,
        statusCode: domain.redirectStatusCode ?? 308,
        preserveQuery: true,
      };
    }

    const rule = await ruleForPath(ctx, org._id, hostname, path);
    if (!rule) return null;
    const destination =
      rule.matchType === "prefix"
        ? applyPrefixDestination(rule.destination, rule.sourcePath, path)
        : rule.destination;
    return {
      destination,
      statusCode: rule.statusCode,
      preserveQuery: rule.preserveQuery,
    };
  },
});
