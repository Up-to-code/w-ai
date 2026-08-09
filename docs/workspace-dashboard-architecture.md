# Workspace dashboard architecture

## Outcome

The root `/dashboard` becomes the account-level workspace. It owns project
organization, people, subscription, usage, billing, integrations, and shared
libraries. A site is a project inside that workspace. Opening a site enters its
site-specific dashboard at `/dashboard/[site]/pages`.

This removes the current ambiguity where an `organization` is treated as both a
workspace and a site.

## Product hierarchy

```text
Account
└── Workspace
    ├── Members and invitations
    ├── Subscription, usage, billing profile, and invoices
    ├── Integrations
    ├── Shared libraries and templates
    ├── Folders
    │   └── Projects
    └── Projects (sites)
        ├── Pages
        ├── CMS collections, orders, and forms
        ├── Domains
        └── Site settings
```

## Routes

Workspace routes are real, bookmarkable pages under one shared shell:

- `/dashboard` — all projects
- `/dashboard/folders/[folderId]` — projects in a folder
- `/dashboard/sites` — sites-only project filter
- `/dashboard/settings` — workspace identity and defaults
- `/dashboard/team` — members, roles, and invitations
- `/dashboard/plans` — plan comparison and subscription state
- `/dashboard/usage` — bandwidth, storage, seats, sites, and limits
- `/dashboard/billing` — billing email, company profile, balance, invoices,
  and payment method
- `/dashboard/integrations` — connected applications
- `/dashboard/libraries` — installed, owned, and marketplace libraries

Site routes remain under `/dashboard/[site]/*`. They never duplicate workspace
settings.

## Data boundaries

### New workspace domain

- `workspaces`: name, owner, plan, status, billing profile, created/updated time
- `workspaceMemberships`: workspace, user, role, invitation state
- `workspaceInvitations`: workspace, email, role, token, expiry
- `projectFolders`: workspace, name, order, created/updated time
- `workspaceProjects`: workspace, existing organization/site id, optional folder,
  order, archived state
- `workspaceSubscriptions`: provider identifiers, status, plan, period
- `workspaceInvoices`: immutable invoice metadata and provider references

Existing `organizations` continue to represent sites during migration. A
`workspaceProjects` record links each site into its owning workspace, avoiding a
destructive rewrite of every site-scoped table.

### Existing domains reused

- `memberships` remain temporary site-level access until workspace roles are
  propagated deliberately.
- `componentLibraries`, `libraryInstallations`, and `libraryEntitlements` are
  reused, then linked to the workspace rather than pretending one site owns all
  shared libraries.
- `subscriptions` is migrated to the workspace boundary; payment processing is
  not faked in UI before a provider is connected.

## Interaction rules

- Creating, renaming, and deleting folders is persisted in Convex.
- Moving a project uses a menu and drag/drop; both call the same mutation.
- Deleting a folder never deletes its projects. Projects return to All projects.
- Deleting a site is a separate confirmed action and uses the existing guarded
  site deletion flow.
- Search, sorting, and grid/list choice are URL/UI state; project and folder data
  remain reactive Convex data.
- Team, billing, usage, and libraries render real stored/provider data. Empty
  states are honest and actionable rather than seeded demo content.

## Delivery passes

### Pass 1: Workspace foundation and migration

Current behavior: each site is an organization and `/dashboard` directly lists
all organizations available to the signed-in user.

Structural improvement: add a workspace above sites, create workspace ownership
and project links, and lazily backfill one personal workspace per existing user.

Validation check: every existing user sees exactly the same sites after
migration; opening a site still resolves to `/dashboard/[site]/pages`.

### Pass 2: Shared dashboard shell and project folders

Current behavior: the root dashboard has a one-item sidebar and no persisted
project organization.

Structural improvement: add the common workspace navigation, real folder routes,
folder CRUD, project movement, search, sorting, and grid/list views.

Validation check: create, rename, open, and delete a folder; move a site in and
out; reload and confirm the structure remains.

### Pass 3: Workspace settings and team

Current behavior: settings and memberships are attached to individual sites.

Structural improvement: add workspace identity/defaults, member table,
invitations, and role management with backend-enforced owner/admin access.

Validation check: invite a member, change a role, revoke an invitation, and
confirm a non-admin cannot perform administrative mutations.

### Pass 4: Plans, usage, and billing

Current behavior: plan data exists per site and the subscription table is only a
placeholder.

Structural improvement: calculate workspace usage, expose plan limits, store the
billing profile, and integrate provider-backed subscriptions, invoices, and
payment methods.

Validation check: usage equals the sum of workspace projects; billing data is
owner-only; provider webhook updates are idempotent.

### Pass 5: Libraries and integrations

Current behavior: library records exist but ownership is scoped to a platform,
user, or individual organization/site.

Structural improvement: show installed, owned, and marketplace libraries at the
workspace level and connect entitlements/installations to every eligible site.

Validation check: install and remove a free library, verify eligible editors can
use it in each workspace site, and confirm paid/private access is enforced by the
backend.

## Parity gates

- Existing accounts, sites, pages, domains, and editor links remain accessible.
- No duplicate All pages/site Overview screen returns.
- No client-supplied workspace/site id grants access without a backend membership
  check.
- Convex schema push, TypeScript, and production build pass after every pass.
- Responsive sidebar and project grid are checked at desktop, tablet, and mobile
  widths.
