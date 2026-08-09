import { v } from "convex/values";
import { query } from "./_generated/server";
import { publicSite, publicSiteValidator } from "./helpers";

/**
 * Resolves a tenant site by its slug (served at `{slug}.{appDomain}`). The
 * middleware rewrites tenant subdomains to `/c/<slug>`, so this is the primary
 * path for subdomain tenants.
 */
export const getSiteBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!org) return null;
    return publicSite(ctx, org._id);
  },
  returns: v.union(v.null(), publicSiteValidator),
});

/**
 * Resolves a tenant site from an incoming Host header. Only used for custom
 * domains (verified rows in the domains table) — subdomain hosts never reach
 * here because the middleware rewrites them to `/c/<slug>` first.
 */
export const getSiteByHost = query({
  args: { host: v.string() },
  handler: async (ctx, args) => {
    const host = args.host.split(":")[0].toLowerCase();
    const domain = await ctx.db
      .query("domains")
      .withIndex("by_hostname", (q) => q.eq("hostname", host))
      .first();
    if (!domain?.verified) return null;
    return publicSite(ctx, domain.orgId);
  },
  returns: v.union(v.null(), publicSiteValidator),
});
