# TODO.md — tagit-contracts
# Cross-Repo Task: Demo UI Support
# Date: 2025-12-19
# Status: In Progress
# Linked To: tagit-dashboard/tasks/TODO.md

## Objective
Export verified contract ABIs and addresses for tagit-dashboard consumption

## Tasks

### Phase 1: Verify Current State ✅
- [x] Confirm contracts deployed on OP Sepolia
- [x] Verify all 4 contracts functional (TAGITCore, TAGITAccess, IdentityBadge, CapabilityBadge)
- [x] Update deployment-addresses.json with correct addresses

### Phase 2: Export for Dashboard
- [ ] Create `exports/` folder for dashboard consumption
- [ ] Copy minimal ABIs (only needed functions):
  - TAGITCore: name, symbol, totalSupply, mint, getState, ownerOf
  - CapabilityBadge: mint (for granting capabilities)
- [ ] Create `exports/addresses.json` with network-specific addresses
- [ ] Create `exports/README.md` with integration instructions

### Phase 3: Test Integration Points
- [ ] Verify mint() function signature matches ABI
- [ ] Verify getState() returns correct enum values
- [ ] Document any special encoding requirements

## Contract Addresses (OP Sepolia - Chain ID: 11155420)
TAGITCore: 0x6a58eE8f2d500981b1793868C55072789c58fba6
TAGITAccess: 0xf7efefc59E81540408b4c9c2a09417Ddb10b4936
IdentityBadge: 0xb3f757fca307a7febA5CA210Cd7D840EC0999be8
CapabilityBadge: 0xfa7E212efc6E9214c5dE5bd29C9f1e4ef089486

## Handoff to Dashboard
When complete, notify tagit-dashboard with:
- [ ] ABI files ready in exports/
- [ ] Addresses confirmed working
- [ ] Test transaction hash for reference
