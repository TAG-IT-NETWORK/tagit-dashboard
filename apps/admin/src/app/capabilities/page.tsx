"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import {
  Capabilities,
  CapabilityNames,
  CapabilityList,
  useGrantCapability,
  useRevokeCapability,
  type CapabilityKey,
  type CapabilityHash,
} from "@tagit/contracts";
import { WagmiGuard } from "@/components/wagmi-guard";
import { getAddress } from "viem";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Input,
} from "@tagit/ui";
import {
  Shield,
  Key,
  Users,
  Plus,
  Minus,
  X,
  Search,
  Check,
  AlertCircle,
  Copy,
} from "lucide-react";

// Capability info with mock holder counts
interface CapabilityInfo {
  key: CapabilityKey;
  name: string;
  hash: CapabilityHash;
  description: string;
  holders: number;
  riskLevel: "low" | "medium" | "high";
}

const capabilityInfoList: CapabilityInfo[] = [
  {
    key: "MINTER",
    name: CapabilityNames[Capabilities.MINTER],
    hash: Capabilities.MINTER,
    description: "Can mint new asset tokens",
    holders: 12,
    riskLevel: "medium",
  },
  {
    key: "BINDER",
    name: CapabilityNames[Capabilities.BINDER],
    hash: Capabilities.BINDER,
    description: "Can bind assets to physical tags",
    holders: 18,
    riskLevel: "medium",
  },
  {
    key: "ACTIVATOR",
    name: CapabilityNames[Capabilities.ACTIVATOR],
    hash: Capabilities.ACTIVATOR,
    description: "Can activate bound assets",
    holders: 25,
    riskLevel: "low",
  },
  {
    key: "CLAIMER",
    name: CapabilityNames[Capabilities.CLAIMER],
    hash: Capabilities.CLAIMER,
    description: "Can claim assets on behalf of users",
    holders: 15,
    riskLevel: "low",
  },
  {
    key: "FLAGGER",
    name: CapabilityNames[Capabilities.FLAGGER],
    hash: Capabilities.FLAGGER,
    description: "Can flag assets for review",
    holders: 8,
    riskLevel: "medium",
  },
  {
    key: "RESOLVER",
    name: CapabilityNames[Capabilities.RESOLVER],
    hash: Capabilities.RESOLVER,
    description: "Can resolve flagged assets",
    holders: 3,
    riskLevel: "high",
  },
  {
    key: "RECYCLER",
    name: CapabilityNames[Capabilities.RECYCLER],
    hash: Capabilities.RECYCLER,
    description: "Can recycle decommissioned assets",
    holders: 5,
    riskLevel: "medium",
  },
];

function getRiskColor(level: string): string {
  switch (level) {
    case "low":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "medium":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    case "high":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    default:
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
}

function getRiskBadgeVariant(level: string): "default" | "secondary" | "outline" | "destructive" {
  switch (level) {
    case "high":
      return "destructive";
    case "medium":
      return "default";
    default:
      return "secondary";
  }
}

function truncateHash(hash: string, chars = 8): string {
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

interface GrantRevokeModalProps {
  capability: CapabilityInfo;
  mode: "grant" | "revoke";
  onClose: () => void;
}

function GrantRevokeModal({ capability, mode, onClose }: GrantRevokeModalProps) {
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { grantCapability } = useGrantCapability();
  const { revokeCapability } = useRevokeCapability();

  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(address);

  const handleSubmit = async () => {
    if (!isValidAddress) {
      setError("Please enter a valid Ethereum address");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const normalizedAddress = getAddress(address);
      if (mode === "grant") {
        grantCapability(normalizedAddress, capability.hash);
      } else {
        revokeCapability(normalizedAddress, capability.hash);
      }
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {mode === "grant" ? (
                <Plus className="h-5 w-5 text-green-500" />
              ) : (
                <Minus className="h-5 w-5 text-red-500" />
              )}
              {mode === "grant" ? "Grant" : "Revoke"} Capability
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            {mode === "grant"
              ? `Grant the ${capability.name} capability to a user`
              : `Revoke the ${capability.name} capability from a user`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <Badge variant={getRiskBadgeVariant(capability.riskLevel)}>
                {capability.name}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {capability.riskLevel.toUpperCase()} RISK
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{capability.description}</p>
          </div>

          {capability.riskLevel === "high" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-500">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">
                This is a high-risk capability. Ensure the recipient is authorized.
              </span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">User Address</label>
            <Input
              placeholder="0x..."
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setError(null);
              }}
              className={error ? "border-red-500" : ""}
            />
            {address && !isValidAddress && (
              <p className="text-sm text-red-500">Invalid address format</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-500">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-500">
              <Check className="h-4 w-4" />
              <span className="text-sm">
                Capability {mode === "grant" ? "granted" : "revoked"} successfully!
              </span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValidAddress || isSubmitting || success}
              className="flex-1"
              variant={mode === "grant" ? "default" : "destructive"}
            >
              {isSubmitting ? (
                "Processing..."
              ) : success ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Done
                </>
              ) : mode === "grant" ? (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Grant Capability
                </>
              ) : (
                <>
                  <Minus className="h-4 w-4 mr-1" />
                  Revoke Capability
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CapabilitiesPage() {
  return (
    <WagmiGuard>
      <CapabilitiesContent />
    </WagmiGuard>
  );
}

function CapabilitiesContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{
    capability: CapabilityInfo;
    mode: "grant" | "revoke";
  } | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleCopyHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredCapabilities = capabilityInfoList.filter((cap) => {
    const matchesSearch =
      cap.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cap.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = !riskFilter || cap.riskLevel === riskFilter;
    return matchesSearch && matchesRisk;
  });

  const riskLevels = [
    { value: "low", label: "Low", count: capabilityInfoList.filter((c) => c.riskLevel === "low").length },
    { value: "medium", label: "Medium", count: capabilityInfoList.filter((c) => c.riskLevel === "medium").length },
    { value: "high", label: "High", count: capabilityInfoList.filter((c) => c.riskLevel === "high").length },
  ];

  const totalHolders = capabilityInfoList.reduce((sum, c) => sum + c.holders, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Capability Management</h1>
          <p className="text-muted-foreground">
            Manage operational capabilities and permissions
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Capabilities</p>
                <p className="text-2xl font-bold">{capabilityInfoList.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Grants</p>
                <p className="text-2xl font-bold">{totalHolders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Shield className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Medium Risk</p>
                <p className="text-2xl font-bold">
                  {capabilityInfoList.filter((c) => c.riskLevel === "medium").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Shield className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High Risk</p>
                <p className="text-2xl font-bold">
                  {capabilityInfoList.filter((c) => c.riskLevel === "high").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search capabilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Risk Level Filters */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Risk:</span>
              <Badge
                variant={riskFilter === null ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setRiskFilter(null)}
              >
                All
              </Badge>
              {riskLevels.map((level) => (
                <Badge
                  key={level.value}
                  variant={riskFilter === level.value ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setRiskFilter(level.value)}
                >
                  {level.label} ({level.count})
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capabilities Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Capability
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Hash
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Risk Level
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Holders
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCapabilities.map((cap) => (
                  <tr key={cap.key} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-medium">{cap.name}</div>
                        <div className="text-sm text-muted-foreground">{cap.description}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-muted-foreground">
                          {truncateHash(cap.hash)}
                        </code>
                        <button
                          onClick={() => handleCopyHash(cap.hash)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy full hash"
                        >
                          {copiedHash === cap.hash ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={getRiskBadgeVariant(cap.riskLevel)}>
                        {cap.riskLevel.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{cap.holders}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setModalState({ capability: cap, mode: "grant" })}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Grant
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setModalState({ capability: cap, mode: "revoke" })}
                        >
                          <Minus className="h-4 w-4 mr-1" />
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredCapabilities.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No capabilities found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grant/Revoke Modal */}
      {modalState && (
        <GrantRevokeModal
          capability={modalState.capability}
          mode={modalState.mode}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}
