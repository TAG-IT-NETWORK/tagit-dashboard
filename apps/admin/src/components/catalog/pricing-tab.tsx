"use client";

/**
 * Pricing tab — template default price (usdc-6) + optional MSRP.
 *
 * Client validation mirrors the services parseUsdcString regex verbatim
 * (@/lib/usdc — same mirror the T18 mint form uses); the server remains the
 * enforcement point (PRICE_TOO_PRECISE → 400). priceUsdc6/msrp are
 * catalog-side fields with NO doc representation (services
 * template-snapshot.ts F1): pricing changes apply instantly to catalog
 * reads — no chain write, no re-anchor.
 */

import { useState } from "react";
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
import { Info, Loader2, Save } from "lucide-react";

import {
  CURRENCY_EXPONENTS,
  formatMsrpDisplay,
  usdc6ToDecimalInput,
} from "@/lib/catalog/template-logic";
import type { TemplateDto } from "@/lib/catalog/template-types";
import { isValidUsdcString, usdcStringToUnits } from "@/lib/usdc";

interface PricingTabProps {
  template: TemplateDto;
  disabled: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<string | null>;
}

export function PricingTab({ template, disabled, onSave }: PricingTabProps) {
  const [price, setPrice] = useState(() => usdc6ToDecimalInput(template.priceUsdc6));
  const [msrpAmount, setMsrpAmount] = useState(() =>
    template.msrpAmount !== null ? String(template.msrpAmount) : "",
  );
  const [msrpCurrency, setMsrpCurrency] = useState(() => template.msrpCurrency ?? "USD");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const priceValid = price === "" || isValidUsdcString(price);
  const msrpValid = msrpAmount === "" || /^\d{1,15}$/.test(msrpAmount);
  const canSave = !disabled && !saving && priceValid && msrpValid;

  const priceUnits = price !== "" && priceValid ? usdcStringToUnits(price) : null;
  const msrpPreview =
    msrpAmount !== "" && msrpValid ? formatMsrpDisplay(Number(msrpAmount), msrpCurrency) : null;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const err = await onSave({
      // Decimal string goes upstream as-is — services parseUsdcString is the
      // authority; null clears the price.
      priceUsdc6: price === "" ? null : price,
      msrp:
        msrpAmount === ""
          ? null
          : { amount: Number(msrpAmount), currency: msrpCurrency },
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
        <CardTitle className="text-base">Pricing</CardTitle>
        <CardDescription>Template default price for items adopted onto it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Pricing applies instantly to catalog reads — it is a catalog-side field with no doc
            representation: no chain write, no metadata re-anchor.
          </span>
        </div>

        <div className="space-y-2">
          <Label>Price (USDC)</Label>
          <Input
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setSavedAt(null);
            }}
            placeholder="e.g., 22 or 19.99 (empty clears)"
            className="font-mono"
            inputMode="decimal"
            disabled={disabled}
          />
          {!priceValid && (
            <p className="text-xs text-destructive">
              Must be a plain decimal amount with at most 6 decimals (same rule the server
              enforces).
            </p>
          )}
          {priceUnits !== null && (
            <p className="text-xs text-muted-foreground font-mono">= {priceUnits} usdc-6 units</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>MSRP (minor units)</Label>
            <Input
              value={msrpAmount}
              onChange={(e) => {
                setMsrpAmount(e.target.value);
                setSavedAt(null);
              }}
              placeholder="e.g., 2500 = 25.00 USD (empty clears)"
              className="font-mono"
              inputMode="numeric"
              disabled={disabled}
            />
            {!msrpValid && (
              <p className="text-xs text-destructive">Whole minor units only (e.g. cents).</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>MSRP currency</Label>
            <select
              value={msrpCurrency}
              onChange={(e) => {
                setMsrpCurrency(e.target.value);
                setSavedAt(null);
              }}
              disabled={disabled || msrpAmount === ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-50"
            >
              {Object.keys(CURRENCY_EXPONENTS).map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>
        {msrpPreview && (
          <p className="text-xs text-muted-foreground">MSRP preview: {msrpPreview}</p>
        )}

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
                Save pricing
              </>
            )}
          </Button>
          {savedAt !== null && <span className="text-xs text-muted-foreground">Saved.</span>}
        </div>
      </CardContent>
    </Card>
  );
}
