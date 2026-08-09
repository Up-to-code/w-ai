# W-AI Puck editor integration

## Runtime boundary

- `components/qentrah/puck-page-editor.tsx` owns the interactive Puck 0.23 editor,
  locale selector, responsive canvas, inspector overrides, save, preview, and
  per-locale publication controls.
- `components/qentrah/page-renderer.tsx` is the only read-only renderer used by
  preview and tenant routes.
- `lib/puck/config.tsx` is the component and field registry. Dynamic collection
  fields use Puck's dynamic-field and external-data APIs; rich text uses Tiptap.
- `lib/puck/page-document.ts` owns the PageDocumentV2 envelope, legacy migration,
  sparse override resolution, linking, and CMS binding references.
- Convex authorizes every editor query and mutation. Tenant-facing functions
  return immutable published page and CMS snapshots only.

## Localization model

English is the only language seeded for new sites. Additional language profiles
are site-level capabilities that must be enabled separately on each page. The
dashboard interface locale never changes the canvas locale.

Properties resolve in this order:

1. shared global value;
2. viewport value;
3. locale value;
4. locale-and-viewport value.

Missing overrides remain linked. Editing localized content detaches that
property; relinking removes the sparse override. Layout and styling remain
linked until explicitly detached. Published revisions are immutable and scoped
to one locale.

## Routing and CMS

- Default English pages use `/` and `/about`.
- Secondary locales use `/{locale}` and `/{locale}/{localizedSlug}`.
- Unpublished secondary locales return 404 and never expose English fallback.
- Tenant routes resolve hostname in Proxy, but resolve locale, pages, redirects,
  navigation, and dynamic CMS details in the tenant server route.
- CMS bindings store references, not copied values. Published repeaters and
  detail routes read normalized route/scalar indexes and published snapshots.

## Migration and release gate

`convex/migrations.ts` creates immutable legacy backups and idempotently converts
legacy Craft or Puck payloads to Puck v2. The migration runner is intentionally
not executed during a deploy; run it only after taking a production backup and
validating the target deployment.

Release requires unit tests, TypeScript, Convex validation, a production Next.js
build, and authenticated browser smoke tests of editor save/publish behavior.
