# TODO.md — TAGIT Admin Dashboard
# Live Blockchain Integration Roadmap
# Updated: 2026-01-05

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

## PHASE 3: AIRP Resolution Flow
**Goal:** Enable full arbitration workflow for flagged assets.

- [ ] Create useFlaggedAssets() — filter where state === 5
- [ ] Connect /resolve page to flagged assets list
- [ ] Enable useResolve() on /resolve/[id] page
- [ ] Implement resolution type selector (CLEAR=0, QUARANTINE=1, DECOMMISSION=2)
- [ ] Add transaction status feedback
- [ ] Auto-refetch asset data after resolution

---

## PHASE 4: User & Badge Management
**Goal:** Live badge/capability data for all users.

- [ ] Connect /users/[address] to useBadges(address)
- [ ] Connect /users/[address] to useCapabilities(address)
- [ ] Implement badge grant/revoke UI
- [ ] Implement capability grant/revoke UI
- [ ] Add capability gate to admin actions
- [ ] Show transaction confirmation modal for writes

---

## PHASE 5: Event Indexing (Subgraph)
**Goal:** Deploy subgraph for historical data.

- [ ] Create subgraph schema in tagit-indexer repo
- [ ] Index StateChanged events for asset timeline
- [ ] Index Transfer events for ownership history
- [ ] Index AssetFlagged events with reason/reporter
- [ ] Index badge/capability grants/revocations
- [ ] Deploy to The Graph or Goldsky

---

## PHASE 6: Dashboard Metrics
**Goal:** Real metrics from indexed events.

- [ ] Query asset state distribution from subgraph
- [ ] Calculate daily mints from Transfer(from: 0x0) events
- [ ] Build activity feed from recent StateChanged events
- [ ] Derive active users from unique signers (7d)
- [ ] Implement polling (30s) for live updates

---

## PHASE 7: Polish & Security
**Goal:** Production-ready admin console.

- [ ] Add RequireCapability guards to admin routes
- [ ] Implement proper error messages for reverts
- [ ] Add rate limiting awareness
- [ ] Test all flows with real testnet transactions
- [ ] Write E2E tests with Playwright

---

## Out of Scope (Future)
- Governance (TAGITGovernor not deployed)
- Treasury (TAGITTreasury not deployed)
- Token staking
- Cross-chain (CCIP)
- Account abstraction

---

## Quick Reference

### Deployed Contracts (OP Sepolia)
| Contract | Address |
|----------|---------|
| TAGITCore | 0x6a58ee8f2d500981b1793868c55072789c58fba6 |
| TAGITAccess | 0xf7efefc59e81540408b4c9c2a09417ddb10b4936 |
| IdentityBadge | 0xb3f757fca307a7feba5ca210cd7d840ec0999be8 |
| CapabilityBadge | 0xfa7e212efc6e9214c5de5bd29c9f1e4ef0894860 |

### Available Hooks
**Read:** useAsset, useAssetState, useTotalSupply, useAllAssets, useAssetsByState, useBadges, useCapabilities, useCapabilityGate, useBadgeCheck
**Write:** useMint, useBindTag, useActivate, useClaim, useFlag, useResolve, useRecycle, useGrantBadge, useRevokeBadge, useGrantCapability, useRevokeCapability
