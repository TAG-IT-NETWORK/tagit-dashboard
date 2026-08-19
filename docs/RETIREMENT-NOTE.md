# RETIREMENT NOTE — hardcoded demo metadata + /test/lifecycle mint path (META-T18)

## ⛔ MERGE GATE — gap #12

**Do NOT merge this branch to main until the tokens 5 / 18 / 19 / 20 backfill
is verified GREEN on verify.tagit.network.**

The backfill (`--execute`, tagit-services `scripts/` on branch `meta/p1-wave1`)
is still pending the T16 services deploy. Until it runs, tokens 5/18/19/20 have
no catalog rows in the services DB, so after this branch ships they render with
no product name/price anywhere the retired hardcoded maps used to cover them:

- `apps/verify` — `ASSET_METADATA` map + `DEFAULT_PRICE_USDC=1`
  (deleted in the `feat(verify)` META-T17 commit on this branch)
- `apps/admin/src/app/lifecycle/page.tsx` — `ASSET_METADATA` demo map
  (deleted in the `feat(admin)` META-T18 commit)
- `apps/admin/src/app/test/lifecycle/*` — the wallet-signed mint path
  (deleted in the same commit; minting is now DB-first via `/assets/new` →
  `POST {SERVICES_URL}/api/v1/assets/mint`)

**Verification before merge:** open
`https://verify.tagit.network/asset/5` (and 18/19/20) and confirm the product
block renders from the services API with the metadata-anchor band green
("Verified"). Then this note's gate is satisfied and the file can be removed in
a follow-up.

## What replaced the retired paths

| Retired                                                      | Replacement                                                                                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify `ASSET_METADATA` / `DEFAULT_PRICE_USDC`               | `GET {SERVICES_URL}/api/v1/assets/:tokenId` (product/media/verification) + `GET .../price` (canonical price; widget hides without a live listing)        |
| admin lifecycle demo map                                     | token-id-only display; product identity lives in the services catalog                                                                                    |
| `/test/lifecycle` mint step (wallet `mint()` + IPFS pinning) | `/assets/new` minimal mint form → `/api/media-proxy` + `/api/mint-proxy` (keys server-side, `mintRequestId` idempotency, `template_id` null first-class) |
