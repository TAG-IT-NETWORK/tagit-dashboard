"use client";

import { useState, useEffect, useCallback } from "react";
import { usePublicClient, useChainId, useAccount } from "wagmi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@tagit/ui";
import { useToast } from "@tagit/ui";
import {
  useSuspendAgent,
  useReactivateAgent,
  useDecommissionAgent,
  useSetAgentMetadata,
  getAgentContractsForChain,
  TAGITAgentIdentityABI,
  AgentStatus,
} from "@tagit/contracts";
import { TransactionStatus } from "@/components/transaction-status";
import {
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Tag,
  Loader2,
  AlertCircle,
  ShieldOff,
  Lock,
} from "lucide-react";

// ── Props ─────────────────────────────────────────────────────────────────────

interface AgentAdminTabProps {
  agentId: number;
  registrant: string;
  currentStatus: number;
}

// ── Owner Actions (suspend / reactivate) ─────────────────────────────────────

interface OwnerActionsProps {
  agentId: number;
  currentStatus: number;
  chainId: number;
  onSuccess: () => void;
}

function OwnerActions({ agentId, currentStatus, chainId, onSuccess }: OwnerActionsProps) {
  const { toast } = useToast();

  const {
    suspend,
    hash: suspendHash,
    isPending: suspendPending,
    isConfirming: suspendConfirming,
    isSuccess: suspendSuccess,
    error: suspendError,
  } = useSuspendAgent();

  const {
    reactivate,
    hash: reactivateHash,
    isPending: reactivatePending,
    isConfirming: reactivateConfirming,
    isSuccess: reactivateSuccess,
    error: reactivateError,
  } = useReactivateAgent();

  useEffect(() => {
    if (suspendSuccess) {
      toast({ title: "Agent suspended", variant: "success" });
      onSuccess();
    }
  }, [suspendSuccess, toast, onSuccess]);

  useEffect(() => {
    if (reactivateSuccess) {
      toast({ title: "Agent reactivated", variant: "success" });
      onSuccess();
    }
  }, [reactivateSuccess, toast, onSuccess]);

  const isSuspended = currentStatus === AgentStatus.SUSPENDED;
  const isDecommissioned = currentStatus === AgentStatus.DECOMMISSIONED;
  const canSuspend = !isSuspended && !isDecommissioned;
  const canReactivate = isSuspended;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          Owner Controls
        </CardTitle>
        <CardDescription>
          Suspend or reactivate this agent. These actions require contract ownership.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="destructive"
            onClick={() => suspend(BigInt(agentId))}
            disabled={!canSuspend || suspendPending || suspendConfirming}
          >
            {(suspendPending || suspendConfirming) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            <ShieldOff className="h-4 w-4 mr-2" />
            Suspend Agent
          </Button>

          <Button
            variant="outline"
            onClick={() => reactivate(BigInt(agentId))}
            disabled={!canReactivate || reactivatePending || reactivateConfirming}
          >
            {(reactivatePending || reactivateConfirming) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            <ShieldCheck className="h-4 w-4 mr-2" />
            Reactivate Agent
          </Button>
        </div>

        {!canSuspend && !isSuspended && (
          <p className="text-xs text-muted-foreground">
            This agent is decommissioned and cannot be modified.
          </p>
        )}

        <TransactionStatus
          isPending={suspendPending}
          isConfirming={suspendConfirming}
          isSuccess={suspendSuccess}
          error={suspendError}
          hash={suspendHash}
          chainId={chainId}
          action="suspend agent"
          successMessage="Agent has been suspended."
        />
        <TransactionStatus
          isPending={reactivatePending}
          isConfirming={reactivateConfirming}
          isSuccess={reactivateSuccess}
          error={reactivateError}
          hash={reactivateHash}
          chainId={chainId}
          action="reactivate agent"
          successMessage="Agent has been reactivated."
        />
      </CardContent>
    </Card>
  );
}

// ── Decommission Dialog ───────────────────────────────────────────────────────

interface DecommissionDialogProps {
  agentId: number;
  chainId: number;
  onSuccess: () => void;
}

function DecommissionDialog({ agentId, chainId, onSuccess }: DecommissionDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { decommission, hash, isPending, isConfirming, isSuccess, error } = useDecommissionAgent();

  useEffect(() => {
    if (isSuccess) {
      toast({ title: "Agent decommissioned", variant: "success" });
      setOpen(false);
      onSuccess();
    }
  }, [isSuccess, toast, onSuccess]);

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
        className="bg-red-600 hover:bg-red-700"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Decommission Agent
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Decommission Agent #{agentId}
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. The agent will be permanently
              decommissioned and no further actions will be possible.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <strong>Warning:</strong> Decommissioning is irreversible. The agent record will be
            locked on-chain and cannot be restored.
          </div>

          <TransactionStatus
            isPending={isPending}
            isConfirming={isConfirming}
            isSuccess={isSuccess}
            error={error}
            hash={hash}
            chainId={chainId}
            action="decommission agent"
            successMessage="Agent decommissioned."
          />

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={isPending || isConfirming}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => decommission(BigInt(agentId))}
              disabled={isPending || isConfirming}
              className="bg-red-600 hover:bg-red-700"
            >
              {(isPending || isConfirming) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Yes, Decommission Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Set Metadata Form ─────────────────────────────────────────────────────────

interface SetMetadataFormProps {
  agentId: number;
  chainId: number;
}

function SetMetadataForm({ agentId, chainId }: SetMetadataFormProps) {
  const { toast } = useToast();
  const [metaKey, setMetaKey] = useState("");
  const [metaValue, setMetaValue] = useState("");

  const { setMetadata, hash, isPending, isConfirming, isSuccess, error } = useSetAgentMetadata();

  useEffect(() => {
    if (isSuccess) {
      toast({ title: "Metadata updated", variant: "success" });
      setMetaKey("");
      setMetaValue("");
    }
  }, [isSuccess, toast]);

  const canSubmit =
    metaKey.trim().length > 0 && metaValue.trim().length > 0 && !isPending && !isConfirming;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Set Metadata
        </CardTitle>
        <CardDescription>
          Store arbitrary key-value metadata on-chain for this agent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="meta-key">Key</Label>
            <Input
              id="meta-key"
              placeholder="e.g. description"
              value={metaKey}
              onChange={(e) => setMetaKey(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meta-value">Value</Label>
            <Input
              id="meta-value"
              placeholder="e.g. Physical commerce agent"
              value={metaValue}
              onChange={(e) => setMetaValue(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setMetadata(BigInt(agentId), metaKey.trim(), metaValue.trim())}
            disabled={!canSubmit}
          >
            {(isPending || isConfirming) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Set Metadata
          </Button>
          <TransactionStatus
            isPending={isPending}
            isConfirming={isConfirming}
            isSuccess={isSuccess}
            error={error}
            hash={hash}
            chainId={chainId}
            action="set metadata"
            successMessage="Metadata saved."
            inline
          />
        </div>

        {/* Full-card error only */}
        {error && (
          <TransactionStatus
            isPending={false}
            isConfirming={false}
            isSuccess={false}
            error={error}
            hash={hash}
            chainId={chainId}
            action="set metadata"
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── Registrant Actions ────────────────────────────────────────────────────────

interface RegistrantActionsProps {
  agentId: number;
  currentStatus: number;
  chainId: number;
  onSuccess: () => void;
}

function RegistrantActions({ agentId, currentStatus, chainId, onSuccess }: RegistrantActionsProps) {
  const isDecommissioned = currentStatus === AgentStatus.DECOMMISSIONED;

  return (
    <div className="space-y-4">
      {!isDecommissioned && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Permanently decommission this agent. This action cannot be reversed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DecommissionDialog agentId={agentId} chainId={chainId} onSuccess={onSuccess} />
          </CardContent>
        </Card>
      )}

      <SetMetadataForm agentId={agentId} chainId={chainId} />
    </div>
  );
}

// ── Access Denied ─────────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Lock className="h-5 w-5" />
          Access Denied
        </CardTitle>
        <CardDescription>
          You are not authorized to perform admin actions on this agent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Admin actions require either contract ownership (to suspend/reactivate) or being the
          registered registrant of this agent (to decommission or set metadata).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline">Owner: contract-level admin</Badge>
          <Badge variant="outline">Registrant: agent creator</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AgentAdminTab({ agentId, registrant, currentStatus }: AgentAdminTabProps) {
  const chainId = useChainId();
  const client = usePublicClient();
  const { address: connectedAddress } = useAccount();

  const [contractOwner, setContractOwner] = useState<string | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(true);

  let contracts: ReturnType<typeof getAgentContractsForChain> | null = null;
  try {
    contracts = getAgentContractsForChain(chainId);
  } catch {
    // unsupported chain
  }

  const identityAddress = contracts?.TAGITAgentIdentity;

  const fetchOwner = useCallback(async () => {
    if (!client || !identityAddress) return;
    setLoadingOwner(true);
    try {
      const owner = await client.readContract({
        address: identityAddress,
        abi: TAGITAgentIdentityABI,
        functionName: "owner",
      });
      setContractOwner((owner as string).toLowerCase());
    } catch {
      setContractOwner(null);
    } finally {
      setLoadingOwner(false);
    }
  }, [client, identityAddress]);

  useEffect(() => {
    fetchOwner();
  }, [fetchOwner]);

  if (!contracts || !identityAddress) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-6 flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">No identity contract configured for chain {chainId}.</span>
        </CardContent>
      </Card>
    );
  }

  if (!connectedAddress) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Connect your wallet to access admin controls.</span>
        </CardContent>
      </Card>
    );
  }

  if (loadingOwner) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const normalizedConnected = connectedAddress.toLowerCase();
  const normalizedRegistrant = registrant.toLowerCase();

  const isOwner = contractOwner !== null && normalizedConnected === contractOwner;
  const isRegistrant = normalizedConnected === normalizedRegistrant;

  if (!isOwner && !isRegistrant) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      {isOwner && (
        <OwnerActions
          agentId={agentId}
          currentStatus={currentStatus}
          chainId={chainId}
          onSuccess={fetchOwner}
        />
      )}

      {isRegistrant && (
        <RegistrantActions
          agentId={agentId}
          currentStatus={currentStatus}
          chainId={chainId}
          onSuccess={fetchOwner}
        />
      )}
    </div>
  );
}
