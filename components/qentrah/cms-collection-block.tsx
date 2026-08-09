"use client";

import { usePaginatedQuery, useQuery } from "convex/react";
import { Database } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

function localized(value: unknown, locale: string) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const selected = record[locale] ?? record.en ?? Object.values(record)[0];
    if (typeof selected === "string" || typeof selected === "number") return String(selected);
  }
  return "";
}

export function CmsCollectionBlock({
  collectionId,
  titleField = "title",
  bodyField = "description",
  imageField = "image",
  limit = 6,
  columns = "3",
  emptyText = "No published items yet.",
  pagination = "none",
  indexFieldId,
  match,
  sortDirection = "asc",
  locale,
}: {
  collectionId?: string;
  titleField?: string;
  bodyField?: string;
  imageField?: string;
  limit?: number;
  columns?: "2" | "3" | "4";
  emptyText?: string;
  pagination?: "none" | "loadMore";
  indexFieldId?: string;
  match?: string;
  sortDirection?: "asc" | "desc";
  locale: string;
}) {
  const entries = useQuery(
    api.cms.listPublished,
    collectionId && pagination === "none" && !indexFieldId
      ? { collectionId: collectionId as Id<"cmsCollections">, limit }
      : "skip",
  );
  const indexedEntries = useQuery(
    api.cms.listPublishedIndexed,
    collectionId && indexFieldId
      ? {
          collectionId: collectionId as Id<"cmsCollections">,
          fieldId: indexFieldId,
          localeCode: locale,
          match: match || undefined,
          order: sortDirection,
          limit,
        }
      : "skip",
  );
  const paginated = usePaginatedQuery(
    api.cms.listPublishedPage,
    collectionId && pagination === "loadMore" && !indexFieldId
      ? { collectionId: collectionId as Id<"cmsCollections"> }
      : "skip",
    { initialNumItems: limit },
  );
  const renderedEntries = indexFieldId
    ? indexedEntries
    : pagination === "loadMore"
      ? paginated.results
      : entries;
  if (!collectionId) {
    return (
      <div className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        <Database className="mx-auto mb-3 size-5" /> Select a CMS collection.
      </div>
    );
  }
  if (!renderedEntries?.length) {
    return <div className="border border-border p-8 text-center text-sm text-muted-foreground">{emptyText}</div>;
  }
  const columnClass =
    columns === "4" ? "lg:grid-cols-4" : columns === "2" ? "lg:grid-cols-2" : "lg:grid-cols-3";
  return (
    <section className={`grid gap-4 sm:grid-cols-2 ${columnClass}`}>
      {renderedEntries.map((entry) => {
        const values = entry.values as Record<string, unknown>;
        const image = localized(values[imageField], locale);
        return (
          <article key={entry._id} className="overflow-hidden border border-border bg-card">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="aspect-[4/3] w-full object-cover" />
            ) : null}
            <div className="p-5">
              <h3 className="text-lg font-semibold">{localized(values[titleField], locale)}</h3>
              {bodyField ? (
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {localized(values[bodyField], locale)}
                </p>
              ) : null}
            </div>
          </article>
        );
      })}
      {pagination === "loadMore" && paginated.status === "CanLoadMore" ? (
        <button
          type="button"
          onClick={() => paginated.loadMore(limit)}
          className="col-span-full mx-auto border border-border px-4 py-2 text-sm hover:bg-muted"
        >
          Load more
        </button>
      ) : null}
    </section>
  );
}

export function CmsFieldBlock({
  collectionId,
  fieldKey = "title",
  fallback = "Select a CMS field",
  locale,
  entryValues,
}: {
  collectionId?: string;
  fieldKey?: string;
  fallback?: string;
  locale: string;
  entryValues?: Record<string, unknown>;
}) {
  const preview = useQuery(
    api.cms.listPublished,
    !entryValues && collectionId
      ? { collectionId: collectionId as Id<"cmsCollections">, limit: 1 }
      : "skip",
  );
  const values = entryValues ?? (preview?.[0]?.values as Record<string, unknown> | undefined);
  const value = values ? localized(values[fieldKey], locale) : "";
  return value ? (
    <span data-cms-field={fieldKey}>{value}</span>
  ) : (
    <span className="text-muted-foreground">{fallback}</span>
  );
}
