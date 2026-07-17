import { describe, it, expect } from "vitest";
import { keccak256, toBytes, toHex } from "viem";
import {
  MAX_BATCH_SIZE,
  BATCH_BIND_DOMAIN,
  challengeResponseForToken,
  computeBatchBindDigest,
  parseAssetMintedTokenIds,
} from "../batch-utils";

describe("MAX_BATCH_SIZE", () => {
  it("mirrors TAGITCore.MAX_BATCH_SIZE (100)", () => {
    expect(MAX_BATCH_SIZE).toBe(100);
  });
});

describe("BATCH_BIND_DOMAIN", () => {
  it("equals keccak256 of the raw UTF-8 bytes of the domain string", () => {
    // Mirrors Solidity's `keccak256("TAGIT_BATCH_BIND_V1")` — hashes the string's
    // bytes directly, no ABI encoding. Cross-checked against `cast keccak
    // "TAGIT_BATCH_BIND_V1"` (independent implementation).
    expect(BATCH_BIND_DOMAIN).toBe(keccak256(toBytes("TAGIT_BATCH_BIND_V1")));
    expect(BATCH_BIND_DOMAIN).toBe(
      "0x6c6219ec392836bdb05402f4227a425a7e2d0bd1da6e6e7e5150eedb58d09c14",
    );
  });
});

describe("challengeResponseForToken", () => {
  it("encodes `challenge${tokenId}` as UTF-8 bytes, matching useBindTag's convention", () => {
    expect(challengeResponseForToken(1n)).toBe(toHex(toBytes("challenge1")));
    expect(challengeResponseForToken(42n)).toBe(toHex(toBytes("challenge42")));
  });

  it("is deterministic for the same tokenId", () => {
    expect(challengeResponseForToken(7n)).toBe(challengeResponseForToken(7n));
  });

  it("differs across tokenIds", () => {
    expect(challengeResponseForToken(1n)).not.toBe(challengeResponseForToken(2n));
  });
});

describe("computeBatchBindDigest", () => {
  // Golden vector — cross-checked byte-for-byte against `cast abi-encode` +
  // `cast keccak` (Foundry's independent Rust ABI encoder/hasher), NOT just
  // this module's own output. Regenerate with:
  //
  //   DOMAIN=0x6c6219ec392836bdb05402f4227a425a7e2d0bd1da6e6e7e5150eedb58d09c14
  //   ADDR=0x1234567890123456789012345678901234567890
  //   TAG1=<keccak256("tag1")> TAG2=<keccak256("tag2")>
  //   RESP1=<keccak256(toHex(toBytes("challenge1")))> RESP2=<keccak256(toHex(toBytes("challenge2")))>
  //   ENC=$(cast abi-encode "f(bytes32,uint256,address,uint256[],bytes32[],bytes32[])" \
  //     $DOMAIN 84532 $ADDR "[1,2]" "[$TAG1,$TAG2]" "[$RESP1,$RESP2]")
  //   cast keccak "$ENC"
  it("matches the independently-computed reference digest for a 2-item batch", () => {
    const contractAddress = "0x1234567890123456789012345678901234567890" as const;
    const tokenIds = [1n, 2n];
    const tagHashes = [keccak256(toBytes("tag1")), keccak256(toBytes("tag2"))];
    const challengeResponses = [toHex(toBytes("challenge1")), toHex(toBytes("challenge2"))];

    const digest = computeBatchBindDigest({
      chainId: 84532,
      contractAddress,
      tokenIds,
      tagHashes,
      challengeResponses,
    });

    expect(digest).toBe("0xb2f33807eb5edc9cdc2aa5bc9c76671e6ebe94538cfaec0a5807c6fbba40bb31");
  });

  it("changes if the chain id changes (cross-chain replay protection)", () => {
    const contractAddress = "0x1234567890123456789012345678901234567890" as const;
    const tokenIds = [1n];
    const tagHashes = [keccak256(toBytes("tag1"))];
    const challengeResponses = [toHex(toBytes("challenge1"))];

    const digestBase = computeBatchBindDigest({
      chainId: 84532,
      contractAddress,
      tokenIds,
      tagHashes,
      challengeResponses,
    });
    const digestOther = computeBatchBindDigest({
      chainId: 1,
      contractAddress,
      tokenIds,
      tagHashes,
      challengeResponses,
    });
    expect(digestBase).not.toBe(digestOther);
  });

  it("changes if the contract address changes (cross-deployment replay protection)", () => {
    const tokenIds = [1n];
    const tagHashes = [keccak256(toBytes("tag1"))];
    const challengeResponses = [toHex(toBytes("challenge1"))];

    const digestA = computeBatchBindDigest({
      chainId: 84532,
      contractAddress: "0x1234567890123456789012345678901234567890",
      tokenIds,
      tagHashes,
      challengeResponses,
    });
    const digestB = computeBatchBindDigest({
      chainId: 84532,
      contractAddress: "0x000000000000000000000000000000000000dead",
      tokenIds,
      tagHashes,
      challengeResponses,
    });
    expect(digestA).not.toBe(digestB);
  });

  it("changes if the batch order changes (tokenIds/tagHashes are positional)", () => {
    const contractAddress = "0x1234567890123456789012345678901234567890" as const;
    const tag1 = keccak256(toBytes("tag1"));
    const tag2 = keccak256(toBytes("tag2"));
    const cr1 = toHex(toBytes("challenge1"));
    const cr2 = toHex(toBytes("challenge2"));

    const forward = computeBatchBindDigest({
      chainId: 84532,
      contractAddress,
      tokenIds: [1n, 2n],
      tagHashes: [tag1, tag2],
      challengeResponses: [cr1, cr2],
    });
    const reversed = computeBatchBindDigest({
      chainId: 84532,
      contractAddress,
      tokenIds: [2n, 1n],
      tagHashes: [tag2, tag1],
      challengeResponses: [cr2, cr1],
    });
    expect(forward).not.toBe(reversed);
  });
});

describe("parseAssetMintedTokenIds", () => {
  const ASSET_MINTED_TOPIC = keccak256(toBytes("AssetMinted(uint256,address,bytes32)"));
  const TRANSFER_TOPIC = keccak256(toBytes("Transfer(address,address,uint256)"));

  function topicForTokenId(tokenId: bigint): `0x${string}` {
    return `0x${tokenId.toString(16).padStart(64, "0")}` as `0x${string}`;
  }

  it("returns [] when logs is undefined", () => {
    expect(parseAssetMintedTokenIds(undefined)).toEqual([]);
  });

  it("returns [] when logs is empty", () => {
    expect(parseAssetMintedTokenIds([])).toEqual([]);
  });

  it("extracts tokenIds from AssetMinted logs in order", () => {
    const logs = [
      { topics: [ASSET_MINTED_TOPIC, topicForTokenId(5n), topicForTokenId(0n)] },
      { topics: [ASSET_MINTED_TOPIC, topicForTokenId(6n), topicForTokenId(0n)] },
      { topics: [ASSET_MINTED_TOPIC, topicForTokenId(7n), topicForTokenId(0n)] },
    ];
    expect(parseAssetMintedTokenIds(logs)).toEqual([5n, 6n, 7n]);
  });

  it("ignores logs from other events (e.g. Transfer) interleaved in the receipt", () => {
    const logs = [
      { topics: [TRANSFER_TOPIC, topicForTokenId(0n), topicForTokenId(1n), topicForTokenId(5n)] },
      { topics: [ASSET_MINTED_TOPIC, topicForTokenId(5n), topicForTokenId(0n)] },
      { topics: [TRANSFER_TOPIC, topicForTokenId(0n), topicForTokenId(1n), topicForTokenId(6n)] },
      { topics: [ASSET_MINTED_TOPIC, topicForTokenId(6n), topicForTokenId(0n)] },
    ];
    expect(parseAssetMintedTokenIds(logs)).toEqual([5n, 6n]);
  });

  it("skips malformed AssetMinted logs missing the indexed tokenId topic", () => {
    const logs = [{ topics: [ASSET_MINTED_TOPIC] }];
    expect(parseAssetMintedTokenIds(logs)).toEqual([]);
  });
});
