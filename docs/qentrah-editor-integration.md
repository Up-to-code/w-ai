# Qentrah editor integration

## Current behavior

The page edit route loads authenticated page data on the server, then hands a
versioned Qentrah Craft document to the client editor. Preview and tenant routes
share the same resolver and responsive viewport provider. Legacy Puck documents
remain readable until they are resaved through Qentrah.

## Target boundaries

- The route page remains a Server Component responsible for authenticated
  organization/page loading and serializable props only.
- `components/qentrah/qentrah-editor.tsx` owns the interactive Craft.js editor, responsive
  canvas, block library, layers, inspector, history, save and publish controls.
- `components/qentrah/page-renderer.tsx` owns read-only rendering for preview and tenant
  pages.
- `lib/qentrah/page-data` owns version detection, starter documents and the
  temporary legacy Puck compatibility boundary.
- Convex stores a versioned builder payload. Authorization remains enforced by
  the existing `requireEditor`/`requireOrgAccess` server helpers.

## Implementation passes

### Pass 1: Harden the editor controls

Current behavior: Device glyphs are ambiguous, zoom persists unexpectedly
between breakpoints, inspector tabs contain no-op controls, and layout editing
is flex-only.

Structural improvement: Use real responsive SVG icons, fit/reset zoom behavior,
a working selected-node toolbar, working settings tab, and grid/flex controls.

Validation check: Exercise every visible control in Chrome and require a clean
console.

### Pass 2: Introduce a versioned Craft payload

Current behavior: Convex validates the Puck top-level shape.

Structural improvement: Accept either the existing Puck document or a Qentrah
Craft document `{ builder: "qentrah", version: 1, serialized: string }` during
the migration. New saves always write Qentrah data.

Validation check: Convex code generation and TypeScript validation pass; an
existing page opens and can be saved into the new format.

### Pass 3: Replace the editor route

Current behavior: `PageEditor` imports and renders Puck.

Structural improvement: The route composes the Qentrah client editor and keeps
save/publish mutations in a domain hook.

Validation check: Back, responsive modes, selection, editing, save, preview and
publish work from the existing dashboard route.

### Pass 4: Share rendering

Current behavior: Preview and tenant routes call Puck's renderer directly.

Structural improvement: Both routes use one Qentrah read-only renderer, with a
legacy fallback only for rows not yet re-saved.

Validation check: A newly saved page is identical in editor preview, dashboard
preview and tenant output.

### Pass 5: Responsive styles and media backgrounds

Current behavior: All is the default scope and applies the edited property to
every screen. Desktop, tablet and mobile scopes write only to that device; an
edit in one never changes the other two. The same rule applies to content, size,
spacing, layout, color, background media, quick colors and resize handles.
Structure remains shared. Every inspector field exposes scope controls, while
Advanced responsive controls add scoped visibility and reset.

Structural improvement: Inspector controls are grouped into collapsible Layout,
Spacing, Size & position, Item in parent, Background and Advanced responsive
sections. Background mode conditionally exposes solid color, gradient, uploaded
image or uploaded video controls. Uploads use the authenticated Convex asset
pipeline and its existing organization limits.

Validation check: A desktop property edit does not change its mobile value,
reset removes only the selected device values, and published rendering chooses
the correct device state without duplicating page structure.

## Parity gates

- Existing authentication and organization scoping remain server-enforced.
- No visible button or tab is a placeholder.
- Saved content survives reload.
- Responsive canvas fit never mutates the page document.
- Unit tests, lint, TypeScript, Next production build and one Convex push pass.

## Current interaction model

- The left rail switches between elements, reusable sections, components,
  collections, libraries and layers. The tool panel closes independently and
  both sidebars can be resized without changing the page document.
- Selecting a node exposes a canvas outline, four resize handles, a full-surface
  move target, quick insertion, rename, parent selection, delete, color and
  reset-size actions. Double-clicking the selected element renames its layer.
- Style fields are contextual. Flex, grid, background media, border and
  responsive controls only reveal settings that apply to the current choice.
  Layout opens first; secondary and advanced groups remain collapsed.
- Animation is a GSAP-backed runtime shared by editor playback, preview and the
  published site. Effect, trigger and timing controls are conditional, custom
  motion is supported, and reduced-motion preferences bypass movement.
