import { AssetState, type AssetStateType } from "@tagit/contracts";

/**
 * State names for display
 */
export const STATE_NAMES: Record<AssetStateType, string> = {
  [AssetState.NONE]: "None",
  [AssetState.MINTED]: "Minted",
  [AssetState.BOUND]: "Bound",
  [AssetState.ACTIVATED]: "Activated",
  [AssetState.CLAIMED]: "Claimed",
  [AssetState.FLAGGED]: "Flagged",
  [AssetState.RECYCLED]: "Recycled",
};

/**
 * State colors for UI
 */
export const STATE_COLORS: Record<AssetStateType, string> = {
  [AssetState.NONE]: "gray",
  [AssetState.MINTED]: "gray",
  [AssetState.BOUND]: "blue",
  [AssetState.ACTIVATED]: "green",
  [AssetState.CLAIMED]: "purple",
  [AssetState.FLAGGED]: "red",
  [AssetState.RECYCLED]: "orange",
};

/**
 * Lifecycle step definitions
 */
export interface LifecycleStep {
  id: string;
  name: string;
  description: string;
  targetState?: AssetStateType;
  action: string;
  optional?: boolean;
}

export const LIFECYCLE_STEPS: LifecycleStep[] = [
  {
    id: "mint",
    name: "Mint",
    description: "Create a new asset token",
    targetState: AssetState.MINTED,
    action: "mint",
  },
  {
    id: "bind",
    name: "Bind Tag",
    description: "Associate NFC tag with asset",
    targetState: AssetState.BOUND,
    action: "bindTag",
  },
  {
    id: "activate",
    name: "Activate",
    description: "Simulate first NFC scan",
    targetState: AssetState.ACTIVATED,
    action: "activate",
  },
  {
    id: "claim",
    name: "Claim",
    description: "Transfer ownership to new owner",
    targetState: AssetState.CLAIMED,
    action: "claim",
  },
  {
    id: "flag",
    name: "Flag",
    description: "Report asset issue",
    targetState: AssetState.FLAGGED,
    action: "flag",
  },
  {
    id: "resolve",
    name: "Resolve",
    description: "Resolve flagged asset",
    action: "resolve",
  },
  {
    id: "recycle",
    name: "Recycle",
    description: "Recycle asset for reuse",
    targetState: AssetState.RECYCLED,
    action: "recycle",
    optional: true,
  },
];

/**
 * Generate random test metadata
 */
export function generateTestMetadata() {
  const timestamp = Date.now();
  return {
    name: `Test Asset ${timestamp}`,
    description: "Lifecycle test asset created for NFC binding verification",
    image: "ipfs://QmTestImage",
    attributes: [
      { trait_type: "Test", value: "true" },
      { trait_type: "Created", value: new Date().toISOString() },
      { trait_type: "Purpose", value: "Lifecycle Test" },
    ],
  };
}

/**
 * Generate metadata URI for testing
 * In production this would upload to IPFS
 */
export function generateTestMetadataURI(): string {
  const metadata = generateTestMetadata();
  // For testing, use a data URI or placeholder
  // In production, upload to IPFS and return ipfs:// URI
  return `data:application/json;base64,${btoa(JSON.stringify(metadata))}`;
}

/**
 * Format block explorer URL for transaction
 */
export function getBlockscoutTxUrl(txHash: string): string {
  return `https://optimism-sepolia.blockscout.com/tx/${txHash}`;
}

/**
 * Format block explorer URL for address
 */
export function getBlockscoutAddressUrl(address: string): string {
  return `https://optimism-sepolia.blockscout.com/address/${address}`;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

/**
 * Get step status based on current asset state
 */
export function getStepStatus(
  step: LifecycleStep,
  currentState: AssetStateType | undefined,
  completedSteps: string[]
): "pending" | "current" | "completed" | "skipped" {
  if (completedSteps.includes(step.id)) {
    return "completed";
  }

  if (step.targetState !== undefined && currentState !== undefined) {
    if (currentState >= step.targetState) {
      return "completed";
    }
  }

  // Check if this is the next logical step
  const stepIndex = LIFECYCLE_STEPS.findIndex((s) => s.id === step.id);
  const prevStep = LIFECYCLE_STEPS[stepIndex - 1];

  if (!prevStep || completedSteps.includes(prevStep.id)) {
    return "current";
  }

  return "pending";
}
