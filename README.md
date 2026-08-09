# Curious Vessel — Web Builder

Multi-tenant visual web builder. Create sites, design pages, connect domains.

## Stack

- Next.js (App Router) + TypeScript
- Convex (DB + functions)
- better-auth
- Puck page builder
- shadcn/ui + Tailwind + next-intl (ar/en)

## App surfaces

- Marketing landing (`/`) — product site for Curious Vessel
- Dashboard (`/dashboard`) — sites list, sidebar, pages, domains, site config
- Tenant sites (`{slug}.*` / custom domain) — published Puck pages

## Dev

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```
