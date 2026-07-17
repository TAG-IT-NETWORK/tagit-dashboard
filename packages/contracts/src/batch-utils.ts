import { encodeAbiParameters, parseAbiParameters, keccak256, toBytes, toHex } from "viem";

/**
 * Pure (non-React) helpers for the batch mint/bind/activate lifecycle used by
 * the admin "Assembly Line" bulk chip-programming flow. Kept separate from
 * hooks.ts so the digest math and receipt parsing can be unit-tested without
 * mocking wagmi's React bindings.
 *
 * Ground truth: src/core/TAGITCore.sol (tagit-contracts, branch
 * feat/batch-lifecycle) — batchMint / batchBind / batchActivate / batchFlag.
 */

/**
 * Mirrors `uint256 public constant MAX_BATCH_SIZE = 100;` in TAGITCore.sol.
 * batchMint/batchBind/batchActivate/batchFlag all revert with
 * BatchTooLarge(provided, maximum) above this.
 */
export const MAX_BATCH_SIZE = 100;

/**
 * Domain separator for the batch-bind oracle attestation. Mirrors
 * `bytes32 public constant BATCH_BIND_DOMAIN = keccak256("TAGIT_BATCH_BIND_V1");`
 * in TAGITCore.sol — keccak256 of the raw UTF-8 string bytes (Solidity's
 * `keccak256("...")` on a string literal hashes the bytes directly, it does
 * not ABI-encode them first).
 */
export const BATCH_BIND_DOMAIN = keccak256(toBytes("TAGIT_BATCH_BIND_V1"));

/**
 * Deterministic placeholder challenge-response for a token, matching the
 * convention already used by the single-bind flow (useBindTag):
 * `challenge${tokenId}` encoded as UTF-8 bytes. Real SDM challenge/response
 * wiring is a later phase; this keeps batchBind's oracle-signature shape
 * exercised end-to-end today.
 */
export function challengeResponseForToken(tokenId: bigint): `0x${string}` {
  return toHex(toBytes(`challenge${tokenId.toString()}`));
}

export interface BatchBindDigestParams {
  chainId: number;
  contractAddress: `0x${string}`;
  tokenIds: bigint[];
  tagHashes: `0x${string}`[];
  /** Raw challenge-response bytes, NOT their hashes — this function hashes them. */
  challengeResponses: `0x${string}`[];
}

/**
 * Computes the batch-bind oracle attestation digest:
 *
 *   keccak256(abi.encode(BATCH_BIND_DOMAIN, chainId, contractAddress,
 *     tokenIds, tagHashes, responseHashes))
 *
 * where `responseHashes[i] = keccak256(challengeResponses[i])` — this
 * mirrors `TAGITCore.batchBind()` exactly (see src/core/TAGITCore.sol,
 * tagit-contracts). Cross-checked byte-for-byte against `cast abi-encode` +
 * `cast keccak` (an independent ABI-encoding implementation) — see the
 * golden-vector test in __tests__/batch-utils.test.ts.
 *
 * The caller signs this digest RAW via wagmi's
 * `walletClient.signMessage({ message: { raw: toBytes(digest) } })`, which
 * applies the EIP-191 personal-sign prefix that the contract verifies via
 * `MessageHashUtils.toEthSignedMessageHash` + `ECDSA.recover`.
 */
export function computeBatchBindDigest(params: BatchBindDigestParams): `0x${string}` {
  const { chainId, contractAddress, tokenIds, tagHashes, challengeResponses } = params;
  const responseHashes = challengeResponses.map((response) => keccak256(response));
  const encoded = encodeAbiParameters(
    parseAbiParameters("bytes32, uint256, address, uint256[], bytes32[], bytes32[]"),
    [BATCH_BIND_DOMAIN, BigInt(chainId), contractAddress, tokenIds, tagHashes, responseHashes],
  );
  return keccak256(encoded);
}

/** keccak256("AssetMinted(uint256,address,bytes32)") — topics[0] for the event. */
const ASSET_MINTED_TOPIC = keccak256(toBytes("AssetMinted(uint256,address,bytes32)"));

/** Minimal shape of a viem transaction receipt log — just enough to parse tokenIds. */
export interface MinimalLog {
  topics: readonly `0x${string}`[];
}

/**
 * Recovers the newly-minted tokenIds from a batchMint() receipt by scanning
 * for `AssetMinted(uint256 indexed tokenId, address indexed to, bytes32 metadata)`
 * logs (topics[1] = tokenId). batchMint emits one AssetMinted per item in
 * recipients/metadata order, so the returned array preserves that order.
 * Returns [] for an empty/undefined log list — safe to call before the
 * receipt has landed.
 */
export function parseAssetMintedTokenIds(logs: readonly MinimalLog[] | undefined): bigint[] {
  if (!logs) return [];
  return logs
    .filter((log) => log.topics[0] === ASSET_MINTED_TOPIC && log.topics[1] !== undefined)
    .map((log) => BigInt(log.topics[1] as `0x${string}`));
}
