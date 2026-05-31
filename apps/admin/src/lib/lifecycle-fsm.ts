/**
 * Asset lifecycle finite state machine — the single source of truth for the
 * Digital Twin Console. Encodes the REAL branched FSM enforced on-chain by
 * TAGITCore (post recall/resale upgrade, 2026-05-30), NOT the old linear path.
 *
 * Actions are derived from the asset's *current state* + the connected wallet's
 * BIDGES capabilities — never from a hardcoded step index. This is what lets the
 * UI offer "Flag" on a BOUND asset (manufacturer recall) or "Resell" on a
 * CLAIMED one, exactly mirroring the contract's guards.
 *
 * Contract transition table (TAGITCore.sol):
 *   mint     NONE                              -> MINTED      (MINTER)
 *   bindTag  MINTED                            -> BOUND       (BINDER)
 *   activate BOUND                             -> ACTIVATED   (ACTIVATOR)
 *   claim    ACTIVATED                         -> CLAIMED     (CLAIMER)
 *   flag     BOUND | ACTIVATED | CLAIMED       -> FLAGGED     (FLAGGER)
 *   resolve  FLAGGED -> exact pre-flag state   (2-of-3 RESOLVER quorum)
 *   recycle  MINTED|BOUND|ACTIVATED|CLAIMED|FLAGGED -> RECYCLED (RECYCLER)
 *   transferAsset CLAIMED -> CLAIMED (owner-gated resale; owner changes)
 */
import { useAccount } from "wagmi";
import {
  AssetState,
  type AssetStateType,
  CapabilityHashes,
  type CapabilityKey,
  useCapabilityGate,
} from "@tagit/contracts";

export type LifecycleActionKey =
  | "bind"
  | "activate"
  | "claim"
  | "flag"
  | "resolve"
  | "recycle"
  | "transfer";

export interface LifecycleTransition {
  key: LifecycleActionKey;
  label: string;
  /** One-line operator-facing description. */
  description: string;
  /** States this action is valid FROM (matches the contract guards). */
  from: AssetStateType[];
  /** BIDGES capability required, or `null` if owner-gated (resale). */
  capability: CapabilityKey | null;
  /** Visual emphasis. */
  tone: "primary" | "warn" | "danger";
  /** Requires the 2-of-3 resolver quorum before it can execute. */
  quorum?: boolean;
}

const S = AssetState;

/** The complete, authoritative action table — order = display priority. */
export const LIFECYCLE_TRANSITIONS: readonly LifecycleTransition[] = [
  {
    key: "bind",
    label: "Bind Tag",
    description: "Cryptographically link an NFC tag to this twin.",
    from: [S.MINTED],
    capability: "BINDER",
    tone: "primary",
  },
  {
    key: "activate",
    label: "Activate",
    description: "QA passed — release the asset to market.",
    from: [S.BOUND],
    capability: "ACTIVATOR",
    tone: "primary",
  },
  {
    key: "claim",
    label: "Claim",
    description: "Transfer ownership to the end consumer.",
    from: [S.ACTIVATED],
    capability: "CLAIMER",
    tone: "primary",
  },
  {
    key: "transfer",
    label: "Resell",
    description: "Secondary-market transfer to a new owner (stays Claimed).",
    from: [S.CLAIMED],
    capability: null, // owner-gated
    tone: "primary",
  },
  {
    key: "flag",
    label: "Flag",
    description: "Recall, or report lost / stolen. Starts AIRP recovery.",
    from: [S.BOUND, S.ACTIVATED, S.CLAIMED],
    capability: "FLAGGER",
    tone: "danger",
  },
  {
    key: "resolve",
    label: "Resolve",
    description: "Recover a flagged asset to its rightful owner (2-of-3 quorum).",
    from: [S.FLAGGED],
    capability: "RESOLVER",
    tone: "warn",
    quorum: true,
  },
  {
    key: "recycle",
    label: "Recycle",
    description: "Retire end-of-life, scrap defective stock, or void a twin.",
    from: [S.MINTED, S.BOUND, S.ACTIVATED, S.CLAIMED, S.FLAGGED],
    capability: "RECYCLER",
    tone: "danger",
  },
] as const;

/** Transitions valid FROM a given state (regardless of capability). */
export function getTransitionsFrom(state: AssetStateType): LifecycleTransition[] {
  return LIFECYCLE_TRANSITIONS.filter((t) => t.from.includes(state));
}

/** Why an action that's structurally valid for the current state is blocked. */
export interface AvailableAction extends LifecycleTransition {
  /** True if the connected wallet may execute it now. */
  enabled: boolean;
  /** Human-readable reason when `enabled` is false (empty otherwise). */
  reason: string;
  /** True if the connected wallet holds the required capability (or none needed). */
  hasCapability: boolean;
}

/**
 * Capability-aware action list for the asset's current state. Calls the
 * capability gate for every BIDGES role (fixed order — hook-safe) so it can
 * annotate each available action with enabled/disabled + a reason.
 *
 * @param state    current on-chain asset state
 * @param assetOwner current owner address (for the owner-gated resale)
 */
export function useLifecycleActions(
  state: AssetStateType | undefined,
  assetOwner?: `0x${string}`,
): AvailableAction[] {
  const { address } = useAccount();

  // Fixed-order capability gates (Rules of Hooks: always called, never conditional).
  const gates: Record<CapabilityKey, boolean> = {
    MINTER: useCapabilityGate(address, CapabilityHashes.MINTER).hasCapability,
    BINDER: useCapabilityGate(address, CapabilityHashes.BINDER).hasCapability,
    ACTIVATOR: useCapabilityGate(address, CapabilityHashes.ACTIVATOR).hasCapability,
    CLAIMER: useCapabilityGate(address, CapabilityHashes.CLAIMER).hasCapability,
    FLAGGER: useCapabilityGate(address, CapabilityHashes.FLAGGER).hasCapability,
    RESOLVER: useCapabilityGate(address, CapabilityHashes.RESOLVER).hasCapability,
    RECYCLER: useCapabilityGate(address, CapabilityHashes.RECYCLER).hasCapability,
  };

  if (state === undefined) return [];

  const isOwner = !!address && !!assetOwner && address.toLowerCase() === assetOwner.toLowerCase();

  return getTransitionsFrom(state).map((t): AvailableAction => {
    // Owner-gated (resale): require the connected wallet to be the asset owner.
    if (t.capability === null) {
      return {
        ...t,
        hasCapability: true,
        enabled: isOwner,
        reason: isOwner ? "" : "Only the current owner can resell this asset.",
      };
    }
    const has = gates[t.capability];
    return {
      ...t,
      hasCapability: has,
      enabled: has,
      reason: has ? "" : `Requires the ${t.capability} capability badge.`,
    };
  });
}
