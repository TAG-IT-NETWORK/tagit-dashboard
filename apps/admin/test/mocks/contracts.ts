import { vi } from "vitest";

// Asset states enum matching the contract
export const AssetState = {
  UNMINTED: 0,
  MINTED: 1,
  BOUND: 2,
  VERIFIED: 3,
  CLAIMED: 4,
  FLAGGED: 5,
  RECYCLED: 6,
} as const;

// Mock asset data
export const mockAsset = {
  id: 1n,
  owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  state: AssetState.BOUND,
  tagId: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  metadataURI: "ipfs://QmTest123456789",
  createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400),
  updatedAt: BigInt(Math.floor(Date.now() / 1000)),
};

// Mock multiple assets
export const mockAssets = Array.from({ length: 10 }, (_, i) => ({
  ...mockAsset,
  id: BigInt(i + 1),
  state: i % 7, // Cycle through states
  owner: `0x${(i + 1).toString(16).padStart(40, "0")}`,
}));

// Mock badge IDs
export const BadgeIds = {
  KYC_L1: 1,
  KYC_L2: 2,
  KYC_L3: 3,
  MANUFACTURER: 10,
  RETAILER: 11,
  DISTRIBUTOR: 12,
  GOV_MIL: 20,
  LAW_ENFORCEMENT: 21,
} as const;

// Mock capabilities
export const Capabilities = {
  MINTER: "0x" + "1".padStart(64, "0"),
  BINDER: "0x" + "2".padStart(64, "0"),
  RESOLVER: "0x" + "3".padStart(64, "0"),
  ADMIN: "0x" + "4".padStart(64, "0"),
} as const;

// Mock TAGITCore contract
export const mockTAGITCore = {
  totalSupply: vi.fn().mockResolvedValue(100n),
  getAsset: vi.fn().mockImplementation((tokenId: bigint) => {
    const index = Number(tokenId) - 1;
    return Promise.resolve(mockAssets[index] || mockAsset);
  }),
  getState: vi.fn().mockResolvedValue(AssetState.BOUND),
  ownerOf: vi.fn().mockResolvedValue(mockAsset.owner),
  getTagId: vi.fn().mockResolvedValue(mockAsset.tagId),
};

// Mock IdentityBadge contract
export const mockIdentityBadge = {
  balanceOf: vi.fn().mockResolvedValue(1n),
  hasBadge: vi.fn().mockResolvedValue(true),
  getBadgeIds: vi.fn().mockResolvedValue([BadgeIds.KYC_L1, BadgeIds.KYC_L2]),
};

// Mock AccessControl contract
export const mockAccessControl = {
  hasCapability: vi.fn().mockResolvedValue(true),
  getCapabilities: vi.fn().mockResolvedValue([Capabilities.MINTER, Capabilities.BINDER]),
};

// Mock Governance contract
export const mockGovernance = {
  proposalCount: vi.fn().mockResolvedValue(5n),
  getProposal: vi.fn().mockResolvedValue({
    id: 1n,
    proposer: mockAsset.owner,
    title: "Test Proposal",
    description: "This is a test proposal for unit testing",
    forVotes: 100n,
    againstVotes: 50n,
    abstainVotes: 10n,
    startBlock: 1000n,
    endBlock: 2000n,
    executed: false,
    canceled: false,
  }),
  hasVoted: vi.fn().mockResolvedValue(false),
};

// Mock Resolution data
export const Resolution = {
  CLEAR: 0,
  QUARANTINE: 1,
  DECOMMISSION: 2,
} as const;

// Mock flagged assets for resolution queue
export const mockFlaggedAssets = Array.from({ length: 5 }, (_, i) => ({
  tokenId: String(1000 + i),
  flaggedBy: `0x${(i + 100).toString(16).padStart(40, "0")}`,
  flaggedAt: Date.now() - (i + 1) * 3600000, // Hours ago
  flagReason: `Test flag reason ${i + 1}`,
  previousState: AssetState.VERIFIED,
  owner: mockAsset.owner,
  tagId: mockAsset.tagId,
  metadataURI: mockAsset.metadataURI,
  txHash: `0x${(i + 1).toString(16).padStart(64, "0")}`,
}));

// Setup contract mocks
export function setupContractMocks() {
  vi.mock("@tagit/contracts", () => ({
    AssetState,
    AssetStateNames: {
      0: "UNMINTED",
      1: "MINTED",
      2: "BOUND",
      3: "VERIFIED",
      4: "CLAIMED",
      5: "FLAGGED",
      6: "RECYCLED",
    },
    BadgeIds,
    BadgeIdNames: {
      1: "KYC Level 1",
      2: "KYC Level 2",
      3: "KYC Level 3",
      10: "Manufacturer",
      11: "Retailer",
      12: "Distributor",
      20: "Government/Military",
      21: "Law Enforcement",
    },
    Capabilities,
    CapabilityNames: {
      [Capabilities.MINTER]: "Minter",
      [Capabilities.BINDER]: "Binder",
      [Capabilities.RESOLVER]: "Resolver",
      [Capabilities.ADMIN]: "Admin",
    },
    Resolution,
    useAsset: vi.fn().mockReturnValue({
      data: mockAsset,
      isLoading: false,
      isError: false,
    }),
    useBadges: vi.fn().mockReturnValue({
      badgeIds: [BadgeIds.KYC_L1, BadgeIds.KYC_L2],
      isLoading: false,
    }),
    useCapabilities: vi.fn().mockReturnValue({
      capabilities: [Capabilities.MINTER],
      isLoading: false,
    }),
    useResolve: vi.fn().mockReturnValue({
      resolve: vi.fn(),
      isPending: false,
    }),
    useTotalSupply: vi.fn().mockReturnValue({
      data: 100n,
      isLoading: false,
    }),
  }));
}

// Reset contract mocks
export function resetContractMocks() {
  mockTAGITCore.totalSupply.mockClear();
  mockTAGITCore.getAsset.mockClear();
  mockTAGITCore.getState.mockClear();
  mockIdentityBadge.balanceOf.mockClear();
  mockIdentityBadge.hasBadge.mockClear();
  mockAccessControl.hasCapability.mockClear();
  mockGovernance.proposalCount.mockClear();
  mockGovernance.getProposal.mockClear();
}
