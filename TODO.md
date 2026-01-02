# TODO.md — tagit-dashboard
# Date: 2026-01-02
# Status: Active
# Phase: Admin Console Priority Build

## Phase 1: Foundation (Jan 2-8)
- [ ] Complete TAGITCore ABI with all lifecycle functions
- [ ] Add TAGITAccess + IdentityBadge ABIs
- [ ] Create wagmi hooks: useAsset, useAssetState, useBadgeCheck
- [ ] Implement RequireCapability guard in @tagit/auth
- [ ] Implement RequireBadge guard in @tagit/auth

## Phase 2: Admin Console Core (Jan 9-22)
- [ ] /dashboard — System metrics dashboard
- [ ] /assets — All assets table with filters
- [ ] /assets/[id] — Asset detail with lifecycle timeline
- [ ] /users — User management table
- [ ] /badges — Badge grant/revoke interface
- [ ] /capabilities — Capability management

## Phase 3: Admin Workflows (Jan 23-31)
- [ ] /resolve — Flagged asset queue
- [ ] /resolve/[id] — AIRP resolution flow
- [ ] /governance — Proposals dashboard
- [ ] /governance/[id] — Voting interface

## Phase 4: Shared Components (Parallel)
- [ ] AssetCard, AssetLifecycleTimeline
- [ ] BadgeDisplay, CapabilityGate
- [ ] TransactionButton, DataTable, MetricCard
