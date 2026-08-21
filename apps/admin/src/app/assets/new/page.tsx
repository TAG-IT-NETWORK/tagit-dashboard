"use client";

/**
 * /assets/new — the minimal P1 mint form (META-T18).
 *
 * Replaces the retired /test/lifecycle mint path and the dead
 * "/assets?action=mint" button. Flow:
 *
 *   1. details fields → a free-form docDraft (templateId: null is first-class
 *      — there is no template picker in P1),
 *   2. media files upload through POST /api/media-proxy (the admin API key is
 *      injected server-side and NEVER reaches this browser code),
 *   3. price (optional) is validated with a client-side mirror of the
 *      server's parseUsdcString regex (@/lib/usdc) — instant feedback, server
 *      remains the enforcement point,
 *   4. submit → POST /api/mint-proxy { to, docDraft, mintRequestId:
 *      crypto.randomUUID() } (uploaded media already linked inside the
 *      docDraft; the proxy PUTs the LIST price after a successful mint),
 *   5. result: tokenId + txHash + link to the verify page.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
} from "@tagit/ui";
import { ArrowLeft, ExternalLink, Loader2, Package } from "lucide-react";
import { isValidUsdcString } from "@/lib/usdc";
import { MediaPanel, type UploadedMedia } from "@/components/media-panel";

const VERIFY_URL = process.env.NEXT_PUBLIC_VERIFY_URL || "https://verify.tagit.network";

const CATEGORIES = ["cosmetics", "apparel", "watches", "electronics", "other"] as const;

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

interface MintSuccess {
  tokenId: string;
  txHash?: string;
  priceListed: boolean;
  priceError?: string;
}

export default function NewAssetPage() {
  // Details
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("other");
  const [origin, setOrigin] = useState("");
  const [description, setDescription] = useState("");
  const [to, setTo] = useState("");

  // Media (upload flow lives in the shared MediaPanel — META-T18 proxy)
  const [media, setMedia] = useState<UploadedMedia[]>([]);

  // Price
  const [priceUsdc, setPriceUsdc] = useState("");

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<MintSuccess | null>(null);

  const priceValid = priceUsdc === "" || isValidUsdcString(priceUsdc);
  const toValid = ADDR_RE.test(to);
  const canSubmit = !submitting && name.trim().length > 0 && toValid && priceValid;

  const docDraft = useMemo(
    () => ({
      name: name.trim(),
      description: description.trim(),
      ...(media[0] ? { image: media[0].url } : {}),
      attributes: [],
      tagit: {
        // template_id null is first-class in P1 — no template picker.
        templateId: null,
        templateVersion: null,
        brand: brand.trim(),
        model: model.trim(),
        sku: sku.trim(),
        category,
        countryOfOrigin: origin.trim(),
        media: media.map((m) => ({
          role: m.role,
          sha256: m.sha256,
          mime: m.mime,
          url: m.url,
          ipfs: null,
        })),
      },
    }),
    [name, description, brand, model, sku, category, origin, media],
  );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/mint-proxy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to,
          docDraft,
          mintRequestId: crypto.randomUUID(),
          ...(priceUsdc !== "" ? { priceUsdc } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.tokenId) {
        throw new Error(data.error || `mint failed (${res.status})`);
      }
      const priceBlock = data.price as { ok?: boolean; error?: string } | undefined;
      setSuccess({
        tokenId: String(data.tokenId),
        txHash: data.txHash,
        priceListed: priceBlock?.ok === true,
        priceError: priceBlock && priceBlock.ok !== true ? priceBlock.error : undefined,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-500" />
              Asset minted
            </CardTitle>
            <CardDescription>DB-first mint accepted by tagit-services.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Token ID</span>
              <span className="font-mono font-bold">#{success.tokenId}</span>
            </div>
            {success.txHash && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tx hash</span>
                <span className="font-mono text-xs break-all">{success.txHash}</span>
              </div>
            )}
            {priceUsdc !== "" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Listing</span>
                <span>
                  {success.priceListed
                    ? `Listed at ${priceUsdc} USDC`
                    : `Not listed${success.priceError ? ` — ${success.priceError}` : ""}`}
                </span>
              </div>
            )}
            <div className="flex gap-2 pt-3">
              <Button asChild>
                <a
                  href={`${VERIFY_URL}/asset/${success.tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on verify
                  <ExternalLink className="h-3 w-3 ml-2" />
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/assets/${success.tokenId}`}>Asset details</Link>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSuccess(null);
                  setName("");
                  setBrand("");
                  setModel("");
                  setSku("");
                  setOrigin("");
                  setDescription("");
                  setMedia([]);
                  setPriceUsdc("");
                }}
              >
                Mint another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/assets">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Assets
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Mint Asset</h1>
          <p className="text-muted-foreground text-sm">
            DB-first mint via tagit-services — no template (P1), media via the secure proxy.
          </p>
        </div>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., PDRN Capsule Cream 100"
              />
            </div>
            <div className="space-y-2">
              <Label>Brand</Label>
              <Input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., TAG IT"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g., PDRN-100"
              />
            </div>
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g., CW2288-111"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Origin</Label>
              <Input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g., Seoul, South Korea"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief product description"
            />
          </div>
          <div className="space-y-2">
            <Label>Mint to (owner address) *</Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="0x..."
              className="font-mono"
            />
            {to !== "" && !toValid && (
              <p className="text-xs text-destructive">Must be a 0x address (40 hex chars).</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Media */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Media</CardTitle>
          <CardDescription>
            Uploaded via the server-side proxy — the services API key never reaches this browser.
            First upload becomes the hero image.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MediaPanel media={media} onChange={setMedia} />
        </CardContent>
      </Card>

      {/* Price */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Price (optional)</CardTitle>
          <CardDescription>
            Lists the token for sale after mint. String with at most 6 decimals — validated with the
            same rule the server enforces.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Price (USDC)</Label>
          <Input
            value={priceUsdc}
            onChange={(e) => setPriceUsdc(e.target.value)}
            placeholder="e.g., 22 or 19.99"
            className="font-mono"
            inputMode="decimal"
          />
          {!priceValid && (
            <p className="text-xs text-destructive">
              Must be a plain decimal amount with at most 6 decimals (e.g., 22, 19.99, 0.000001).
            </p>
          )}
        </CardContent>
      </Card>

      {submitError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">{submitError}</p>
          </CardContent>
        </Card>
      )}

      <Button className="w-full" onClick={handleSubmit} disabled={!canSubmit}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Minting…
          </>
        ) : (
          <>
            <Package className="h-4 w-4 mr-2" />
            Mint Asset
          </>
        )}
      </Button>
    </div>
  );
}
