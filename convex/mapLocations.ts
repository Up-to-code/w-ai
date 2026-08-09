import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireEditor, requireNonEmpty, requireOrgAccess } from "./helpers";
import { assertWithinLimit } from "./limits";

const localized = v.record(v.string(), v.string());

const locationShape = v.object({
  _id: v.id("mapLocations"),
  orgId: v.id("organizations"),
  name: localized,
  address: v.optional(localized),
  city: v.optional(localized),
  country: v.optional(localized),
  description: v.optional(localized),
  latitude: v.number(),
  longitude: v.number(),
  enabled: v.boolean(),
  createdAt: v.number(),
});

function assertCoords(lat: number, lng: number) {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new ConvexError("Invalid coordinates");
  }
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export const listPublic = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("mapLocations")
      .withIndex("by_org_enabled", (q) =>
        q.eq("orgId", args.orgId).eq("enabled", true),
      )
      .collect();
    return rows;
  },
  returns: v.array(locationShape),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const listAdmin = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    return ctx.db
      .query("mapLocations")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
  returns: v.array(locationShape),
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    name: localized,
    address: v.optional(localized),
    city: v.optional(localized),
    country: v.optional(localized),
    description: v.optional(localized),
    latitude: v.number(),
    longitude: v.number(),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    await assertWithinLimit(ctx, args.orgId, "mapLocations");
    assertCoords(args.latitude, args.longitude);
    return ctx.db.insert("mapLocations", {
      orgId: args.orgId,
      name: args.name,
      address: args.address,
      city: args.city,
      country: args.country,
      description: args.description,
      latitude: args.latitude,
      longitude: args.longitude,
      enabled: args.enabled ?? true,
      createdAt: Date.now(),
    });
  },
  returns: v.id("mapLocations"),
});

export const update = mutation({
  args: {
    locationId: v.id("mapLocations"),
    orgId: v.id("organizations"),
    name: v.optional(localized),
    address: v.optional(localized),
    city: v.optional(localized),
    country: v.optional(localized),
    description: v.optional(localized),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const row = await ctx.db.get(args.locationId);
    if (!row || row.orgId !== args.orgId) throw new ConvexError("Location not found");

    const lat = args.latitude ?? row.latitude;
    const lng = args.longitude ?? row.longitude;
    assertCoords(lat, lng);

    const { locationId, orgId: _o, ...rest } = args;
    const clean = Object.fromEntries(
      Object.entries(rest).filter(([, val]) => val !== undefined),
    );
    await ctx.db.patch(locationId, clean);
    return null;
  },
  returns: v.null(),
});

export const remove = mutation({
  args: { locationId: v.id("mapLocations"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const row = await ctx.db.get(args.locationId);
    if (!row || row.orgId !== args.orgId) throw new ConvexError("Location not found");
    await ctx.db.delete(args.locationId);
    return null;
  },
  returns: v.null(),
});
