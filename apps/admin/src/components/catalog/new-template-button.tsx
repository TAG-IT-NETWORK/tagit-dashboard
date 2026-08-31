"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@tagit/ui";
import { Loader2, Plus } from "lucide-react";

import { canMutateCatalog, type CatalogRole } from "@/lib/catalog/template-logic";

import { upstreamErrorMessage } from "@/lib/upstream-error";

/**
 * "New template" → POST /api/catalog-proxy/templates { name } (draft) →
 * jump straight into the editor. Slug is server-generated from the name
 * unless overridden here.
 */
export function NewTemplateButton({ role }: { role: CatalogRole | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canMutateCatalog(role)) return null;

  const create = async () => {
    if (name.trim().length === 0 || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/catalog-proxy/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(slug.trim() !== "" ? { slug: slug.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.template?.id) {
        throw new Error(upstreamErrorMessage(data, res.status, "create"));
      }
      router.push(`/catalog/${data.template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        New Template
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New product template</DialogTitle>
          <DialogDescription>
            Creates a draft on tagit-services. Details, media, pricing and publishing live in the
            editor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., PDRN Capsule Cream 100"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Slug (optional)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="lowercase-kebab-case (server generates one if empty)"
              className="font-mono"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={create} disabled={creating || name.trim().length === 0}>
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating…
              </>
            ) : (
              "Create draft"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
