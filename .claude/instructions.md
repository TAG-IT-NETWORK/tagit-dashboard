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

## Smart Contracts (OP Sepolia) — Updated Feb 24, 2026

### Core Contracts
| Contract | Address | Purpose |
| --- | --- | --- |
| TAGITCore | `0x8bde22da889306d422802728cb98b6da42ed8e1a` | Asset lifecycle — UUPS proxy (upgradeable via TimelockController) |
| TAGITAccess | `0x0611FE60f6E37230bDaf04c5F2Ac2dc9012130a9` | Capability checks |
| IdentityBadge | `0x26F2EBb84664EF1eF8554e15777EBEc6611256A6` | Soulbound identity (ERC-5192) |
| CapabilityBadge | `0x5e190F6Ebde4BD1e11a5566a1e81a933cdDf3505` | Role capabilities (ERC-1155) |

### NIST Phase 3 Contracts
| Contract | Address | Purpose |
| --- | --- | --- |
| TAGITRecovery | `0x6138a80c06A5e6a3CB6cc491A3a2c4DF4adD1600` | AIRP dispute resolution |
| TAGITPaymaster | `0x4339c46D63231063250834D9b3fa4E51FdB8026e` | ERC-4337 gas sponsorship |
| TAGITTreasury | `0xf6f5e2e03f6e28aE9Dc17bCc814a0cf758c887c9` | Protocol treasury |
| TAGITPrograms | `0xe78DB7702FF5190DAc2F3E09213Ff84bF9efE32b` | Rewards & reputation |
| TAGITStaking | `0x12EE464e32a683f813fDb478e6C8e68E3d63d781` | Token staking |
| TAGITAccount | `0xC159FDec7a8fDc0d98571C89c342e28bB405e682` | ERC-4337 smart account |
| TAGITAccountFactory | `0x8D27B612a9D3e45d51D2234B2f4e03dCC5ca844b` | Account factory |
| CCIPAdapter | `0x8dA6D7ffCD4cc0F2c9FfD6411CeD7C9c573C9E88` | Cross-chain bridge |

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
