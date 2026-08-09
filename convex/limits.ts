import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type PlanId = "free" | "starter" | "pro" | "enterprise";

export type ResourceKind =
  | "pages"
  | "properties"
  | "posts"
  | "services"
  | "members"
  | "domains"
  | "assets"
  | "forms"
  | "mapLocations"
  | "orgs";

/**
 * Soft plan ceilings for the beta. Enterprise is effectively unlimited.
 * Values are product defaults — billing is still deferred; these only gate
 * create mutations so free-tier abuse stays bounded.
 */
export const PLAN_LIMITS: Record<
  PlanId,
  Record<Exclude<ResourceKind, "orgs">, number> & { orgs: number; assetBytes: number }
> = {
  free: {
    orgs: 1,
    pages: 12,
    properties: 25,
    posts: 25,
    services: 10,
    members: 3,
    domains: 1,
    assets: 50,
    forms: 5,
    mapLocations: 10,
    assetBytes: 100 * 1024 * 1024, // 100 MB
  },
  starter: {
    orgs: 3,
    pages: 40,
    properties: 100,
    posts: 100,
    services: 30,
    members: 10,
    domains: 3,
    assets: 200,
    forms: 20,
    mapLocations: 40,
    assetBytes: 500 * 1024 * 1024,
  },
  pro: {
    orgs: 10,
    pages: 200,
    properties: 500,
    posts: 500,
    services: 100,
    members: 50,
    domains: 10,
    assets: 1000,
    forms: 100,
    mapLocations: 200,
    assetBytes: 5 * 1024 * 1024 * 1024,
  },
  enterprise: {
    orgs: 1000,
    pages: 100_000,
    properties: 100_000,
    posts: 100_000,
    services: 100_000,
    members: 100_000,
    domains: 100_000,
    assets: 100_000,
    forms: 100_000,
    mapLocations: 100_000,
    assetBytes: 100 * 1024 * 1024 * 1024,
  },
};

export function planOf(plan: string | undefined): PlanId {
  if (plan === "starter" || plan === "pro" || plan === "enterprise") return plan;
  return "free";
}

type DbCtx = QueryCtx | MutationCtx;

async function countByOrg(
  ctx: DbCtx,
  table:
    | "pages"
    | "properties"
    | "posts"
    | "services"
    | "memberships"
    | "domains"
    | "assets"
    | "forms"
    | "mapLocations",
  orgId: Id<"organizations">,
): Promise<number> {
  switch (table) {
    case "pages":
      return (
        await ctx.db
          .query("pages")
          .withIndex("by_org_order", (q) => q.eq("orgId", orgId))
          .collect()
      ).length;
    case "properties":
      return (
        await ctx.db
          .query("properties")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).length;
    case "posts":
      return (
        await ctx.db
          .query("posts")
          .withIndex("by_org_created", (q) => q.eq("orgId", orgId))
          .collect()
      ).length;
    case "services":
      return (
        await ctx.db
          .query("services")
          .withIndex("by_org_order", (q) => q.eq("orgId", orgId))
          .collect()
      ).length;
    case "memberships":
      return (
        await ctx.db
          .query("memberships")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).length;
    case "domains":
      return (
        await ctx.db
          .query("domains")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).length;
    case "assets":
      return (
        await ctx.db
          .query("assets")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).length;
    case "forms":
      return (
        await ctx.db
          .query("forms")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).length;
    case "mapLocations":
      return (
        await ctx.db
          .query("mapLocations")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).length;
  }
}

const RESOURCE_TABLE: Record<
  Exclude<ResourceKind, "orgs">,
  | "pages"
  | "properties"
  | "posts"
  | "services"
  | "memberships"
  | "domains"
  | "assets"
  | "forms"
  | "mapLocations"
> = {
  pages: "pages",
  properties: "properties",
  posts: "posts",
  services: "services",
  members: "memberships",
  domains: "domains",
  assets: "assets",
  forms: "forms",
  mapLocations: "mapLocations",
};

/**
 * Throws ConvexError when the org is at/over its plan ceiling for `resource`.
 * Call immediately before insert.
 */
export async function assertWithinLimit(
  ctx: DbCtx,
  orgId: Id<"organizations">,
  resource: Exclude<ResourceKind, "orgs">,
) {
  const org = await ctx.db.get(orgId);
  if (!org) throw new ConvexError("Organization not found");
  if (org.status === "suspended") {
    throw new ConvexError("This workspace is suspended");
  }
  if (org.status === "deleted") {
    throw new ConvexError("This workspace has been deleted");
  }

  const plan = planOf(org.plan);
  const limit = PLAN_LIMITS[plan][resource];
  const current = await countByOrg(ctx, RESOURCE_TABLE[resource], orgId);
  if (current >= limit) {
    throw new ConvexError(
      `Plan limit reached: ${resource} (${current}/${limit} on ${plan}). Upgrade to add more.`,
    );
  }
}

export async function assertOrgCreateAllowed(ctx: DbCtx, userId: string) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  // Count orgs where the user is owner — those consume their personal org quota.
  let owned = 0;
  let highestPlan: PlanId = "free";
  for (const m of memberships) {
    if (m.role !== "owner") continue;
    owned += 1;
    const org = await ctx.db.get(m.orgId);
    if (org) {
      const p = planOf(org.plan);
      if (PLAN_LIMITS[p].orgs > PLAN_LIMITS[highestPlan].orgs) highestPlan = p;
    }
  }

  // Platform-level max orgs per user (from config) is a hard ceiling; plan
  // orgs limit is the softer product ceiling for free users.
  const config = await ctx.db
    .query("platformConfig")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .first();
  const platformMax = config?.maxOrgsPerUser ?? PLAN_LIMITS.free.orgs;
  const planMax = PLAN_LIMITS[highestPlan].orgs;
  const max = Math.min(platformMax, planMax === 0 ? platformMax : Math.max(planMax, 1));

  // Free users start with free.orgs; once they own a starter+ org, that plan's
  // orgs ceiling applies. Platform max always caps.
  const effectiveMax = Math.min(
    platformMax,
    owned === 0 ? PLAN_LIMITS.free.orgs : planMax,
  );

  if (owned >= effectiveMax || owned >= max) {
    throw new ConvexError(
      `You can own at most ${effectiveMax} workspace(s) on your current plan`,
    );
  }
}

export async function assertAssetBytesWithinLimit(
  ctx: DbCtx,
  orgId: Id<"organizations">,
  incomingBytes: number,
) {
  const org = await ctx.db.get(orgId);
  if (!org) throw new ConvexError("Organization not found");
  const plan = planOf(org.plan);
  const limit = PLAN_LIMITS[plan].assetBytes;
  const assets = await ctx.db
    .query("assets")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const used = assets.reduce((sum, a) => sum + (a.size ?? 0), 0);
  if (used + incomingBytes > limit) {
    throw new ConvexError(
      `Storage limit reached (${Math.round(used / 1024 / 1024)}MB used of ${Math.round(limit / 1024 / 1024)}MB)`,
    );
  }
}

/** Usage snapshot for the dashboard billing/plan panel. */
export async function getUsage(ctx: DbCtx, orgId: Id<"organizations">) {
  const org = await ctx.db.get(orgId);
  if (!org) throw new ConvexError("Organization not found");
  const plan = planOf(org.plan);
  const limits = PLAN_LIMITS[plan];

  const [
    pages,
    properties,
    posts,
    services,
    members,
    domains,
    assets,
    forms,
    mapLocations,
  ] = await Promise.all([
    countByOrg(ctx, "pages", orgId),
    countByOrg(ctx, "properties", orgId),
    countByOrg(ctx, "posts", orgId),
    countByOrg(ctx, "services", orgId),
    countByOrg(ctx, "memberships", orgId),
    countByOrg(ctx, "domains", orgId),
    countByOrg(ctx, "assets", orgId),
    countByOrg(ctx, "forms", orgId),
    countByOrg(ctx, "mapLocations", orgId),
  ]);

  const assetRows = await ctx.db
    .query("assets")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const assetBytes = assetRows.reduce((s, a) => s + (a.size ?? 0), 0);

  return {
    plan,
    limits: {
      pages: limits.pages,
      properties: limits.properties,
      posts: limits.posts,
      services: limits.services,
      members: limits.members,
      domains: limits.domains,
      assets: limits.assets,
      forms: limits.forms,
      mapLocations: limits.mapLocations,
      assetBytes: limits.assetBytes,
    },
    usage: {
      pages,
      properties,
      posts,
      services,
      members,
      domains,
      assets,
      forms,
      mapLocations,
      assetBytes,
    },
  };
}
