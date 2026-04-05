import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { useMemo } from "react";
import { keccak256, toBytes } from "viem";
import { getAgentContractsForChain } from "./agent-addresses";
import { TAGITAgentIdentityABI } from "./abis/TAGITAgentIdentity";
import { TAGITAgentReputationABI } from "./abis/TAGITAgentReputation";
import { TAGITAgentValidationABI } from "./abis/TAGITAgentValidation";

/**
 * Gas fee overrides for Arbitrum Sepolia.
 */
const ARB_GAS = {
  maxFeePerGas: 500_000_000n,
  maxPriorityFeePerGas: 10_000_000n,
} as const;

function gasFor(chainId: number) {
  return chainId === 421614 ? ARB_GAS : {};
}

// ============================================================================
// TAGITAgentIdentity Write Hooks
// ============================================================================

/** Register a new AI agent. Requires KYC_L1 badge. */
export function useRegisterAgent() {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash,
    chainId,
    confirmations: 1,
    pollingInterval: 4_000,
  });

  const agentId = useMemo(() => {
    if (!receipt?.logs) return null;
    const topic = keccak256(toBytes("AgentRegistered(uint256,address,address,string)"));
    for (const log of receipt.logs) {
      if (log.topics[0] === topic && log.topics[1]) {
        return BigInt(log.topics[1]);
      }
    }
    return null;
  }, [receipt]);

  const register = (wallet: `0x${string}`, uri: string, fee?: bigint) => {
    writeContract({
      address: contracts.TAGITAgentIdentity,
      abi: TAGITAgentIdentityABI,
      functionName: "register",
      args: [wallet, uri],
      value: fee ?? 0n,
      chainId,
      ...gasFor(chainId),
    });
  };

  return { register, hash, isPending, isConfirming, isSuccess, error, agentId };
}

/** Suspend an agent. Owner only. */
export function useSuspendAgent() {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId,
    confirmations: 1,
    pollingInterval: 4_000,
  });

  const suspend = (agentId: bigint) => {
    writeContract({
      address: contracts.TAGITAgentIdentity,
      abi: TAGITAgentIdentityABI,
      functionName: "suspendAgent",
      args: [agentId],
      chainId,
      ...gasFor(chainId),
    });
  };

  return { suspend, hash, isPending, isConfirming, isSuccess, error };
}

/** Reactivate a suspended agent. Owner only. */
export function useReactivateAgent() {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId,
    confirmations: 1,
    pollingInterval: 4_000,
  });

  const reactivate = (agentId: bigint) => {
    writeContract({
      address: contracts.TAGITAgentIdentity,
      abi: TAGITAgentIdentityABI,
      functionName: "reactivateAgent",
      args: [agentId],
      chainId,
      ...gasFor(chainId),
    });
  };

  return { reactivate, hash, isPending, isConfirming, isSuccess, error };
}

/** Decommission an agent permanently. Registrant only. */
export function useDecommissionAgent() {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId,
    confirmations: 1,
    pollingInterval: 4_000,
  });

  const decommission = (agentId: bigint) => {
    writeContract({
      address: contracts.TAGITAgentIdentity,
      abi: TAGITAgentIdentityABI,
      functionName: "decommissionAgent",
      args: [agentId],
      chainId,
      ...gasFor(chainId),
    });
  };

  return { decommission, hash, isPending, isConfirming, isSuccess, error };
}

/** Set agent metadata key-value pair. Registrant only. */
export function useSetAgentMetadata() {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId,
    confirmations: 1,
    pollingInterval: 4_000,
  });

  const setMetadata = (agentId: bigint, key: string, value: string) => {
    writeContract({
      address: contracts.TAGITAgentIdentity,
      abi: TAGITAgentIdentityABI,
      functionName: "setMetadata",
      args: [agentId, key, value],
      chainId,
      ...gasFor(chainId),
    });
  };

  return { setMetadata, hash, isPending, isConfirming, isSuccess, error };
}

// ============================================================================
// TAGITAgentReputation Write Hooks
// ============================================================================

/** Give feedback on an agent. Requires KYC_L1 badge. */
export function useGiveFeedback() {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId,
    confirmations: 1,
    pollingInterval: 4_000,
  });

  const giveFeedback = (agentId: bigint, rating: number, comment: string) => {
    writeContract({
      address: contracts.TAGITAgentReputation,
      abi: TAGITAgentReputationABI,
      functionName: "giveFeedback",
      args: [agentId, rating, comment],
      chainId,
      ...gasFor(chainId),
    });
  };

  return { giveFeedback, hash, isPending, isConfirming, isSuccess, error };
}

/** Revoke previously given feedback. Reviewer only. */
export function useRevokeFeedback() {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId,
    confirmations: 1,
    pollingInterval: 4_000,
  });

  const revoke = (feedbackId: bigint) => {
    writeContract({
      address: contracts.TAGITAgentReputation,
      abi: TAGITAgentReputationABI,
      functionName: "revokeFeedback",
      args: [feedbackId],
      chainId,
      ...gasFor(chainId),
    });
  };

  return { revoke, hash, isPending, isConfirming, isSuccess, error };
}

/** Append response to feedback. Agent registrant only. */
export function useAppendResponse() {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId,
    confirmations: 1,
    pollingInterval: 4_000,
  });

  const appendResponse = (feedbackId: bigint, responseText: string) => {
    writeContract({
      address: contracts.TAGITAgentReputation,
      abi: TAGITAgentReputationABI,
      functionName: "appendResponse",
      args: [feedbackId, responseText],
      chainId,
      ...gasFor(chainId),
    });
  };

  return { appendResponse, hash, isPending, isConfirming, isSuccess, error };
}

// ============================================================================
// TAGITAgentValidation Write Hooks
// ============================================================================

/** Create a validation request for an agent. */
export function useValidationRequest() {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId,
    confirmations: 1,
    pollingInterval: 4_000,
  });

  const requestValidation = (agentId: bigint, isDefense: boolean) => {
    writeContract({
      address: contracts.TAGITAgentValidation,
      abi: TAGITAgentValidationABI,
      functionName: "validationRequest",
      args: [agentId, isDefense],
      chainId,
      ...gasFor(chainId),
    });
  };

  return { requestValidation, hash, isPending, isConfirming, isSuccess, error };
}

/** Submit a validator response. Requires VALIDATOR_CAPABILITY. */
export function useValidationResponse() {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId,
    confirmations: 1,
    pollingInterval: 4_000,
  });

  const submitResponse = (requestId: bigint, score: number, justification: string) => {
    writeContract({
      address: contracts.TAGITAgentValidation,
      abi: TAGITAgentValidationABI,
      functionName: "validationResponse",
      args: [requestId, score, justification],
      chainId,
      ...gasFor(chainId),
    });
  };

  return { submitResponse, hash, isPending, isConfirming, isSuccess, error };
}
