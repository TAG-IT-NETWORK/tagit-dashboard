# TAG IT Dashboard — Claude Code Instructions

## Project Overview

Multi-tenant dashboard for the TAG IT Network product authentication platform. Built on Optimism (OP Stack) with BIDGES badge-based access control.

## Architecture

- **Monorepo**: Turborepo + pnpm workspaces
- **Apps**: 4 Next.js 14 applications
    - `admin` — Internal dashboard (TAG IT team, Gov/Mil)
    - `console` — B2B portal (Manufacturers, Retailers, Recyclers)
    - `app` — Consumer app (end users, no badge required)
    - `verify` — Public verification (no auth)
- **Packages**: Shared code
    - `@tagit/ui` — React components (shadcn/ui)
    - `@tagit/contracts` — ABIs, addresses, typed wagmi hooks
    - `@tagit/auth` — BIDGES authentication logic
    - `@tagit/config` — Chain configs, wagmi setup

## Smart Contracts (OP Sepolia)

| Contract | Address | Purpose |
| --- | --- | --- |
| TAGITCore | `0x6a58eE8f2d500981b1793868C55072789c58fba6` | Asset lifecycle (mint, bind, activate, claim, flag, resolve, recycle) |
| TAGITAccess | `0xf7efefc59E81540408b4c9c2a09417Ddb10b4936` | Capability checks |
| IdentityBadge | `0xb3f757fca307a7febA5CA210Cd7D840EC0999be8` | Soulbound identity (ERC-5192) |
| CapabilityBadge | `0xfa7E212efc6E9214c5dE5bd29C9f1e4ef089486` | Role capabilities (ERC-1155) |

## BIDGES Access Control

Identity badges are soulbound (non-transferable). Capability badges grant specific permissions.

### Identity Badge Types

- `ADMIN (1)` — TAG IT team, full access
- `GOV_MIL (2)` — Government/Military, full access
- `MANUFACTURER (3)` — Can mint and bind
- `RETAILER (4)` — Can activate
- `RECYCLER (5)` — Can recycle

### Capabilities

- `MINT (1)`, `BIND (2)`, `ACTIVATE (3)`, `CLAIM (4)`, `FLAG (5)`, `RESOLVE (6)`, `RECYCLE (7)`

### Access Rules

- Consumers (no badge) can CLAIM and FLAG
- Public (no wallet) can only view via `verify` app
- All write operations require wallet signature
- UI should hide actions user cannot perform

## Asset Lifecycle

`MINTED → BOUND → ACTIVATED → CLAIMED → FLAGGED → RECYCLED`

## Tech Stack

- Next.js 14 (App Router)
- TypeScript (strict mode)
- wagmi 2.x + viem
- RainbowKit for wallet connection
- Tailwind CSS + shadcn/ui
- TanStack Query for data fetching
- React Hook Form + Zod for forms

## Code Style

- Use `pnpm` for package management
- Prefer named exports
- Use absolute imports with `@/` prefix within apps
- Use `@tagit/*` imports for shared packages
- All components should be typed with explicit Props interfaces
- Use `"use client"` directive only when needed

## Commands

- `pnpm dev` — Start all apps
- `pnpm dev --filter=admin` — Start specific app
- `pnpm build` — Build all apps
- `pnpm lint` — Lint all packages
- `pnpm typecheck` — Type check all packages

## Related Repositories

- `tagit-contracts` — Solidity smart contracts (source of ABIs)
- `tagit-sdk` — JavaScript SDK (future)
- `tagit-docs` — Documentation site

## Domain Mapping (Production)

- `admin.tagit.network` — Admin app
- `console.tagit.network` — B2B console
- `app.tagit.network` — Consumer app
- `verify.tagit.network` — Public verification
