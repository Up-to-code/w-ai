import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  logEvent,
  requireEditor,
  requireNonEmpty,
  requireOrgAccess,
} from "./helpers";
import { assertAssetBytesWithinLimit, assertWithinLimit } from "./limits";

const assetShape = v.object({
  _id: v.id("assets"),
  orgId: v.id("organizations"),
  storageId: v.string(),
  url: v.string(),
  name: v.string(),
  type: v.string(),
  size: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  createdBy: v.optional(v.string()),
  createdAt: v.number(),
});

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB per file
const ALLOWED_TYPES_PREFIX = [
  "image/",
  "application/pdf",
  "video/mp4",
  "video/webm",
];

export const list = query({
  args: {
    orgId: v.id("organizations"),
    typePrefix: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const rows = await ctx.db
      .query("assets")
      .withIndex("by_org_created", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();
    return rows
      .filter((asset) => !args.typePrefix || asset.type.startsWith(args.typePrefix))
      .map((asset) => ({
        _id: asset._id,
        orgId: asset.orgId,
        storageId: asset.storageId,
        url: asset.url,
        name: asset.name,
        type: asset.type,
        size: asset.size,
        width: asset.width,
        height: asset.height,
        createdBy: asset.createdBy,
        createdAt: asset.createdAt,
      }));
  },
  returns: v.array(assetShape),
});

export const get = query({
  args: { assetId: v.id("assets"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.orgId !== args.orgId) return null;
    return {
      _id: asset._id,
      orgId: asset.orgId,
      storageId: asset.storageId,
      url: asset.url,
      name: asset.name,
      type: asset.type,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      createdBy: asset.createdBy,
      createdAt: asset.createdAt,
    };
  },
  returns: v.union(v.null(), assetShape),
});

/** Step 1: get a short-lived upload URL from Convex storage. */
export const generateUploadUrl = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    await assertWithinLimit(ctx, args.orgId, "assets");
    return await ctx.storage.generateUploadUrl();
  },
  returns: v.string(),
});

/**
 * Step 2: after the client PUTs the file to the upload URL, save the metadata
 * row. `storageId` is the id returned by the upload response.
 */
export const save = mutation({
  args: {
    orgId: v.id("organizations"),
    storageId: v.string(),
    name: v.string(),
    type: v.string(),
    size: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.orgId);
    await assertWithinLimit(ctx, args.orgId, "assets");

    const name = requireNonEmpty(args.name, "File name", 255);
    const type = requireNonEmpty(args.type, "File type", 100);
    if (args.size <= 0 || args.size > MAX_UPLOAD_BYTES) {
      throw new ConvexError(
        `File must be between 1 byte and ${MAX_UPLOAD_BYTES / 1024 / 1024}MB`,
      );
    }
    if (!ALLOWED_TYPES_PREFIX.some((p) => type.startsWith(p) || type === p)) {
      throw new ConvexError("File type not allowed");
    }
    await assertAssetBytesWithinLimit(ctx, args.orgId, args.size);

    const url = await ctx.storage.getUrl(args.storageId as any);
    if (!url) throw new ConvexError("Upload not found — re-upload the file");

    const id = await ctx.db.insert("assets", {
      orgId: args.orgId,
      storageId: args.storageId,
      url,
      name,
      type,
      size: args.size,
      width: args.width,
      height: args.height,
      createdBy: user._id,
      createdAt: Date.now(),
    });

    await logEvent(ctx, {
      orgId: args.orgId,
      userId: user._id,
      type: "asset.upload",
      title: `Uploaded ${name}`,
      metadata: { type, size: args.size },
    });

    return { id, url };
  },
  returns: v.object({ id: v.id("assets"), url: v.string() }),
});

export const remove = mutation({
  args: { assetId: v.id("assets"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.orgId);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.orgId !== args.orgId)
      throw new ConvexError("Asset not found");
    try {
      await ctx.storage.delete(asset.storageId as any);
    } catch {
      // Storage object may already be gone — still drop the row.
    }
    await ctx.db.delete(args.assetId);
    await logEvent(ctx, {
      orgId: args.orgId,
      userId: user._id,
      type: "asset.delete",
      title: `Deleted ${asset.name}`,
    });
    return null;
  },
  returns: v.null(),
});

export const rename = mutation({
  args: {
    assetId: v.id("assets"),
    orgId: v.id("organizations"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.orgId !== args.orgId)
      throw new ConvexError("Asset not found");
    await ctx.db.patch(args.assetId, {
      name: requireNonEmpty(args.name, "File name", 255),
    });
    return null;
  },
  returns: v.null(),
});
