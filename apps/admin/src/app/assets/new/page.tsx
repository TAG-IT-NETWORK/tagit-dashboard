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
 *   4. submit → POST /api/mint-proxy { to, docDraft, mintRequestId } —
 *      uploaded media already linked inside the docDraft; the proxy PUTs the
 *      LIST price once the token is minted,
 *   5. result: tokenId + txHash + link to the verify page.
 *
 * Idempotency: ONE mintRequestId per attempt. A retry (after a network error,
 * a timeout, or a mint_failed) re-sends the same id, so services returns or
 * retries the same row and can never mint a second token. The id is only
 * replaced when the operator edits the form (a new draft is a new attempt)
 * or starts "Mint another".
 *
 * Pending: if the mint is submitted but not confirmed within the proxy call,
 * the proxy answers 202 mint_pending. That is NOT a failure — the form polls
 * GET /api/mint-proxy?mintRequestId=… and, once minted, re-POSTs the same id
 * (an idempotent replay) to get the tokenId and list the price.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** How often, and for how long, to poll a pending mint before handing off. */
const POLL_EVERY_MS = 5_000;
const POLL_FOR_MS = 20 * 60_000;

interface MintSuccess {
  tokenId: string;
  txHash?: string;
  priceListed: boolean;
  priceError?: string;
}

interface MintPending {
  mintRequestId: string;
  txHash?: string;
  since: number;
  /** Polling ran out — the reconciler will still finish it server-side. */
  gaveUp: boolean;
}

type MintReply =
  | { kind: "minted"; success: MintSuccess }
  | { kind: "pending"; txHash?: string }
  | { kind: "failed"; error: string };

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Map one /api/mint-proxy POST reply onto minted / pending / failed. */
function parseMintReply(res: Response, data: Record<string, unknown>): MintReply {
  if (data.ok === true && data.status === "mint_pending") {
    return { kind: "pending", txHash: typeof data.txHash === "string" ? data.txHash : undefined };
  }
  if (res.ok && data.ok === true && data.tokenId) {
    const priceBlock = data.price as { ok?: boolean; error?: string } | undefined;
    return {
      kind: "minted",
      success: {
        tokenId: String(data.tokenId),
        txHash: typeof data.txHash === "string" ? data.txHash : undefined,
        priceListed: priceBlock?.ok === true,
        priceError: priceBlock && priceBlock.ok !== true ? priceBlock.error : undefined,
      },
    };
  }
  const error = typeof data.error === "string" ? data.error : `mint failed (${res.status})`;
  return { kind: "failed", error };
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
  const [pending, setPending] = useState<MintPending | null>(null);

  // One idempotency key per attempt (see header). Lazily created on submit.
  const mintRequestIdRef = useRef<string | null>(null);

  const priceValid = priceUsdc === "" || isValidUsdcString(priceUsdc);
  const toValid = ADDR_RE.test(to);
  const canSubmit = !submitting && !pending && name.trim().length > 0 && toValid && priceValid;

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

  // Editing the form after a failed attempt makes the next submit a NEW
  // attempt (new draft → new key). Never while a mint is in flight: then the
  // key must survive so the pending row can be collected.
  useEffect(() => {
    if (!pending) mintRequestIdRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on input change only
  }, [docDraft, to, priceUsdc]);

  /** POST (or idempotently re-POST) the current attempt. */
  const postMint = useCallback(
    async (mintRequestId: string): Promise<MintReply> => {
      try {
        const res = await fetch("/api/mint-proxy", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            to,
            docDraft,
            mintRequestId,
            ...(priceUsdc !== "" ? { priceUsdc } : {}),
          }),
        });
        return parseMintReply(res, await readJson(res));
      } catch {
        // The request may or may not have reached the server. Same key on
        // retry makes that safe — say so instead of "failed".
        return {
          kind: "failed",
          error:
            "Couldn't reach the server to confirm the mint. Click Mint again to check — it reuses the same request and won't create a duplicate.",
        };
      }
    },
    [to, docDraft, priceUsdc],
  );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    setSubmitting(true);
    const mintRequestId = (mintRequestIdRef.current ??= crypto.randomUUID());
    try {
      const reply = await postMint(mintRequestId);
      if (reply.kind === "minted") {
        setSuccess(reply.success);
      } else if (reply.kind === "pending") {
        setPending({ mintRequestId, txHash: reply.txHash, since: Date.now(), gaveUp: false });
      } else {
        setSubmitError(reply.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Poll a pending mint; once minted, re-POST the same key to collect the
  // tokenId and list the price (the proxy only lists on a minted reply).
  useEffect(() => {
    if (!pending || pending.gaveUp) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - pending.since > POLL_FOR_MS) {
        setPending((p) => (p ? { ...p, gaveUp: true } : p));
        return;
      }
      try {
        const res = await fetch(
          `/api/mint-proxy?mintRequestId=${encodeURIComponent(pending.mintRequestId)}`,
          { cache: "no-store" },
        );
        const data = await readJson(res);
        if (cancelled) return;
        if (data.ok === true && data.status === "minted") {
          const reply = await postMint(pending.mintRequestId);
          if (cancelled) return;
          if (reply.kind === "minted") {
            setPending(null);
            setSuccess(reply.success);
            return;
          }
        } else if (data.ok === true && data.status === "mint_failed") {
          // Terminal on-chain failure: nothing minted. Keep the key — Mint
          // again retries this same row.
          setPending(null);
          setSubmitError(
            "The mint transaction failed on-chain — nothing was created. Click Mint again to retry.",
          );
          return;
        }
      } catch {
        // transient — keep polling
      }
      if (!cancelled) timer = setTimeout(tick, POLL_EVERY_MS);
    };
    timer = setTimeout(tick, POLL_EVERY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pending, postMint]);

  const resetForm = () => {
    mintRequestIdRef.current = null;
    setSuccess(null);
    setPending(null);
    setSubmitError(null);
    setName("");
    setBrand("");
    setModel("");
    setSku("");
    setOrigin("");
    setDescription("");
    setMedia([]);
    setPriceUsdc("");
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
              <Button variant="ghost" onClick={resetForm}>
                Mint another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {pending.gaveUp ? (
                <Package className="h-5 w-5 text-amber-500" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              {pending.gaveUp ? "Mint still confirming" : "Mint submitted — confirming on-chain"}
            </CardTitle>
            <CardDescription>
              {pending.gaveUp
                ? "The transaction was sent and the server will finish it on its own. Check the Assets list shortly."
                : "The transaction was sent. This page updates by itself when it's confirmed — don't click Mint again."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {pending.txHash && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tx hash</span>
                <span className="font-mono text-xs break-all">{pending.txHash}</span>
              </div>
            )}
            {priceUsdc !== "" && (
              <p className="text-muted-foreground">
                {pending.gaveUp
                  ? `The ${priceUsdc} USDC price was not listed yet — set it from the asset's page once it appears.`
                  : `The ${priceUsdc} USDC price is listed as soon as the mint confirms. Keep this page open until then.`}
              </p>
            )}
            <div className="flex gap-2 pt-3">
              <Button variant="outline" asChild>
                <Link href="/assets">Go to Assets</Link>
              </Button>
              {pending.gaveUp && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    setPending((p) => (p ? { ...p, since: Date.now(), gaveUp: false } : p))
                  }
                >
                  Keep checking
                </Button>
              )}
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
      {!submitting && !canSubmit && (
        <p className="text-xs text-muted-foreground text-center">
          {[
            name.trim().length === 0 && "a name",
            !toValid && "a valid owner address",
            !priceValid && "a valid price",
          ]
            .filter(Boolean)
            .join(", ")
            .replace(/^/, "Still needed: ")}
        </p>
      )}
    </div>
  );
}
