import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  logEvent,
  normalizeSlug,
  requireEditor,
  requireNonEmpty,
  requireOrgAccess,
} from "./helpers";
import { assertWithinLimit } from "./limits";

const localized = v.record(v.string(), v.string());

const formField = v.object({
  id: v.string(),
  type: v.union(
    v.literal("text"),
    v.literal("textarea"),
    v.literal("email"),
    v.literal("phone"),
    v.literal("number"),
    v.literal("select"),
    v.literal("radio"),
    v.literal("checkbox"),
    v.literal("date"),
    v.literal("property"),
  ),
  label: localized,
  placeholder: v.optional(localized),
  required: v.boolean(),
  options: v.optional(
    v.array(
      v.object({
        label: localized,
        value: v.string(),
      }),
    ),
  ),
  propertyId: v.optional(v.id("properties")),
});

const formSettings = v.object({
  submitLabel: v.optional(localized),
  successMessage: v.optional(localized),
  redirectUrl: v.optional(v.string()),
  createLead: v.boolean(),
  createContact: v.boolean(),
});

const formShape = v.object({
  _id: v.id("forms"),
  orgId: v.id("organizations"),
  name: localized,
  slug: v.string(),
  published: v.boolean(),
  fields: v.array(formField),
  settings: formSettings,
  createdAt: v.number(),
  updatedAt: v.number(),
});

const submissionShape = v.object({
  _id: v.id("formSubmissions"),
  orgId: v.id("organizations"),
  formId: v.id("forms"),
  data: v.record(v.string(), v.string()),
  sourcePage: v.optional(v.string()),
  read: v.boolean(),
  createdAt: v.number(),
});

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export const getPublishedBySlug = query({
  args: { orgId: v.id("organizations"), slug: v.string() },
  handler: async (ctx, args) => {
    const form = await ctx.db
      .query("forms")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .first();
    if (!form || !form.published) return null;
    return form;
  },
  returns: v.union(v.null(), formShape),
});

export const submit = mutation({
  args: {
    orgId: v.id("organizations"),
    slug: v.string(),
    data: v.record(v.string(), v.string()),
    sourcePage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db
      .query("forms")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .first();
    if (!form || !form.published) throw new ConvexError("Form not found");

    // Validate required fields are present (non-empty).
    for (const field of form.fields) {
      if (!field.required) continue;
      const value = args.data[field.id];
      if (value === undefined || value.trim() === "") {
        throw new ConvexError(`Field "${field.id}" is required`);
      }
    }

    // Sanitize: only keep keys that exist on the form definition.
    const allowed = new Set(form.fields.map((f) => f.id));
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(args.data)) {
      if (!allowed.has(key)) continue;
      clean[key] = String(value).slice(0, 5000);
    }

    const submissionId = await ctx.db.insert("formSubmissions", {
      orgId: args.orgId,
      formId: form._id,
      data: clean,
      sourcePage: args.sourcePage?.slice(0, 500),
      read: false,
      createdAt: Date.now(),
    });

    // Optional side-effects from form settings.
    if (form.settings.createContact) {
      const name =
        clean.name ||
        clean.fullName ||
        clean.full_name ||
        Object.values(clean)[0] ||
        "Form submission";
      const phone = clean.phone || clean.phoneNumber || clean.tel || "-";
      const email = clean.email;
      const message =
        clean.message ||
        clean.notes ||
        Object.entries(clean)
          .map(([k, val]) => `${k}: ${val}`)
          .join("\n")
          .slice(0, 4000);
      await ctx.db.insert("contacts", {
        orgId: args.orgId,
        name: name.slice(0, 200),
        phoneNumber: phone.slice(0, 50),
        email: email?.slice(0, 200),
        message,
        reason: `form:${form.slug}`,
        read: false,
        createdAt: Date.now(),
      });
    }

    if (form.settings.createLead) {
      const name = clean.name || clean.fullName || "Lead";
      const phone = clean.phone || clean.phoneNumber || clean.tel || "-";
      await ctx.db.insert("interests", {
        orgId: args.orgId,
        name: name.slice(0, 200),
        phone: phone.slice(0, 50),
        email: clean.email?.slice(0, 200),
        message: clean.message?.slice(0, 4000),
        source: `form:${form.slug}`,
        read: false,
        createdAt: Date.now(),
      });
    }

    return submissionId;
  },
  returns: v.id("formSubmissions"),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const listAdmin = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const rows = await ctx.db
      .query("forms")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  returns: v.array(formShape),
});

export const getAdmin = query({
  args: { formId: v.id("forms"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const form = await ctx.db.get(args.formId);
    if (!form || form.orgId !== args.orgId) throw new ConvexError("Form not found");
    return form;
  },
  returns: formShape,
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    name: localized,
    slug: v.string(),
    fields: v.optional(v.array(formField)),
    settings: v.optional(formSettings),
    published: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.orgId);
    await assertWithinLimit(ctx, args.orgId, "forms");
    const slug = normalizeSlug(args.slug, { min: 1, max: 60 });
    const existing = await ctx.db
      .query("forms")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", slug),
      )
      .first();
    if (existing) throw new ConvexError("A form with this address already exists");

    const now = Date.now();
    const id = await ctx.db.insert("forms", {
      orgId: args.orgId,
      name: args.name,
      slug,
      published: args.published ?? false,
      fields: args.fields ?? [],
      settings: args.settings ?? {
        createLead: false,
        createContact: true,
      },
      createdAt: now,
      updatedAt: now,
    });
    await logEvent(ctx, {
      orgId: args.orgId,
      userId: user._id,
      type: "form.create",
      title: `Form created: ${slug}`,
    });
    return id;
  },
  returns: v.id("forms"),
});

export const update = mutation({
  args: {
    formId: v.id("forms"),
    orgId: v.id("organizations"),
    name: v.optional(localized),
    slug: v.optional(v.string()),
    fields: v.optional(v.array(formField)),
    settings: v.optional(formSettings),
    published: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const form = await ctx.db.get(args.formId);
    if (!form || form.orgId !== args.orgId) throw new ConvexError("Form not found");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.fields !== undefined) patch.fields = args.fields;
    if (args.settings !== undefined) patch.settings = args.settings;
    if (args.published !== undefined) patch.published = args.published;
    if (args.slug !== undefined) {
      const slug = normalizeSlug(args.slug, { min: 1, max: 60 });
      if (slug !== form.slug) {
        const clash = await ctx.db
          .query("forms")
          .withIndex("by_org_slug", (q) =>
            q.eq("orgId", args.orgId).eq("slug", slug),
          )
          .first();
        if (clash) throw new ConvexError("A form with this address already exists");
        patch.slug = slug;
      }
    }
    await ctx.db.patch(args.formId, patch);
    return null;
  },
  returns: v.null(),
});

export const remove = mutation({
  args: { formId: v.id("forms"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const form = await ctx.db.get(args.formId);
    if (!form || form.orgId !== args.orgId) throw new ConvexError("Form not found");
    const subs = await ctx.db
      .query("formSubmissions")
      .withIndex("by_org_form", (q) =>
        q.eq("orgId", args.orgId).eq("formId", args.formId),
      )
      .collect();
    for (const s of subs) await ctx.db.delete(s._id);
    await ctx.db.delete(args.formId);
    return null;
  },
  returns: v.null(),
});

export const listSubmissions = query({
  args: {
    orgId: v.id("organizations"),
    formId: v.optional(v.id("forms")),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    let rows;
    if (args.formId) {
      rows = await ctx.db
        .query("formSubmissions")
        .withIndex("by_org_form", (q) =>
          q.eq("orgId", args.orgId).eq("formId", args.formId!),
        )
        .collect();
    } else {
      rows = await ctx.db
        .query("formSubmissions")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
    }
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return args.unreadOnly ? rows.filter((r) => !r.read) : rows;
  },
  returns: v.array(submissionShape),
});

export const markSubmissionRead = mutation({
  args: {
    submissionId: v.id("formSubmissions"),
    orgId: v.id("organizations"),
    read: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const row = await ctx.db.get(args.submissionId);
    if (!row || row.orgId !== args.orgId) throw new ConvexError("Submission not found");
    await ctx.db.patch(args.submissionId, { read: args.read });
    return null;
  },
  returns: v.null(),
});

export const removeSubmission = mutation({
  args: {
    submissionId: v.id("formSubmissions"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const row = await ctx.db.get(args.submissionId);
    if (!row || row.orgId !== args.orgId) throw new ConvexError("Submission not found");
    await ctx.db.delete(args.submissionId);
    return null;
  },
  returns: v.null(),
});
