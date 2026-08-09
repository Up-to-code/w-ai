import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";

import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { normalizeSlug, requireEditor, requireOrgAccess } from "./helpers";

const fieldType = v.union(
  v.literal("text"),
  v.literal("richText"),
  v.literal("number"),
  v.literal("boolean"),
  v.literal("date"),
  v.literal("image"),
  v.literal("file"),
  v.literal("select"),
  v.literal("slug"),
  v.literal("reference"),
  v.literal("multiReference"),
);

const collectionField = v.object({
  key: v.string(),
  id: v.optional(v.string()),
  label: v.string(),
  type: fieldType,
  required: v.boolean(),
  localizable: v.optional(v.boolean()),
  indexable: v.optional(v.boolean()),
  validation: v.optional(v.any()),
  defaultValue: v.optional(v.any()),
  options: v.optional(v.array(v.string())),
  referenceCollectionId: v.optional(v.id("cmsCollections")),
});

const collectionSummary = v.object({
  _id: v.id("cmsCollections"),
  name: v.string(),
  slug: v.string(),
  detailPageSlug: v.optional(v.string()),
  fields: v.array(collectionField),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const preset = v.union(
  v.literal("blank"),
  v.literal("posts"),
  v.literal("products"),
  v.literal("team"),
);

type FieldInput = Omit<Doc<"cmsCollections">["fields"][number], "id"> & {
  id?: string;
};

function stableFieldId(key: string) {
  return `field_${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function normalizeFields(fields: FieldInput[]) {
  const keys = new Set<string>();
  return fields.map((field) => {
    const key = normalizeSlug(field.key, { min: 1, max: 80 });
    if (keys.has(key)) throw new ConvexError(`Duplicate field: ${key}`);
    keys.add(key);
    if (field.type === "select" && !field.options?.length) {
      throw new ConvexError(`Select field ${field.label} needs options`);
    }
    return {
      ...field,
      key,
      id: field.id || stableFieldId(key),
      label: field.label.trim() || key,
      localizable: field.localizable ?? false,
      indexable: field.indexable ?? field.type === "slug",
    };
  });
}

function fieldsForPreset(value: "blank" | "posts" | "products" | "team") {
  const title = {
    id: "field_title",
    key: "title",
    label: "Title",
    type: "text" as const,
    required: true,
    localizable: true,
    indexable: true,
  };
  const slug = {
    id: "field_slug",
    key: "slug",
    label: "Slug",
    type: "slug" as const,
    required: true,
    localizable: true,
    indexable: true,
  };
  if (value === "posts")
    return normalizeFields([
      title,
      slug,
      { key: "content", label: "Content", type: "richText", required: true, localizable: true },
      { key: "featuredImage", label: "Featured image", type: "image", required: false },
      { key: "publishedAt", label: "Published at", type: "date", required: false, indexable: true },
    ]);
  if (value === "products")
    return normalizeFields([
      title,
      slug,
      { key: "description", label: "Description", type: "richText", required: false, localizable: true },
      { key: "sku", label: "SKU", type: "text", required: true, indexable: true },
      { key: "price", label: "Price", type: "number", required: true, indexable: true },
      { key: "image", label: "Image", type: "image", required: false },
      { key: "available", label: "Available", type: "boolean", required: false, indexable: true },
    ]);
  if (value === "team")
    return normalizeFields([
      title,
      slug,
      { key: "role", label: "Role", type: "text", required: true, localizable: true },
      { key: "photo", label: "Photo", type: "image", required: false },
      { key: "bio", label: "Bio", type: "richText", required: false, localizable: true },
    ]);
  return normalizeFields([title, slug]);
}

function isLocalizedValue(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateScalar(field: FieldInput, value: unknown) {
  if (value === undefined || value === null || value === "") {
    if (field.required) throw new ConvexError(`${field.label} is required`);
    return;
  }
  if (field.type === "number" && typeof value !== "number")
    throw new ConvexError(`${field.label} must be a number`);
  if (field.type === "boolean" && typeof value !== "boolean")
    throw new ConvexError(`${field.label} must be true or false`);
  if (field.type === "multiReference" && !Array.isArray(value))
    throw new ConvexError(`${field.label} must be a list`);
  if (
    !["number", "boolean", "multiReference"].includes(field.type) &&
    typeof value !== "string"
  ) {
    throw new ConvexError(`${field.label} must be text`);
  }
  if (field.type === "slug" && typeof value === "string") normalizeSlug(value);
  if (field.type === "select" && typeof value === "string" && !field.options?.includes(value))
    throw new ConvexError(`${field.label} has an invalid option`);
}

function validateValues(fields: FieldInput[], values: unknown) {
  if (!values || typeof values !== "object" || Array.isArray(values))
    throw new ConvexError("Entry values must be an object");
  const record = values as Record<string, unknown>;
  for (const field of fields) {
    const value = record[field.key];
    if (field.localizable) {
      if (!isLocalizedValue(value)) {
        if (field.required) throw new ConvexError(`${field.label} needs a localized value`);
        continue;
      }
      for (const localized of Object.values(value)) validateScalar(field, localized);
      if (field.required && Object.values(value).every((item) => item === "" || item == null))
        throw new ConvexError(`${field.label} is required`);
    } else {
      validateScalar(field, value);
    }
  }
  return record;
}

async function collectionForOrg(ctx: MutationCtx, orgId: Id<"organizations">, collectionId: Id<"cmsCollections">) {
  const collection = await ctx.db.get(collectionId);
  if (!collection || collection.orgId !== orgId)
    throw new ConvexError("Collection not found");
  return collection;
}

async function entryForOrg(ctx: MutationCtx, orgId: Id<"organizations">, entryId: Id<"cmsEntries">) {
  const entry = await ctx.db.get(entryId);
  if (!entry || entry.orgId !== orgId) throw new ConvexError("Entry not found");
  return entry;
}

async function clearEntryIndexes(ctx: MutationCtx, entryId: Id<"cmsEntries">) {
  const [routes, scalars] = await Promise.all([
    ctx.db.query("cmsEntryRoutes").withIndex("by_entry", (q) => q.eq("entryId", entryId)).collect(),
    ctx.db.query("cmsScalarIndexes").withIndex("by_entry", (q) => q.eq("entryId", entryId)).collect(),
  ]);
  for (const row of [...routes, ...scalars]) await ctx.db.delete(row._id);
}

async function materializeIndexes(
  ctx: MutationCtx,
  collection: Doc<"cmsCollections">,
  entry: Doc<"cmsEntries">,
  values: Record<string, unknown>,
) {
  await clearEntryIndexes(ctx, entry._id);
  const languages = await ctx.db
    .query("languages")
    .withIndex("by_org", (q) => q.eq("orgId", entry.orgId))
    .collect();
  const enabled = languages.filter((language) => language.enabled);
  const now = Date.now();
  for (const field of collection.fields) {
    const fieldId = field.id ?? stableFieldId(field.key);
    const raw = values[field.key];
    const localizedValues = field.localizable && isLocalizedValue(raw)
      ? raw
      : Object.fromEntries(enabled.map((language) => [language.code, raw]));
    for (const language of enabled) {
      const scalar = localizedValues[language.code];
      if (field.type === "slug" && typeof scalar === "string") {
        const slug = normalizeSlug(scalar);
        const conflict = await ctx.db
          .query("cmsEntryRoutes")
          .withIndex("by_collection_locale_slug", (q) =>
            q.eq("collectionId", collection._id).eq("localeCode", language.code).eq("slug", slug),
          )
          .unique();
        if (conflict && conflict.entryId !== entry._id)
          throw new ConvexError(`Duplicate ${language.code} slug: ${slug}`);
        await ctx.db.insert("cmsEntryRoutes", {
          orgId: entry.orgId,
          collectionId: collection._id,
          entryId: entry._id,
          localeCode: language.code,
          slug,
          published: true,
          updatedAt: now,
        });
      }
      if (!field.indexable || scalar === undefined || scalar === null) continue;
      await ctx.db.insert("cmsScalarIndexes", {
        orgId: entry.orgId,
        collectionId: collection._id,
        entryId: entry._id,
        fieldId,
        localeCode: language.code,
        ...(typeof scalar === "number"
          ? { numberValue: scalar }
          : typeof scalar === "boolean"
            ? { booleanValue: scalar }
            : { stringValue: String(scalar).toLocaleLowerCase() }),
        updatedAt: now,
      });
    }
  }
}

export const listCollections = query({
  args: { orgId: v.id("organizations") },
  returns: v.array(collectionSummary),
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const rows = await ctx.db.query("cmsCollections").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).order("desc").take(200);
    return rows.map(({ _id, name, slug, detailPageSlug, fields, createdAt, updatedAt }) => ({ _id, name, slug, detailPageSlug, fields, createdAt, updatedAt }));
  },
});

export const createCollection = mutation({
  args: { orgId: v.id("organizations"), name: v.string(), preset },
  returns: v.id("cmsCollections"),
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.orgId);
    const name = args.name.trim();
    if (name.length < 2 || name.length > 80) throw new ConvexError("Collection names must be 2–80 characters");
    const slug = normalizeSlug(name, { min: 1, max: 80 });
    const existing = await ctx.db.query("cmsCollections").withIndex("by_org_slug", (q) => q.eq("orgId", args.orgId).eq("slug", slug)).unique();
    if (existing) throw new ConvexError("A collection with this name exists");
    const now = Date.now();
    return ctx.db.insert("cmsCollections", { orgId: args.orgId, name, slug, fields: fieldsForPreset(args.preset), createdBy: user._id, createdAt: now, updatedAt: now });
  },
});

export const updateCollection = mutation({
  args: { orgId: v.id("organizations"), collectionId: v.id("cmsCollections"), name: v.string(), fields: v.array(collectionField), detailPageSlug: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const collection = await collectionForOrg(ctx, args.orgId, args.collectionId);
    if (args.detailPageSlug) {
      const page = await ctx.db
        .query("pages")
        .withIndex("by_org_slug", (q) =>
          q.eq("orgId", args.orgId).eq("slug", args.detailPageSlug!),
        )
        .unique();
      if (!page) throw new ConvexError("Detail template page not found");
    }
    await ctx.db.patch(collection._id, { name: args.name.trim(), fields: normalizeFields(args.fields), detailPageSlug: args.detailPageSlug || undefined, updatedAt: Date.now() });
    return null;
  },
});

export const deleteCollection = mutation({
  args: { orgId: v.id("organizations"), collectionId: v.id("cmsCollections") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const collection = await collectionForOrg(ctx, args.orgId, args.collectionId);
    const entries = await ctx.db.query("cmsEntries").withIndex("by_collection", (q) => q.eq("collectionId", collection._id)).collect();
    for (const entry of entries) {
      await clearEntryIndexes(ctx, entry._id);
      await ctx.db.delete(entry._id);
    }
    await ctx.db.delete(collection._id);
    return null;
  },
});

export const listEntries = query({
  args: { orgId: v.id("organizations"), collectionId: v.id("cmsCollections"), paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId, "viewer");
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.orgId !== args.orgId) throw new ConvexError("Collection not found");
    return ctx.db.query("cmsEntries").withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId)).order("desc").paginate(args.paginationOpts);
  },
});

export const createEntry = mutation({
  args: { orgId: v.id("organizations"), collectionId: v.id("cmsCollections"), values: v.any() },
  returns: v.id("cmsEntries"),
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.orgId);
    const collection = await collectionForOrg(ctx, args.orgId, args.collectionId);
    const values = validateValues(collection.fields, args.values);
    const now = Date.now();
    return ctx.db.insert("cmsEntries", { orgId: args.orgId, collectionId: args.collectionId, status: "draft", values, version: 1, createdBy: user._id, createdAt: now, updatedAt: now });
  },
});

export const updateEntry = mutation({
  args: { orgId: v.id("organizations"), entryId: v.id("cmsEntries"), values: v.any(), expectedVersion: v.optional(v.number()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const entry = await entryForOrg(ctx, args.orgId, args.entryId);
    const collection = await collectionForOrg(ctx, args.orgId, entry.collectionId);
    const currentVersion = entry.version ?? 1;
    if (args.expectedVersion !== undefined && args.expectedVersion !== currentVersion) throw new ConvexError("This entry changed in another session");
    const version = currentVersion + 1;
    await ctx.db.patch(entry._id, { values: validateValues(collection.fields, args.values), status: entry.publishedValues ? "draft" : entry.status, version, updatedAt: Date.now() });
    return version;
  },
});

export const duplicateEntry = mutation({
  args: { orgId: v.id("organizations"), entryId: v.id("cmsEntries") },
  returns: v.id("cmsEntries"),
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.orgId);
    const entry = await entryForOrg(ctx, args.orgId, args.entryId);
    const now = Date.now();
    return ctx.db.insert("cmsEntries", { orgId: entry.orgId, collectionId: entry.collectionId, status: "draft", values: entry.values, version: 1, createdBy: user._id, createdAt: now, updatedAt: now });
  },
});

export const publishEntry = mutation({
  args: { orgId: v.id("organizations"), entryId: v.id("cmsEntries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const entry = await entryForOrg(ctx, args.orgId, args.entryId);
    const collection = await collectionForOrg(ctx, args.orgId, entry.collectionId);
    const values = validateValues(collection.fields, entry.values);
    await materializeIndexes(ctx, collection, entry, values);
    const now = Date.now();
    await ctx.db.patch(entry._id, { status: "published", publishedValues: values, publishedAt: now, updatedAt: now });
    return null;
  },
});

export const unpublishEntry = mutation({
  args: { orgId: v.id("organizations"), entryId: v.id("cmsEntries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const entry = await entryForOrg(ctx, args.orgId, args.entryId);
    await clearEntryIndexes(ctx, entry._id);
    await ctx.db.patch(entry._id, { status: "draft", publishedValues: undefined, publishedAt: undefined, updatedAt: Date.now() });
    return null;
  },
});

export const deleteEntry = mutation({
  args: { orgId: v.id("organizations"), entryId: v.id("cmsEntries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.orgId);
    const entry = await entryForOrg(ctx, args.orgId, args.entryId);
    await clearEntryIndexes(ctx, entry._id);
    await ctx.db.delete(entry._id);
    return null;
  },
});

/** Public published-only detail lookup. */
export const getPublishedBySlug = query({
  args: { collectionId: v.id("cmsCollections"), localeCode: v.string(), slug: v.string() },
  returns: v.union(v.null(), v.object({ _id: v.id("cmsEntries"), values: v.any() })),
  handler: async (ctx, args) => {
    const route = await ctx.db.query("cmsEntryRoutes").withIndex("by_collection_locale_slug", (q) => q.eq("collectionId", args.collectionId).eq("localeCode", args.localeCode).eq("slug", args.slug)).unique();
    if (!route?.published) return null;
    const entry = await ctx.db.get(route.entryId);
    if (!entry?.publishedValues) return null;
    return { _id: entry._id, values: entry.publishedValues };
  },
});

/** Resolves `/collection-slug/item-slug` without scanning entries in a browser. */
export const resolvePublishedDetail = query({
  args: {
    orgId: v.id("organizations"),
    collectionSlug: v.string(),
    localeCode: v.string(),
    slug: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      collectionId: v.id("cmsCollections"),
      detailPageSlug: v.string(),
      entryId: v.id("cmsEntries"),
      values: v.any(),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db
      .query("cmsCollections")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.collectionSlug),
      )
      .unique();
    if (!collection?.detailPageSlug) return null;
    const route = await ctx.db
      .query("cmsEntryRoutes")
      .withIndex("by_collection_locale_slug", (q) =>
        q
          .eq("collectionId", collection._id)
          .eq("localeCode", args.localeCode)
          .eq("slug", args.slug),
      )
      .unique();
    if (!route?.published) return null;
    const entry = await ctx.db.get(route.entryId);
    if (!entry?.publishedValues || entry.orgId !== args.orgId) return null;
    return {
      collectionId: collection._id,
      detailPageSlug: collection.detailPageSlug,
      entryId: entry._id,
      values: entry.publishedValues,
    };
  },
});

export const listPublishedEntryRoutes = query({
  args: { entryId: v.id("cmsEntries") },
  returns: v.array(
    v.object({ localeCode: v.string(), slug: v.string() }),
  ),
  handler: async (ctx, args) => {
    const routes = await ctx.db
      .query("cmsEntryRoutes")
      .withIndex("by_entry", (q) => q.eq("entryId", args.entryId))
      .collect();
    return routes
      .filter((route) => route.published)
      .map((route) => ({ localeCode: route.localeCode, slug: route.slug }));
  },
});

/** Public published-only collection feed; filtering/sorting uses scalar index rows. */
export const listPublished = query({
  args: { collectionId: v.id("cmsCollections"), limit: v.optional(v.number()) },
  returns: v.array(v.object({ _id: v.id("cmsEntries"), values: v.any() })),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));
    const rows = await ctx.db.query("cmsEntries").withIndex("by_collection_status", (q) => q.eq("collectionId", args.collectionId).eq("status", "published")).order("desc").take(limit);
    return rows.filter((row) => row.publishedValues !== undefined).map((row) => ({ _id: row._id, values: row.publishedValues }));
  },
});

/** Indexed string filtering/search/sort for CMS repeaters. */
export const listPublishedIndexed = query({
  args: {
    collectionId: v.id("cmsCollections"),
    fieldId: v.string(),
    localeCode: v.string(),
    match: v.optional(v.string()),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({ _id: v.id("cmsEntries"), values: v.any() })),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));
    const needle = args.match?.trim().toLocaleLowerCase();
    const base = ctx.db
      .query("cmsScalarIndexes")
      .withIndex("by_collection_field_locale_string", (q) => {
        const indexed = q
          .eq("collectionId", args.collectionId)
          .eq("fieldId", args.fieldId)
          .eq("localeCode", args.localeCode);
        return needle
          ? indexed.gte("stringValue", needle).lt("stringValue", `${needle}\uffff`)
          : indexed;
      })
      .order(args.order ?? "asc");
    const rows = await base.take(limit);
    const entries = await Promise.all(rows.map((row) => ctx.db.get(row.entryId)));
    return entries
      .filter(
        (entry): entry is Doc<"cmsEntries"> =>
          !!entry && entry.status === "published" && entry.publishedValues !== undefined,
      )
      .map((entry) => ({ _id: entry._id, values: entry.publishedValues }));
  },
});

export const listPublishedPage = query({
  args: {
    collectionId: v.id("cmsCollections"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({ _id: v.id("cmsEntries"), values: v.any() }),
  ),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("cmsEntries")
      .withIndex("by_collection_status", (q) =>
        q
          .eq("collectionId", args.collectionId)
          .eq("status", "published"),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page
        .filter((entry) => entry.publishedValues !== undefined)
        .map((entry) => ({ _id: entry._id, values: entry.publishedValues })),
    };
  },
});
