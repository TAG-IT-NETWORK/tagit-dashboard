"use client";

/**
 * Details tab — edits the working-copy identity fields via PUT (fork-on-edit
 * upstream). media:* attribute rows are Media-tab managed and hidden here;
 * saving re-attaches them untouched.
 */

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@tagit/ui";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

import { isMediaAttribute, MAX_ATTRIBUTES } from "@/lib/catalog/template-logic";
import type { TemplateAttribute, TemplateDto } from "@/lib/catalog/template-types";

interface DetailsTabProps {
  template: TemplateDto;
  disabled: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<string | null>;
}

interface DetailsDraft {
  name: string;
  brand: string;
  model: string;
  sku: string;
  category: string;
  origin: string;
  description: string;
  attributes: TemplateAttribute[];
}

function draftFrom(t: TemplateDto): DetailsDraft {
  return {
    name: t.name,
    brand: t.brand ?? "",
    model: t.model ?? "",
    sku: t.sku ?? "",
    category: t.category ?? "",
    origin: t.origin ?? "",
    description: t.description ?? "",
    attributes: (t.attributes ?? []).filter((a) => !isMediaAttribute(a)),
  };
}

export function DetailsTab({ template, disabled, onSave }: DetailsTabProps) {
  const [draft, setDraft] = useState<DetailsDraft>(() => draftFrom(template));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const mediaAttrs = useMemo(
    () => (template.attributes ?? []).filter(isMediaAttribute),
    [template.attributes],
  );

  const set = <K extends keyof DetailsDraft>(key: K, value: DetailsDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSavedAt(null);
  };

  const setAttr = (index: number, field: keyof TemplateAttribute, value: string) => {
    setDraft((d) => ({
      ...d,
      attributes: d.attributes.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    }));
    setSavedAt(null);
  };

  const canSave = !disabled && !saving && draft.name.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const nullable = (s: string) => (s.trim() === "" ? null : s.trim());
    const attributes = [
      ...draft.attributes.filter((a) => a.trait_type.trim() !== "" || a.value.trim() !== ""),
      ...mediaAttrs, // Media-tab rows ride along untouched
    ];
    const err = await onSave({
      name: draft.name.trim(),
      brand: nullable(draft.brand),
      model: nullable(draft.model),
      sku: nullable(draft.sku),
      category: nullable(draft.category),
      origin: nullable(draft.origin),
      description: nullable(draft.description),
      attributes: attributes.length > 0 ? attributes : null,
    });
    setSaving(false);
    if (err) {
      setError(err);
    } else {
      setSavedAt(Date.now());
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Details</CardTitle>
        <CardDescription>
          Working-copy fields. Editing a published template forks the draft — the published
          snapshot keeps serving until the next publish.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <Input
              value={draft.brand}
              onChange={(e) => set("brand", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Model</Label>
            <Input
              value={draft.model}
              onChange={(e) => set("model", e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>SKU</Label>
            <Input
              value={draft.sku}
              onChange={(e) => set("sku", e.target.value)}
              className="font-mono"
              disabled={disabled}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Input
              value={draft.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="e.g., cosmetics"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>Origin</Label>
            <Input
              value={draft.origin}
              onChange={(e) => set("origin", e.target.value)}
              placeholder="e.g., Seoul, South Korea"
              disabled={disabled}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <textarea
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            disabled={disabled}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground disabled:opacity-50"
            placeholder="Product description (≤ 5000 chars)"
          />
        </div>

        {/* Attributes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Attributes</Label>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || draft.attributes.length + mediaAttrs.length >= MAX_ATTRIBUTES}
              onClick={() =>
                set("attributes", [...draft.attributes, { trait_type: "", value: "" }])
              }
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          {draft.attributes.length === 0 && (
            <p className="text-xs text-muted-foreground">No attributes.</p>
          )}
          {draft.attributes.map((attr, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={attr.trait_type}
                onChange={(e) => setAttr(i, "trait_type", e.target.value)}
                placeholder="trait_type"
                disabled={disabled}
              />
              <Input
                value={attr.value}
                onChange={(e) => setAttr(i, "value", e.target.value)}
                placeholder="value"
                disabled={disabled}
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  set(
                    "attributes",
                    draft.attributes.filter((_, j) => j !== i),
                  )
                }
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {mediaAttrs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              +{mediaAttrs.length} media row{mediaAttrs.length === 1 ? "" : "s"} managed on the
              Media tab.
            </p>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={!canSave}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save details
              </>
            )}
          </Button>
          {savedAt !== null && <span className="text-xs text-muted-foreground">Saved.</span>}
        </div>
      </CardContent>
    </Card>
  );
}
