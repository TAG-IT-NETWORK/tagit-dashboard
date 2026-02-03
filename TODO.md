# TODO.md — TAGIT Admin Dashboard
# Live Blockchain Integration Roadmap
# Updated: 2026-01-06

## Current Status
- UI pages built with mock data
- Wagmi hooks available in @tagit/contracts
- Lifecycle test page working (/test/lifecycle)
- Contracts deployed on OP Sepolia (Chain ID: 11155420)

---

## PHASE 1: Wagmi Infrastructure ✅ COMPLETE
**Goal:** Fix all wagmi context issues so hooks work on every page.

- [x] Re-export wagmi hooks from @tagit/contracts (useAccount, useConfig)
- [x] Create WagmiGuard component for hydration safety
- [x] Fix /assets/[id] page params handling
- [x] Audit all pages for hydration errors — added WagmiGuard to dashboard, badges, capabilities, users/[address], resolve/[id]
- [x] Add getAddress() normalization to all address inputs (badges + capabilities pages)
- [x] Implement ContractErrorBoundary for contract call failures
- [x] Fix use(params) incorrect usage in users/[address] and resolve/[id]

---

## PHASE 2: Asset Data Integration ✅ COMPLETE
**Goal:** Replace mock assets with live contract data.

- [x] Create useAllAssets() hook — batch fetches assets using useReadContracts
- [x] Create useAssetsByState() hook for filtering by state
- [x] Implement server-side pagination in useAllAssets
- [x] Add loading skeleton UI for asset table
- [x] Connect /assets page to live contract data with WagmiGuard
- [x] Update /assets/[id] to use real data with proper error/not found states
- [x] Add auto-refetch every 30s for real-time updates
- [x] Add manual refresh button

---

## PHASE 3: AIRP Resolution Flow ✅ COMPLETE
**Goal:** Enable full arbitration workflow for flagged assets.

- [x] Create useFlaggedAssets() — filter where state === FLAGGED
- [x] Connect /resolve page to flagged assets list
- [x] Enable useResolve() on /resolve/[id] page
- [x] Implement resolution type selector (CLEAR=0, QUARANTINE=1, DECOMMISSION=2)
- [x] Add transaction status feedback
- [x] Auto-refetch asset data after resolution

---

## PHASE 4: User & Badge Management ✅ COMPLETE
**Goal:** Live badge/capability data for all users.

- [x] Connect /users/[address] to useBadges(address)
- [x] Connect /users/[address] to useCapabilities(address)
- [x] Implement badge grant/revoke UI
- [x] Implement capability grant/revoke UI
- [x] Add capability gate to admin actions — deferred to Phase 7 (RequireCapability guards)
- [x] Show transaction confirmation modal for writes

---

## PHASE 5: Event Indexing (Subgraph) ✅ COMPLETE
**Goal:** Deploy subgraph for historical data.

- [x] Create subgraph schema in packages/indexer
- [x] Index StateChanged events for asset timeline
- [x] Index Transfer events for ownership history
- [x] Index AssetFlagged events with reason/reporter
- [x] Index badge/capability grants/revocations
- [ ] Deploy to The Graph or Goldsky (ready for deployment)

**Subgraph Structure (packages/indexer):**
- schema.graphql: Asset, User, StateChange, Transfer, Flag, Resolution, BadgeGrant, CapabilityGrant, GlobalStats, DailySnapshot
- mappings: tagit-core.ts, tagit-access.ts, identity-badge.ts
- ABIs: TAGITCore.json, TAGITAccess.json, IdentityBadge.json
- Deploy: `pnpm --filter @tagit/indexer deploy:goldsky`

---

## PHASE 6: Dashboard Metrics ✅ COMPLETE
**Goal:** Real metrics from indexed events.

- [x] Query asset state distribution from subgraph
- [x] Calculate daily mints from Transfer(from: 0x0) events
- [x] Build activity feed from recent StateChanged events
- [x] Derive active users from unique signers (7d)
- [x] Implement polling (30s) for live updates

**Subgraph Hooks (packages/contracts/src/subgraph):**
- `useDashboardData()` - Combined hook with 30s polling for all dashboard data
- `useGlobalStats()` - Total assets, users, transfers, flags
- `useStateDistribution()` - Asset state counts for pie chart
- `useRecentActivity()` - Recent state changes for activity feed
- `useDailyMints()` - Mints in last 24 hours
- `useActiveUsers()` - Active users in last 7 days
- `useTopUsers()` - Top asset owners
- `useRecentFlags()` - Recent flagged assets

**Dashboard Features:**
- Live/Mock data badge indicator
- Manual refresh button
- Subgraph sync status in System Health
- Graceful fallback to contract data + mock when subgraph unavailable

---

## PHASE 7: Polish & Security ✅ COMPLETE
**Goal:** Production-ready admin console.

- [x] Add RequireCapability guards to admin routes
- [x] Implement proper error messages for reverts
- [x] Add rate limiting awareness
- [ ] Test all flows with real testnet transactions (manual)
- [x] Write E2E tests with Playwright

**Security Components (apps/admin/src/components):**
- `require-capability.tsx` - Gates content based on on-chain capabilities
- `transaction-status.tsx` - User-friendly transaction feedback with error parsing
- `rate-limit-handler.tsx` - RPC rate limit detection and backoff utilities

**Error Handling (packages/contracts/src/errors.ts):**
- `TAGIT_ERRORS` - Known contract revert reasons with user-friendly messages
- `parseContractError()` - Parses errors into structured format
- `formatTransactionError()` - Formats errors for display

**E2E Tests (apps/admin/e2e):**
- `security.spec.ts` - Security feature tests (connect wallet, data indicators, navigation)

---

## Out of Scope (Future)
- Governance (TAGITGovernor not deployed)
- Treasury (TAGITTreasury not deployed)
- Token staking
- Cross-chain (CCIP)
- Account abstraction

---

## Quick Reference

### Deployed Contracts (OP Sepolia) — NIST CSF 2.0 Deployment
*Updated: Jan 6, 2026 — All contracts include CircuitBreaker + RateLimiter*

| Contract | Address | Start Block |
|----------|---------|-------------|
| TAGITCore | 0x8B02b62FD388b2d7e3dF5Ec666D68Ac7c7ca02Fe | 37959312 |
| TAGITAccess | 0x0611FE60f6E37230bDaf04c5F2Ac2dc9012130a9 | 37959312 |
| IdentityBadge | 0x26F2EBb84664EF1eF8554e15777EBEc6611256A6 | 37959311 |
| CapabilityBadge | 0x5e190F6Ebde4BD1e11a5566a1e81a933cdDf3505 | 37959312 |

### Available Hooks
**Read:** useAsset, useAssetState, useTotalSupply, useAllAssets, useAssetsByState, useFlaggedAssets, useBadges, useCapabilities, useCapabilityGate, useBadgeCheck
**Write:** useMint, useBindTag, useActivate, useClaim, useFlag, useResolve, useRecycle, useGrantBadge, useRevokeBadge, useGrantCapability, useRevokeCapability
