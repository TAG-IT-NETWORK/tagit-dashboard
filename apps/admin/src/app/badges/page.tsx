"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import {
  BadgeIds,
  BadgeIdNames,
  useGrantBadge,
  useRevokeBadge,
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
  Award,
  Users,
  Plus,
  Minus,
  X,
  Search,
  Check,
  AlertCircle,
} from "lucide-react";

// Badge info with mock holder counts
interface BadgeInfo {
  id: number;
  name: string;
  category: "kyc" | "role" | "authority";
  description: string;
  holders: number;
}

const badgeInfoList: BadgeInfo[] = [
  {
    id: BadgeIds.KYC_L1,
    name: BadgeIdNames[BadgeIds.KYC_L1],
    category: "kyc",
    description: "Basic identity verification",
    holders: 342,
  },
  {
    id: BadgeIds.KYC_L2,
    name: BadgeIdNames[BadgeIds.KYC_L2],
    category: "kyc",
    description: "Enhanced identity verification with document check",
    holders: 189,
  },
  {
    id: BadgeIds.KYC_L3,
    name: BadgeIdNames[BadgeIds.KYC_L3],
    category: "kyc",
    description: "Full identity verification with in-person validation",
    holders: 45,
  },
  {
    id: BadgeIds.MANUFACTURER,
    name: BadgeIdNames[BadgeIds.MANUFACTURER],
    category: "role",
    description: "Authorized product manufacturer",
    holders: 23,
  },
  {
    id: BadgeIds.RETAILER,
    name: BadgeIdNames[BadgeIds.RETAILER],
    category: "role",
    description: "Authorized retail distributor",
    holders: 67,
  },
  {
    id: BadgeIds.GOV_MIL,
    name: BadgeIdNames[BadgeIds.GOV_MIL],
    category: "authority",
    description: "Government or military authority",
    holders: 5,
  },
  {
    id: BadgeIds.LAW_ENFORCEMENT,
    name: BadgeIdNames[BadgeIds.LAW_ENFORCEMENT],
    category: "authority",
    description: "Law enforcement authority",
    holders: 8,
  },
];

function getCategoryIcon(category: string) {
  switch (category) {
    case "kyc":
      return Shield;
    case "role":
      return Award;
    case "authority":
      return Shield;
    default:
      return Shield;
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "kyc":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "role":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "authority":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    default:
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
}

interface GrantRevokeModalProps {
  badge: BadgeInfo;
  mode: "grant" | "revoke";
  onClose: () => void;
}

function GrantRevokeModal({ badge, mode, onClose }: GrantRevokeModalProps) {
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { grantBadge } = useGrantBadge();
  const { revokeBadge } = useRevokeBadge();

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
        grantBadge(normalizedAddress, badge.id);
      } else {
        revokeBadge(normalizedAddress, badge.id);
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
              {mode === "grant" ? "Grant" : "Revoke"} Badge
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            {mode === "grant"
              ? `Grant the ${badge.name} badge to a user`
              : `Revoke the ${badge.name} badge from a user`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2">
              <Badge variant={badge.category === "authority" ? "destructive" : "default"}>
                {badge.name}
              </Badge>
              <span className="text-sm text-muted-foreground">{badge.description}</span>
            </div>
          </div>

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
                Badge {mode === "grant" ? "granted" : "revoked"} successfully!
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
                  Grant Badge
                </>
              ) : (
                <>
                  <Minus className="h-4 w-4 mr-1" />
                  Revoke Badge
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BadgesPage() {
  return (
    <WagmiGuard>
      <BadgesContent />
    </WagmiGuard>
  );
}

function BadgesContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{
    badge: BadgeInfo;
    mode: "grant" | "revoke";
  } | null>(null);

  const filteredBadges = badgeInfoList.filter((badge) => {
    const matchesSearch =
      badge.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      badge.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || badge.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { value: "kyc", label: "KYC", count: badgeInfoList.filter((b) => b.category === "kyc").length },
    { value: "role", label: "Role", count: badgeInfoList.filter((b) => b.category === "role").length },
    { value: "authority", label: "Authority", count: badgeInfoList.filter((b) => b.category === "authority").length },
  ];

  const totalHolders = badgeInfoList.reduce((sum, b) => sum + b.holders, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Badge Management</h1>
          <p className="text-muted-foreground">
            Manage identity and role badges across the network
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Badges</p>
                <p className="text-2xl font-bold">{badgeInfoList.length}</p>
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
                <p className="text-sm text-muted-foreground">Total Badge Holders</p>
                <p className="text-2xl font-bold">{totalHolders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Award className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role Badges</p>
                <p className="text-2xl font-bold">
                  {badgeInfoList.filter((b) => b.category === "role").length}
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
                <p className="text-sm text-muted-foreground">Authority Badges</p>
                <p className="text-2xl font-bold">
                  {badgeInfoList.filter((b) => b.category === "authority").length}
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
                placeholder="Search badges..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filters */}
            <div className="flex items-center gap-2">
              <Badge
                variant={categoryFilter === null ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setCategoryFilter(null)}
              >
                All ({badgeInfoList.length})
              </Badge>
              {categories.map((cat) => (
                <Badge
                  key={cat.value}
                  variant={categoryFilter === cat.value ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setCategoryFilter(cat.value)}
                >
                  {cat.label} ({cat.count})
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badge Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredBadges.map((badge) => {
          const CategoryIcon = getCategoryIcon(badge.category);
          return (
            <Card key={badge.id} className="relative overflow-hidden">
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  badge.category === "kyc"
                    ? "bg-blue-500"
                    : badge.category === "role"
                    ? "bg-green-500"
                    : "bg-red-500"
                }`}
              />
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-2 rounded-lg border ${getCategoryColor(badge.category)}`}
                    >
                      <CategoryIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{badge.name}</CardTitle>
                      <Badge variant="outline" className="text-xs mt-1">
                        ID: {badge.id}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{badge.description}</p>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Holders</span>
                  </div>
                  <span className="font-bold">{badge.holders}</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setModalState({ badge, mode: "grant" })}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Grant
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setModalState({ badge, mode: "revoke" })}
                  >
                    <Minus className="h-4 w-4 mr-1" />
                    Revoke
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredBadges.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No badges found matching your criteria.</p>
          </CardContent>
        </Card>
      )}

      {/* Grant/Revoke Modal */}
      {modalState && (
        <GrantRevokeModal
          badge={modalState.badge}
          mode={modalState.mode}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}
