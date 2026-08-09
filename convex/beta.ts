import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { logEvent, randomToken, requireNonEmpty } from "./helpers";

const DEFAULT_CONFIG = {
  key: "global" as const,
  betaRequired: true,
  signupOpen: true,
  maxOrgsPerUser: 3,
  adminEmails: [] as string[],
  softDomainVerify: true,
};

/** Ensure the singleton platform config row exists; return it. */
export async function getOrCreatePlatformConfig(ctx: {
  db: {
    query: Function;
    insert: Function;
  };
}) {
  // Typed loosely so both QueryCtx and MutationCtx work; callers pass full ctx.
  const anyCtx = ctx as any;
  const existing = await anyCtx.db
    .query("platformConfig")
    .withIndex("by_key", (q: any) => q.eq("key", "global"))
    .first();
  if (existing) return existing;

  // Only mutations can insert — queries just return defaults.
  if (typeof anyCtx.db.insert !== "function") {
    return { ...DEFAULT_CONFIG, _id: null, updatedAt: Date.now() };
  }
  // Mutations: create on first write path.
  return null;
}

async function readConfig(ctx: any) {
  const existing = await ctx.db
    .query("platformConfig")
    .withIndex("by_key", (q: any) => q.eq("key", "global"))
    .first();
  if (existing) return existing;
  return { ...DEFAULT_CONFIG, updatedAt: 0 };
}

async function ensureConfig(ctx: any) {
  const existing = await ctx.db
    .query("platformConfig")
    .withIndex("by_key", (q: any) => q.eq("key", "global"))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("platformConfig", {
    ...DEFAULT_CONFIG,
    updatedAt: Date.now(),
  });
  return (await ctx.db.get(id))!;
}

async function requirePlatformAdmin(ctx: any) {
  const user = await authComponent.getAuthUser(ctx);
  const email = (user.email ?? "").toLowerCase();
  const config = await ensureConfig(ctx);
  if (config.adminEmails.length === 0) {
    // Bootstrap mode: any authenticated user can act as platform admin until
    // the first admin email is configured. This lets us seed invites in dev.
    return { user, config, bootstrap: true as const };
  }
  if (!email || !config.adminEmails.includes(email)) {
    throw new ConvexError("Platform admin access required");
  }
  return { user, config, bootstrap: false as const };
}

export async function requireBetaAccess(ctx: any, userId: string) {
  const config = await readConfig(ctx);
  if (!config.betaRequired) return { required: false, hasAccess: true };

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (!profile?.betaAccess) {
    throw new ConvexError(
      "Beta access required. Redeem an invite code before creating a workspace.",
    );
  }
  return { required: true, hasAccess: true, profile };
}

export async function getOrCreateProfile(ctx: any, userId: string) {
  const existing = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("userProfiles", {
    userId,
    betaAccess: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return (await ctx.db.get(id))!;
}

// ---------------------------------------------------------------------------
// Public / authenticated API
// ---------------------------------------------------------------------------

export const status = query({
  args: {},
  handler: async (ctx) => {
    const config = await readConfig(ctx);
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return {
        authenticated: false,
        betaRequired: config.betaRequired,
        signupOpen: config.signupOpen,
        softDomainVerify: config.softDomainVerify,
        betaAccess: false,
        isPlatformAdmin: false,
      };
    }
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    const email = (user.email ?? "").toLowerCase();
    const isPlatformAdmin =
      config.adminEmails.length === 0
        ? false
        : config.adminEmails.includes(email);
    return {
      authenticated: true,
      betaRequired: config.betaRequired,
      signupOpen: config.signupOpen,
      softDomainVerify: config.softDomainVerify,
      betaAccess: profile?.betaAccess ?? false,
      betaInviteCode: profile?.betaInviteCode,
      isPlatformAdmin,
    };
  },
  returns: v.object({
    authenticated: v.boolean(),
    betaRequired: v.boolean(),
    signupOpen: v.boolean(),
    softDomainVerify: v.boolean(),
    betaAccess: v.boolean(),
    betaInviteCode: v.optional(v.string()),
    isPlatformAdmin: v.boolean(),
  }),
});

export const redeemInvite = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const code = requireNonEmpty(args.code, "Invite code", 64).toUpperCase();

    const invite = await ctx.db
      .query("betaInvites")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!invite || !invite.active) {
      throw new ConvexError("Invalid or inactive invite code");
    }
    if (invite.expiresAt && invite.expiresAt < Date.now()) {
      throw new ConvexError("This invite code has expired");
    }
    if (invite.usedCount >= invite.maxUses) {
      throw new ConvexError("This invite code has no remaining uses");
    }

    const profile = await getOrCreateProfile(ctx, user._id);
    if (profile.betaAccess) {
      return { alreadyHadAccess: true };
    }

    await ctx.db.patch(profile._id, {
      betaAccess: true,
      betaInviteCode: code,
      betaRedeemedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.patch(invite._id, { usedCount: invite.usedCount + 1 });

    await logEvent(ctx, {
      userId: user._id,
      type: "beta.redeem",
      title: "Beta invite redeemed",
      metadata: { code },
    });

    return { alreadyHadAccess: false };
  },
  returns: v.object({ alreadyHadAccess: v.boolean() }),
});

// ---------------------------------------------------------------------------
// Platform admin
// ---------------------------------------------------------------------------

export const createInvite = mutation({
  args: {
    code: v.optional(v.string()),
    maxUses: v.optional(v.number()),
    note: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, bootstrap } = await requirePlatformAdmin(ctx);
    const code = (args.code?.trim() || `BETA-${randomToken(4)}`).toUpperCase();
    if (code.length < 4 || code.length > 64) {
      throw new ConvexError("Invite code must be 4-64 characters");
    }
    const existing = await ctx.db
      .query("betaInvites")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (existing) throw new ConvexError("Invite code already exists");

    const maxUses = Math.max(1, Math.min(args.maxUses ?? 1, 10_000));
    const id = await ctx.db.insert("betaInvites", {
      code,
      maxUses,
      usedCount: 0,
      active: true,
      note: args.note,
      expiresAt: args.expiresAt,
      createdBy: user._id,
      createdAt: Date.now(),
    });

    // On first bootstrap, lock platform admin to this user's email.
    if (bootstrap && user.email) {
      const config = await ensureConfig(ctx);
      if (config.adminEmails.length === 0) {
        await ctx.db.patch(config._id, {
          adminEmails: [user.email.toLowerCase()],
          updatedAt: Date.now(),
        });
      }
    }

    await logEvent(ctx, {
      userId: user._id,
      type: "beta.invite_created",
      title: "Beta invite created",
      metadata: { code, maxUses },
    });

    return { id, code };
  },
  returns: v.object({ id: v.id("betaInvites"), code: v.string() }),
});

export const listInvites = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const config = await readConfig(ctx);
    const email = (user.email ?? "").toLowerCase();
    const allowed =
      config.adminEmails.length === 0 || config.adminEmails.includes(email);
    if (!allowed) return [];

    const rows = await ctx.db.query("betaInvites").collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({
        _id: r._id,
        code: r.code,
        maxUses: r.maxUses,
        usedCount: r.usedCount,
        active: r.active,
        note: r.note,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
      }));
  },
  returns: v.array(
    v.object({
      _id: v.id("betaInvites"),
      code: v.string(),
      maxUses: v.number(),
      usedCount: v.number(),
      active: v.boolean(),
      note: v.optional(v.string()),
      expiresAt: v.optional(v.number()),
      createdAt: v.number(),
    }),
  ),
});

export const deactivateInvite = mutation({
  args: { inviteId: v.id("betaInvites") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new ConvexError("Invite not found");
    await ctx.db.patch(args.inviteId, { active: false });
    return null;
  },
  returns: v.null(),
});

export const updatePlatformConfig = mutation({
  args: {
    betaRequired: v.optional(v.boolean()),
    signupOpen: v.optional(v.boolean()),
    maxOrgsPerUser: v.optional(v.number()),
    adminEmails: v.optional(v.array(v.string())),
    softDomainVerify: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const config = await ensureConfig(ctx);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.betaRequired !== undefined) patch.betaRequired = args.betaRequired;
    if (args.signupOpen !== undefined) patch.signupOpen = args.signupOpen;
    if (args.maxOrgsPerUser !== undefined) {
      patch.maxOrgsPerUser = Math.max(1, Math.min(args.maxOrgsPerUser, 100));
    }
    if (args.adminEmails !== undefined) {
      patch.adminEmails = args.adminEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
    }
    if (args.softDomainVerify !== undefined) {
      patch.softDomainVerify = args.softDomainVerify;
    }
    await ctx.db.patch(config._id, patch);
    return null;
  },
  returns: v.null(),
});

export const getPlatformConfig = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const config = await readConfig(ctx);
    const email = (user.email ?? "").toLowerCase();
    const allowed =
      config.adminEmails.length === 0 || config.adminEmails.includes(email);
    if (!allowed) return null;
    return {
      betaRequired: config.betaRequired,
      signupOpen: config.signupOpen,
      maxOrgsPerUser: config.maxOrgsPerUser,
      adminEmails: config.adminEmails ?? [],
      softDomainVerify: config.softDomainVerify,
      updatedAt: config.updatedAt,
    };
  },
  returns: v.union(
    v.null(),
    v.object({
      betaRequired: v.boolean(),
      signupOpen: v.boolean(),
      maxOrgsPerUser: v.number(),
      adminEmails: v.array(v.string()),
      softDomainVerify: v.boolean(),
      updatedAt: v.number(),
    }),
  ),
});

/**
 * Dev/bootstrap seed. Creates a default multi-use invite and platform config
 * if none exist. Safe to call repeatedly (idempotent).
 *
 *   npx convex run beta:seed '{"code":"QENTRAH-BETA"}'
 */
export const seed = mutation({
  args: {
    code: v.optional(v.string()),
    maxUses: v.optional(v.number()),
    adminEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const config = await ensureConfig(ctx);
    if (args.adminEmail) {
      const email = args.adminEmail.trim().toLowerCase();
      if (email && !config.adminEmails.includes(email)) {
        await ctx.db.patch(config._id, {
          adminEmails: [...config.adminEmails, email],
          updatedAt: Date.now(),
        });
      }
    }

    const code = (args.code ?? "QENTRAH-BETA").toUpperCase();
    const existing = await ctx.db
      .query("betaInvites")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (existing) {
      return { code: existing.code, created: false, inviteId: existing._id };
    }
    const inviteId = await ctx.db.insert("betaInvites", {
      code,
      maxUses: args.maxUses ?? 1000,
      usedCount: 0,
      active: true,
      note: "Default beta seed invite",
      createdAt: Date.now(),
    });
    return { code, created: true, inviteId };
  },
  returns: v.object({
    code: v.string(),
    created: v.boolean(),
    inviteId: v.id("betaInvites"),
  }),
});
