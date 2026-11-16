"use client";

/**
 * Details tab — edits the working-copy identity fields via PUT (fork-on-edit
 * upstream). media:* attribute rows are Media-tab managed and hidden here;
 * saving re-attaches them untouched.
 *
 * Product facts (TAP-T09): for a cosmetics product the tab also edits what a
 * shopper reads on the product page — size, ingredients, how to use, warnings
 * and how long it keeps once opened. Plain text only; services folds line
 * breaks into spaces and holds the length caps.
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

import {
  FACT_LIMITS,
  factsSupported,
  readTemplateFactsDraft,
  takesProductFacts,
  templateFactsDraft,
  type TemplateFactField,
  type TemplateFactsDraft,
} from "@/lib/catalog/product-facts";
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
  facts: TemplateFactsDraft;
}

const TEXTAREA_CLASS =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground disabled:opacity-50";

/** The long-text facts, in the order a shopper reads them. */
const LONG_FACT_FIELDS: ReadonlyArray<{
  field: Exclude<TemplateFactField, "size" | "useWithinMonths">;
  label: string;
  placeholder: string;
  rows: number;
  max: number;
}> = [
  {
    field: "ingredients",
    label: "Ingredients",
    placeholder: "As printed on the pack, e.g. Aqua, Glycerin, Niacinamide",
    rows: 4,
    max: FACT_LIMITS.ingredients,
  },
  {
    field: "howToUse",
    label: "How to use",
    placeholder: "e.g. Apply a small amount to clean skin, morning and evening.",
    rows: 3,
    max: FACT_LIMITS.howToUse,
  },
  {
    field: "warnings",
    label: "Warnings",
    placeholder: "e.g. For external use only. Avoid contact with eyes.",
    rows: 3,
    max: FACT_LIMITS.warnings,
  },
];

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
    facts: templateFactsDraft(t.facts),
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

  const setFact = (field: TemplateFactField, value: string) => {
    setDraft((d) => ({ ...d, facts: { ...d.facts, [field]: value } }));
    setSavedAt(null);
  };

  // Facts are offered when the API knows about them and the category is
  // cosmetics. Otherwise the save does not mention them at all, so whatever
  // the template already holds stays as it is.
  const factsAvailable = factsSupported(template);
  const showFacts = factsAvailable && takesProductFacts(draft.category);
  const factsRead = useMemo(() => readTemplateFactsDraft(draft.facts), [draft.facts]);
  const factsValid = !showFacts || Object.keys(factsRead.errors).length === 0;

  const canSave = !disabled && !saving && draft.name.trim().length > 0 && factsValid;

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
      ...(showFacts ? { facts: factsRead.facts } : {}),
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
          Working-copy fields. Editing a published template forks the draft — the published snapshot
          keeps serving until the next publish.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="detail-name">Name *</Label>
            <Input
              id="detail-name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="detail-brand">Brand</Label>
            <Input
              id="detail-brand"
              value={draft.brand}
              onChange={(e) => set("brand", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="detail-model">Model</Label>
            <Input
              id="detail-model"
              value={draft.model}
              onChange={(e) => set("model", e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="detail-sku">SKU</Label>
            <Input
              id="detail-sku"
              value={draft.sku}
              onChange={(e) => set("sku", e.target.value)}
              className="font-mono"
              disabled={disabled}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="detail-category">Category</Label>
            <Input
              id="detail-category"
              value={draft.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="e.g., cosmetics"
              disabled={disabled}
            />
            {factsAvailable && !showFacts && (
              <p className="text-xs text-muted-foreground">
                Set the category to cosmetics to add product facts: size, ingredients, how to use.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="detail-origin">Origin</Label>
            <Input
              id="detail-origin"
              value={draft.origin}
              onChange={(e) => set("origin", e.target.value)}
              placeholder="e.g., Seoul, South Korea"
              disabled={disabled}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="detail-description">Description</Label>
          <textarea
            id="detail-description"
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            disabled={disabled}
            className={TEXTAREA_CLASS}
            placeholder="Product description (≤ 5000 chars)"
          />
        </div>

        {/* Product facts (TAP-T09) — cosmetics only */}
        {showFacts && (
          <fieldset className="min-w-0 space-y-4 rounded-md border p-4" data-testid="product-facts">
            <legend className="px-1 text-sm font-medium">Product facts</legend>
            <p className="text-xs text-muted-foreground">
              Shown to shoppers on the product page, as plain text. Fill in what applies; an empty
              field is not shown. Line breaks are saved as spaces.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fact-size">Size</Label>
                <Input
                  id="fact-size"
                  value={draft.facts.size}
                  onChange={(e) => setFact("size", e.target.value)}
                  placeholder="e.g., 50 ml"
                  maxLength={FACT_LIMITS.size}
                  disabled={disabled}
                  aria-invalid={factsRead.errors.size ? true : undefined}
                />
                {factsRead.errors.size && (
                  <p className="text-xs text-destructive">{factsRead.errors.size}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fact-use-within">Use within (months after opening)</Label>
                <Input
                  id="fact-use-within"
                  value={draft.facts.useWithinMonths}
                  onChange={(e) => setFact("useWithinMonths", e.target.value)}
                  inputMode="numeric"
                  placeholder="e.g., 12"
                  disabled={disabled}
                  aria-invalid={factsRead.errors.useWithinMonths ? true : undefined}
                />
                {factsRead.errors.useWithinMonths && (
                  <p className="text-xs text-destructive">{factsRead.errors.useWithinMonths}</p>
                )}
              </div>
            </div>
            {LONG_FACT_FIELDS.map(({ field, label, placeholder, rows, max }) => {
              const length = draft.facts[field].length;
              const fieldError = factsRead.errors[field];
              return (
                <div key={field} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor={`fact-${field}`}>{label}</Label>
                    <span
                      className={`text-xs tabular-nums ${
                        length > max ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {length.toLocaleString("en-US")} / {max.toLocaleString("en-US")}
                    </span>
                  </div>
                  <textarea
                    id={`fact-${field}`}
                    value={draft.facts[field]}
                    onChange={(e) => setFact(field, e.target.value)}
                    rows={rows}
                    disabled={disabled}
                    className={TEXTAREA_CLASS}
                    placeholder={placeholder}
                    aria-invalid={fieldError ? true : undefined}
                  />
                  {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
                </div>
              );
            })}
          </fieldset>
        )}

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
