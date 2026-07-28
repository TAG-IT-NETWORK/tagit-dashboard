export const TAGITCoreABI = [
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "getAsset",
    outputs: [
      { type: "address", name: "assetOwner" },
      { type: "uint64", name: "timestamp" },
      { type: "uint8", name: "state" },
      { type: "uint8", name: "flags" },
      { type: "uint16", name: "reserved" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "ownerOf",
    outputs: [{ type: "address", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "bytes32", name: "tagHash" }],
    name: "getTokenByTag",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "getTagByToken",
    outputs: [{ type: "bytes32", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    // keccak256 of the off-chain metadata JSON — the DPP integrity anchor.
    inputs: [{ type: "uint256", name: "" }],
    name: "metadataHash",
    outputs: [{ type: "bytes32", name: "" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * The four TAGITCore events that make up an asset's lifecycle history.
 *
 * Kept separate from TAGITCoreABI (which is function-only and is what
 * `readContract` consumes) so neither list has to be filtered at every call
 * site. Transcribed from tagit-contracts/src/core/TAGITCore.sol lines 259-286.
 *
 * EVERY ONE HAS `tokenId` INDEXED, and that is the property @/lib/lifecycle
 * depends on: it makes topic1 a server-side filter, so an eth_getLogs for one
 * token returns that token's events rather than the whole contract's log volume
 * for us to sift client-side. `State` is a Solidity enum, so its canonical ABI
 * type — and therefore the type that goes into the topic0 signature hash — is
 * `uint8`, NOT `State`. Getting that wrong yields a topic0 that matches nothing
 * and a history that is silently, permanently empty.
 *
 * Verify the topic hashes against the chain rather than trusting this comment:
 *   cast keccak "StateChanged(uint256,uint8,uint8,address)"
 *     -> 0x5c6b40cc9c243e5932bb50b35997a88a50ea5263e1db10c10f168de3c1ba0f71
 *   cast keccak "AssetMinted(uint256,address,bytes32)"
 *     -> 0xb49a1942181676c53a45adef7c0e3378f270b5f4bed5c43d6cefb7886f82a0a9
 *   cast keccak "TagBound(uint256,bytes32)"
 *     -> 0xc2d03547b772fd22e620aac789d884d7b502e1e0499abaa02dce3bd86022f3fe
 *   cast keccak "AssetResold(uint256,address,address)"
 *     -> 0x71bd2049f64d1fd0969ab18322a80a3c0214dc909dcbe27e5da596bc5958c1bc
 */
export const TAGITCoreEventsABI = [
  {
    type: "event",
    name: "StateChanged",
    inputs: [
      { type: "uint256", name: "tokenId", indexed: true },
      { type: "uint8", name: "from", indexed: false },
      { type: "uint8", name: "to", indexed: false },
      { type: "address", name: "actor", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "AssetMinted",
    inputs: [
      { type: "uint256", name: "tokenId", indexed: true },
      { type: "address", name: "to", indexed: true },
      { type: "bytes32", name: "metadata", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TagBound",
    inputs: [
      { type: "uint256", name: "tokenId", indexed: true },
      { type: "bytes32", name: "tagHash", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "AssetResold",
    inputs: [
      { type: "uint256", name: "tokenId", indexed: true },
      { type: "address", name: "from", indexed: true },
      { type: "address", name: "to", indexed: true },
    ],
    anonymous: false,
  },
] as const;
