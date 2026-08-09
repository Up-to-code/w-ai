import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgAccess } from "./helpers";

const convoShape = v.object({
  _id: v.id("conversations"),
  orgId: v.id("organizations"),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  status: v.union(v.literal("open"), v.literal("resolved")),
  lastMessageAt: v.number(),
  createdAt: v.number(),
});

const msgShape = v.object({
  _id: v.id("messages"),
  orgId: v.id("organizations"),
  conversationId: v.id("conversations"),
  sender: v.union(v.literal("visitor"), v.literal("agent")),
  body: v.string(),
  read: v.boolean(),
  createdAt: v.number(),
});

// ---------------------------------------------------------------------------
// Public: visitor starts or continues a conversation
// ---------------------------------------------------------------------------

export const startConversation = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const convoId = await ctx.db.insert("conversations", {
      orgId: args.orgId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      status: "open",
      lastMessageAt: now,
      createdAt: now,
    });
    await ctx.db.insert("messages", {
      orgId: args.orgId,
      conversationId: convoId,
      sender: "visitor",
      body: args.message,
      read: false,
      createdAt: now,
    });
    return convoId;
  },
  returns: v.id("conversations"),
});

export const visitorSend = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const convo = await ctx.db.get(args.conversationId);
    if (!convo) throw new ConvexError("Conversation not found");
    const now = Date.now();
    await ctx.db.insert("messages", {
      orgId: convo.orgId,
      conversationId: args.conversationId,
      sender: "visitor",
      body: args.body,
      read: false,
      createdAt: now,
    });
    await ctx.db.patch(args.conversationId, { lastMessageAt: now });
  },
});

// ---------------------------------------------------------------------------
// Admin: list conversations, send as agent, mark resolved
// ---------------------------------------------------------------------------

export const listConversations = query({
  args: {
    orgId: v.id("organizations"),
    status: v.optional(v.union(v.literal("open"), v.literal("resolved"))),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const rows = await ctx.db
      .query("conversations")
      .withIndex("by_org_last_message", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();
    return args.status ? rows.filter((c) => c.status === args.status) : rows;
  },
  returns: v.array(convoShape),
});

export const getMessages = query({
  args: { conversationId: v.id("conversations"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    return ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
  },
  returns: v.array(msgShape),
});

export const agentSend = mutation({
  args: {
    conversationId: v.id("conversations"),
    orgId: v.id("organizations"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const now = Date.now();
    await ctx.db.insert("messages", {
      orgId: args.orgId,
      conversationId: args.conversationId,
      sender: "agent",
      body: args.body,
      read: true,
      createdAt: now,
    });
    await ctx.db.patch(args.conversationId, { lastMessageAt: now });
  },
});

export const resolve = mutation({
  args: { conversationId: v.id("conversations"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    await ctx.db.patch(args.conversationId, { status: "resolved" });
  },
});

export const markMessagesRead = mutation({
  args: { conversationId: v.id("conversations"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    for (const m of msgs) {
      if (!m.read && m.sender === "visitor") {
        await ctx.db.patch(m._id, { read: true });
      }
    }
  },
});
