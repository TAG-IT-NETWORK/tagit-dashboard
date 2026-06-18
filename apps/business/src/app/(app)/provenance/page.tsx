"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useAllAssets } from "@tagit/contracts";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  MetricCard,
  cn,
} from "@tagit/ui";
import { GitBranch, Layers, Package, Siren, Sparkles } from "lucide-react";
import {
  carbonFootprint,
  countNodes,
  recallAudit,
  treeDepth,
  useProvenanceForest,
  type ChainAsset,
  type ProvNode,
} from "@/lib/provenance";
import { ProvenanceTree } from "@/components/provenance-tree";
import { CompliancePanel } from "@/components/compliance-panel";
import { RecallDialog } from "@/components/recall-dialog";

export default function ProvenancePage() {
  const { address } = useAccount();
  const { assets, isLoading } = useAllAssets({ pageSize: 100 });

  const chainAssets: ChainAsset[] = useMemo(
    () =>
      assets
        .filter((a) => !address || a.owner.toLowerCase() === address.toLowerCase())
        .map((a) => ({ tokenId: a.tokenId, owner: a.owner, state: a.state })),
    [assets, address],
  );

  const { forest, demoForest, chainForest, attach, loaded } = useProvenanceForest(chainAssets);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [recallOpen, setRecallOpen] = useState(false);

  // Default selection: first demo tree (rich data → immediate wow).
  useEffect(() => {
    if (!selectedId && forest.length > 0) setSelectedId(forest[0].id);
  }, [forest, selectedId]);

  const selected: ProvNode | undefined = useMemo(
    () => forest.find((r) => r.id === selectedId),
    [forest, selectedId],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <GitBranch className="h-6 w-6" />
            Provenance Explorer
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every product is a tree of components. The root inherits the full history of every part
            beneath it — query the whole tree in one pass.
          </p>
        </div>
        <Button variant="destructive" onClick={() => setRecallOpen(true)}>
          <Siren className="mr-2 h-4 w-4" />
          Recall command
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* Forest list */}
        <div className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Sample provenance forest
          </div>
          {demoForest.map((root) => (
            <ForestCard
              key={root.id}
              root={root}
              active={selectedId === root.id}
              onSelect={() => setSelectedId(root.id)}
              sample
            />
          ))}

          <div className="pt-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Your products {chainForest.length > 0 && `(${chainForest.length})`}
          </div>
          {isLoading || !loaded ? (
            <div className="h-16 animate-pulse rounded-xl bg-secondary" />
          ) : chainForest.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Mint products to compose them into provenance trees.
            </p>
          ) : (
            chainForest.map((root) => (
              <ForestCard
                key={root.id}
                root={root}
                active={selectedId === root.id}
                onSelect={() => setSelectedId(root.id)}
              />
            ))
          )}
        </div>

        {/* Selected tree + compliance */}
        <div className="space-y-6">
          {selected ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MetricCard
                  title="Components"
                  value={countNodes(selected)}
                  icon={<Package className="h-5 w-5" />}
                />
                <MetricCard
                  title="Tree depth"
                  value={treeDepth(selected)}
                  icon={<Layers className="h-5 w-5" />}
                />
                <MetricCard
                  title="Recalled parts"
                  value={recallAudit(selected).length}
                  icon={<Siren className="h-5 w-5" />}
                />
                <MetricCard
                  title="Carbon (kg CO₂)"
                  value={carbonFootprint(selected).toLocaleString()}
                  icon={<Sparkles className="h-5 w-5" />}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Compliance queries</CardTitle>
                  <CardDescription>
                    One click answers questions that take enterprises weeks of spreadsheets.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CompliancePanel root={selected} onHighlight={setHighlight} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Provenance tree</CardTitle>
                  <CardDescription>
                    {selected.verified
                      ? "Certified sample — full attributes."
                      : "Live on-chain asset. Attach minted products as components to grow the tree."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProvenanceTree node={selected} highlight={highlight} />
                  {!selected.verified && (
                    <AttachComponent
                      rootTokenId={selected.tokenId!}
                      candidates={chainAssets}
                      existing={selected}
                      onAttach={attach}
                    />
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Select a product to view its provenance tree.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <RecallDialog open={recallOpen} onOpenChange={setRecallOpen} forest={forest} />
    </div>
  );
}

function ForestCard({
  root,
  active,
  onSelect,
  sample,
}: {
  root: ProvNode;
  active: boolean;
  onSelect: () => void;
  sample?: boolean;
}) {
  const recalls = recallAudit(root).length;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-colors",
        active ? "border-primary bg-secondary/50 ring-1 ring-primary" : "hover:bg-secondary/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{root.label}</span>
        {sample && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
            Sample
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{countNodes(root)} parts</span>
        <span>{root.grade}</span>
        {recalls > 0 && <span className="font-medium text-red-600">{recalls} recalled</span>}
      </div>
    </button>
  );
}

function AttachComponent({
  rootTokenId,
  candidates,
  existing,
  onAttach,
}: {
  rootTokenId: string;
  candidates: ChainAsset[];
  existing: ProvNode;
  onAttach: (rootTokenId: string, childTokenId: string) => void;
}) {
  // Token ids already somewhere in this tree (avoid cycles / dupes).
  const usedIds = useMemo(() => {
    const ids = new Set<string>();
    const walk = (n: ProvNode) => {
      if (n.tokenId) ids.add(n.tokenId);
      n.children.forEach(walk);
    };
    walk(existing);
    return ids;
  }, [existing]);

  const options = candidates.filter((c) => !usedIds.has(c.tokenId.toString()));

  if (options.length === 0) return null;

  return (
    <div className="mt-4 border-t pt-4">
      <div className="mb-2 text-xs font-medium text-muted-foreground">Attach a component</div>
      <div className="flex flex-wrap gap-2">
        {options.map((c) => (
          <Button
            key={c.tokenId.toString()}
            size="sm"
            variant="outline"
            onClick={() => onAttach(rootTokenId, c.tokenId.toString())}
          >
            + #{c.tokenId.toString()}
          </Button>
        ))}
      </div>
    </div>
  );
}
