import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireEditor, requireOrgAccess } from "./helpers";

const librarySummary = v.object({
  _id: v.id("componentLibraries"),
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  ownerType: v.union(
    v.literal("platform"),
    v.literal("organization"),
    v.literal("user"),
  ),
  access: v.union(v.literal("free"), v.literal("paid"), v.literal("private")),
  installed: v.boolean(),
});

export const listForOrganization = query({
  args: { orgId: v.id("organizations") },
  returns: v.array(librarySummary),
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const [platform, organization, installations] = await Promise.all([
      ctx.db
        .query("componentLibraries")
        .withIndex("by_owner_type", (q) => q.eq("ownerType", "platform"))
        .take(100),
      ctx.db
        .query("componentLibraries")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .take(100),
      ctx.db
        .query("libraryInstallations")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .take(200),
    ]);
    const installed = new Set(installations.map((row) => row.libraryId));
    return [...platform, ...organization]
      .filter((row) => row.published || row.orgId === args.orgId)
      .map((row) => ({
        _id: row._id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        ownerType: row.ownerType,
        access: row.access,
        installed:
          row.ownerType === "platform" && row.access === "free"
            ? true
            : installed.has(row._id),
      }));
  },
});

export const install = mutation({
  args: { orgId: v.id("organizations"), libraryId: v.id("componentLibraries") },
  returns: v.id("libraryInstallations"),
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.orgId);
    const library = await ctx.db.get(args.libraryId);
    if (!library || !library.published)
      throw new ConvexError("Library not found");
    if (library.access === "private" && library.orgId !== args.orgId)
      throw new ConvexError(
        "This private library is not available to your organization",
      );
    if (library.access === "paid") {
      const [organization, entitlement] = await Promise.all([
        ctx.db.get(args.orgId),
        ctx.db
          .query("libraryEntitlements")
          .withIndex("by_org_library", (q) =>
            q.eq("orgId", args.orgId).eq("libraryId", args.libraryId),
          )
          .first(),
      ]);
      const includedInPlan =
        organization?.plan === "pro" || organization?.plan === "enterprise";
      if (!includedInPlan && entitlement?.status !== "active")
        throw new ConvexError(
          "This library requires an eligible plan or purchase",
        );
    }
    const existing = await ctx.db
      .query("libraryInstallations")
      .withIndex("by_org_library", (q) =>
        q.eq("orgId", args.orgId).eq("libraryId", args.libraryId),
      )
      .first();
    if (existing) return existing._id;
    return ctx.db.insert("libraryInstallations", {
      orgId: args.orgId,
      libraryId: args.libraryId,
      installedBy: user._id,
      installedAt: Date.now(),
    });
  },
});
