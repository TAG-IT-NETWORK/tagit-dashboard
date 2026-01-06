/**
 * TAGIT Contract Error Handling
 * Parses contract revert reasons and provides user-friendly messages
 */

// Known TAGIT contract revert reasons
export const TAGIT_ERRORS: Record<string, string> = {
  // TAGITCore errors
  "AssetDoesNotExist": "This asset does not exist.",
  "AssetAlreadyExists": "An asset with this ID already exists.",
  "InvalidState": "The asset is not in the correct state for this operation.",
  "InvalidStateTransition": "This state transition is not allowed.",
  "NotAssetOwner": "You must be the asset owner to perform this action.",
  "TagAlreadyBound": "This NFC tag is already bound to an asset.",
  "TagNotBound": "This NFC tag is not bound to any asset.",
  "InvalidTagId": "The provided tag ID is invalid.",
  "InvalidMetadata": "The metadata URI is invalid or empty.",
  "AssetNotFlagged": "This asset is not flagged and cannot be resolved.",
  "AssetNotMinted": "The asset must be minted before this operation.",
  "AssetNotBound": "The asset must be bound to a tag before this operation.",
  "AssetNotActivated": "The asset must be activated before this operation.",
  "CannotRecycle": "This asset cannot be recycled in its current state.",

  // TAGITAccess errors
  "Unauthorized": "You don't have permission to perform this action.",
  "MissingCapability": "You lack the required capability for this operation.",
  "CapabilityAlreadyGranted": "This capability has already been granted.",
  "CapabilityNotGranted": "This capability was not previously granted.",
  "CannotRevokeOwnCapability": "You cannot revoke your own capability.",
  "InvalidCapability": "The specified capability is invalid.",

  // IdentityBadge errors
  "BadgeAlreadyExists": "This user already has this badge.",
  "BadgeDoesNotExist": "This badge does not exist for the user.",
  "InvalidBadgeId": "The specified badge ID is invalid.",
  "CannotTransferSoulbound": "Identity badges are soulbound and cannot be transferred.",

  // CapabilityBadge errors
  "CapabilityBadgeAlreadyExists": "This capability badge already exists.",
  "CapabilityBadgeDoesNotExist": "This capability badge does not exist.",

  // Generic ERC721/1155 errors
  "ERC721InvalidOwner": "Invalid owner address.",
  "ERC721NonexistentToken": "This token does not exist.",
  "ERC721InvalidReceiver": "Invalid receiver address for token transfer.",
  "OwnableUnauthorizedAccount": "Only the contract owner can perform this action.",
  "EnforcedPause": "The contract is currently paused.",
};

// Error codes from viem/wagmi
export const TRANSACTION_ERRORS: Record<string, string> = {
  "UserRejectedRequestError": "Transaction was cancelled in your wallet.",
  "TransactionExecutionError": "Transaction failed to execute.",
  "InsufficientFundsError": "Insufficient funds in your wallet.",
  "NonceError": "Transaction nonce error. Please refresh and try again.",
  "GasEstimationError": "Gas estimation failed. The transaction may revert.",
  "ChainMismatchError": "Please switch to OP Sepolia network.",
  "ConnectorNotConnectedError": "Wallet not connected.",
};

/**
 * Parse a contract error and return a user-friendly message
 */
export function parseContractError(error: unknown): {
  message: string;
  code?: string;
  isUserRejection: boolean;
  isCapabilityError: boolean;
  isNetworkError: boolean;
} {
  const errorString = error instanceof Error ? error.message : String(error);
  const lowerError = errorString.toLowerCase();

  // Check for user rejection first
  if (lowerError.includes("user rejected") || lowerError.includes("user denied") || lowerError.includes("cancelled")) {
    return {
      message: "Transaction was cancelled.",
      code: "USER_REJECTED",
      isUserRejection: true,
      isCapabilityError: false,
      isNetworkError: false,
    };
  }

  // Check for network errors
  if (lowerError.includes("network") || lowerError.includes("chain") || lowerError.includes("wrong network")) {
    return {
      message: "Network error. Please switch to OP Sepolia and try again.",
      code: "NETWORK_ERROR",
      isUserRejection: false,
      isCapabilityError: false,
      isNetworkError: true,
    };
  }

  // Try to extract revert reason
  let revertReason: string | null = null;

  // Match patterns like: reverted with reason "ErrorName"
  const reasonMatch = errorString.match(/reverted with (?:reason|custom error|the following reason):\s*["']?([^"'\n]+)["']?/i);
  if (reasonMatch) {
    revertReason = reasonMatch[1].trim();
  }

  // Match pattern: Error: ErrorName(...)
  if (!revertReason) {
    const errorNameMatch = errorString.match(/Error:\s*(\w+)\(/i);
    if (errorNameMatch) {
      revertReason = errorNameMatch[1];
    }
  }

  // Match pattern: execution reverted: "reason"
  if (!revertReason) {
    const execMatch = errorString.match(/execution reverted[:\s]+["']?([^"'\n]+)["']?/i);
    if (execMatch) {
      revertReason = execMatch[1].trim();
    }
  }

  // Look up known error
  if (revertReason) {
    // Check if it's a known TAGIT error
    const knownError = TAGIT_ERRORS[revertReason];
    const isCapabilityError = revertReason.includes("Capability") ||
                              revertReason === "Unauthorized" ||
                              revertReason === "MissingCapability";

    if (knownError) {
      return {
        message: knownError,
        code: revertReason,
        isUserRejection: false,
        isCapabilityError,
        isNetworkError: false,
      };
    }

    // Return the raw reason if not in our list
    return {
      message: `Transaction failed: ${revertReason}`,
      code: revertReason,
      isUserRejection: false,
      isCapabilityError,
      isNetworkError: false,
    };
  }

  // Check for common transaction errors
  if (lowerError.includes("insufficient funds")) {
    return {
      message: "Insufficient ETH to pay for gas. Please add funds to your wallet.",
      code: "INSUFFICIENT_FUNDS",
      isUserRejection: false,
      isCapabilityError: false,
      isNetworkError: false,
    };
  }

  if (lowerError.includes("gas")) {
    return {
      message: "Transaction failed. You may lack permission or the operation is invalid.",
      code: "GAS_ERROR",
      isUserRejection: false,
      isCapabilityError: true, // Often gas errors are permission related
      isNetworkError: false,
    };
  }

  if (lowerError.includes("capability") || lowerError.includes("unauthorized") || lowerError.includes("permission")) {
    return {
      message: "You don't have permission to perform this action.",
      code: "UNAUTHORIZED",
      isUserRejection: false,
      isCapabilityError: true,
      isNetworkError: false,
    };
  }

  // Default error
  return {
    message: "Transaction failed. Please try again.",
    code: "UNKNOWN",
    isUserRejection: false,
    isCapabilityError: false,
    isNetworkError: false,
  };
}

/**
 * Get the action description for an error message
 */
export function getActionDescription(action: string): string {
  const actions: Record<string, string> = {
    mint: "minting the asset",
    bind: "binding the NFC tag",
    activate: "activating the asset",
    claim: "claiming ownership",
    flag: "flagging the asset",
    resolve: "resolving the flag",
    recycle: "recycling the asset",
    grantBadge: "granting the badge",
    revokeBadge: "revoking the badge",
    grantCapability: "granting the capability",
    revokeCapability: "revoking the capability",
  };

  return actions[action] || action;
}

/**
 * Format a transaction error for display
 */
export function formatTransactionError(
  error: unknown,
  action?: string
): string {
  const parsed = parseContractError(error);

  if (action) {
    const actionDesc = getActionDescription(action);
    return `Error ${actionDesc}: ${parsed.message}`;
  }

  return parsed.message;
}
