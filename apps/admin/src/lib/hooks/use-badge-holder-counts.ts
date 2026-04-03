"use client";

import { useChainId, useReadContracts } from "wagmi";
import { getContractsForChain } from "@tagit/contracts";
import { IdentityBadgeABI, BadgeIds } from "@tagit/contracts";
import { CapabilityBadgeABI, CapabilityIds } from "@tagit/contracts";
import type { BadgeId, CapabilityId } from "@tagit/contracts";

// Known addresses that may hold badges or capabilities on any chain.
// These are the wallets to probe when counting holders.
const KNOWN_HOLDERS = [
  "0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D", // deployer
  "0x92C438dd4E806439e422f82d20047c1D168a1154", // TAG IT Network
  "0xd2Af1892FFcDeDE9E91d7780166bac505A2D5fcd", // Resolver 2
  "0xDb8ACD440Ef32a4D23AD685Dd64aC386b0d3d63F", // SAGE wallet
] as const satisfies `0x${string}`[];

const BADGE_ID_LIST: BadgeId[] = [
  BadgeIds.KYC_L1,
  BadgeIds.KYC_L2,
  BadgeIds.KYC_L3,
  BadgeIds.MANUFACTURER,
  BadgeIds.RETAILER,
  BadgeIds.GOV_MIL,
  BadgeIds.LAW_ENFORCEMENT,
];

const CAPABILITY_KEY_LIST = [
  "MINTER",
  "BINDER",
  "ACTIVATOR",
  "CLAIMER",
  "FLAGGER",
  "RESOLVER",
  "RECYCLER",
] as const;

/**
 * Returns a map of badgeId -> holder count (number of known addresses holding >= 1).
 * Uses balanceOfBatch to batch all known addresses into one call per badge.
 */
export function useBadgeHolderCounts(): {
  counts: Record<BadgeId, number>;
  isLoading: boolean;
} {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  // One balanceOfBatch call per badge ID — all 4 known addresses in each call.
  const calls = BADGE_ID_LIST.map((badgeId) => ({
    address: contracts.IdentityBadge,
    abi: IdentityBadgeABI,
    functionName: "balanceOfBatch" as const,
    args: [
      KNOWN_HOLDERS as unknown as `0x${string}`[],
      KNOWN_HOLDERS.map(() => BigInt(badgeId)),
    ] as [`0x${string}`[], bigint[]],
    chainId,
  }));

  const { data, isLoading } = useReadContracts({ contracts: calls });

  const counts = {} as Record<BadgeId, number>;
  for (let i = 0; i < BADGE_ID_LIST.length; i++) {
    const badgeId = BADGE_ID_LIST[i];
    const result = data?.[i];
    if (result?.status === "success" && Array.isArray(result.result)) {
      counts[badgeId] = (result.result as bigint[]).filter((bal) => bal > 0n).length;
    } else {
      counts[badgeId] = 0;
    }
  }

  return { counts, isLoading };
}

/**
 * Returns a map of capability key -> holder count (number of known addresses holding >= 1).
 * Uses balanceOfBatch to batch all known addresses into one call per capability.
 */
export function useCapabilityHolderCounts(): {
  counts: Record<string, number>;
  isLoading: boolean;
} {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  const calls = CAPABILITY_KEY_LIST.map((key) => {
    const capId: CapabilityId = CapabilityIds[key];
    return {
      address: contracts.CapabilityBadge,
      abi: CapabilityBadgeABI,
      functionName: "balanceOfBatch" as const,
      args: [KNOWN_HOLDERS as unknown as `0x${string}`[], KNOWN_HOLDERS.map(() => capId)] as [
        `0x${string}`[],
        bigint[],
      ],
      chainId,
    };
  });

  const { data, isLoading } = useReadContracts({ contracts: calls });

  const counts: Record<string, number> = {};
  for (let i = 0; i < CAPABILITY_KEY_LIST.length; i++) {
    const key = CAPABILITY_KEY_LIST[i];
    const result = data?.[i];
    if (result?.status === "success" && Array.isArray(result.result)) {
      counts[key] = (result.result as bigint[]).filter((bal) => bal > 0n).length;
    } else {
      counts[key] = 0;
    }
  }

  return { counts, isLoading };
}
