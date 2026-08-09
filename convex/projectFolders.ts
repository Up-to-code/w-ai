import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { requireOrgAccess } from "./helpers";

const folderValidator = v.object({
  _id: v.id("projectFolders"),
  name: v.string(),
  projectCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

function normalizedName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 60) {
    throw new ConvexError("Folder name must be between 1 and 60 characters");
  }
  return name;
}

export const listMine = query({
  args: {},
  returns: v.object({
    folders: v.array(folderValidator),
    assignments: v.array(
      v.object({
        orgId: v.id("organizations"),
        folderId: v.id("projectFolders"),
      }),
    ),
  }),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return { folders: [], assignments: [] };

    const [folders, assignments] = await Promise.all([
      ctx.db
        .query("projectFolders")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("asc")
        .take(200),
      ctx.db
        .query("projectFolderAssignments")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(500),
    ]);

    const counts = new Map<string, number>();
    for (const assignment of assignments) {
      counts.set(
        assignment.folderId,
        (counts.get(assignment.folderId) ?? 0) + 1,
      );
    }

    return {
      folders: folders.map((folder) => ({
        _id: folder._id,
        name: folder.name,
        projectCount: counts.get(folder._id) ?? 0,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      })),
      assignments: assignments.map(({ orgId, folderId }) => ({
        orgId,
        folderId,
      })),
    };
  },
});

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("projectFolders"),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const name = normalizedName(args.name);
    const existing = await ctx.db
      .query("projectFolders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(200);
    if (
      existing.some(
        (folder) => folder.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new ConvexError("A folder with this name already exists");
    }
    const now = Date.now();
    return ctx.db.insert("projectFolders", {
      userId: user._id,
      name,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const rename = mutation({
  args: { folderId: v.id("projectFolders"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== user._id) {
      throw new ConvexError("Folder not found");
    }
    await ctx.db.patch(folder._id, {
      name: normalizedName(args.name),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: { folderId: v.id("projectFolders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== user._id) {
      throw new ConvexError("Folder not found");
    }
    const assignments = await ctx.db
      .query("projectFolderAssignments")
      .withIndex("by_folder", (q) => q.eq("folderId", folder._id))
      .take(500);
    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }
    await ctx.db.delete(folder._id);
    return null;
  },
});

export const moveProject = mutation({
  args: {
    orgId: v.id("organizations"),
    folderId: v.union(v.id("projectFolders"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireOrgAccess(ctx, args.orgId);
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== user._id) {
        throw new ConvexError("Folder not found");
      }
    }
    const current = await ctx.db
      .query("projectFolderAssignments")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("orgId", args.orgId),
      )
      .first();
    if (!args.folderId) {
      if (current) await ctx.db.delete(current._id);
      return null;
    }
    if (current) {
      await ctx.db.patch(current._id, {
        folderId: args.folderId,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("projectFolderAssignments", {
        userId: user._id,
        orgId: args.orgId,
        folderId: args.folderId,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});
