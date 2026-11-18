import { NextResponse } from "next/server";

import { actorHeader, getActor, getTenant, tenantHeader } from "@/lib/actor";
import { getActorRole } from "@/lib/actor-role";
import { canMutateCatalog } from "@/lib/catalog/template-logic";

/**
 * /api/mint-proxy — server-side proxy for the minimal mint form (META-T18).
 * Forwards to tagit-services with BOTH credentials injected server-side
 * (mint broadcasts a relayer transaction, so services requires the relayer
 * key on top of the general API key). Neither key ever reaches the browser.
 *
 * POST body: {
 *   to:            0x recipient (relayer-minted owner),
 *   docDraft:      free-form draft doc (media already linked inside it),
 *   mintRequestId: client-held idempotency key — the form keeps the SAME id
 *                  across retries of one attempt, so a retry can never mint
 *                  a second token (services is idempotent on it),
 *   priceUsdc?:    decimal string — when present and the token is minted, a
 *                  follow-up PUT /api/v1/assets/:tokenId/price {action:LIST}
 *                  lists the token at that price.
 * }
 *
 * POST replies:
 *   200 { ok:true, status:"minted", tokenId, txHash, price? }
 *   202 { ok:true, status:"mint_pending", mintRequestId, txHash? }
 *       — submitted but not confirmed within this call. NOT a failure: the
 *       form polls GET below, then re-POSTs the same mintRequestId (an
 *       idempotent replay) to collect the tokenId and list the price.
 *   4xx/5xx { ok:false, error, status? } — "mint_failed" means nothing was
 *       minted and a retry with the same id is safe.
 *
 * Services mints asynchronously by default (202 right after tx submission,
 * finalization detached; the cron reconciler only sweeps rows older than
 * ~10 min). The admin form asks for `?wait=true` so a normal mint finishes
 * inside this one call (Base Sepolia receipts land in seconds) and the
 * operator sees the real tokenId instead of waiting on the reconciler.
 *
 * GET ?mintRequestId=… → read-only mint status (general API key only).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SERVICES_URL = process.env.SERVICES_URL || "https://api.tagit.network";

/** Stop waiting on the synchronous mint before this route's own limit. */
const MINT_WAIT_MS = 45_000;

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
// Mirror of tagit-services parseUsdcString (see src/lib/usdc.ts).
const USDC_RE = /^(0|[1-9]\d{0,11})(\.\d{1,6})?$/;

interface UpstreamMint {
  ok?: boolean;
  error?: string;
  status?: string;
  tokenId?: string;
  txHash?: string;
  created?: boolean;
  item?: { status?: string; txHash?: string | null } | null;
}

function pendingReply(mintRequestId: string, txHash?: string | null) {
  return NextResponse.json(
    {
      ok: true,
      status: "mint_pending",
      mintRequestId,
      ...(txHash ? { txHash } : {}),
    },
    { status: 202 },
  );
}

export async function POST(req: Request) {
  // WB-07: in-route role re-check (operator+) — defense in depth behind the
  // middleware path gate, same as every other mutating proxy.
  if (!canMutateCatalog(await getActorRole())) {
    return NextResponse.json({ ok: false, error: "viewer role is read-only" }, { status: 403 });
  }

  const apiKey = process.env.SERVICES_API_KEY;
  const relayerKey = process.env.RELAYER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "SERVICES_API_KEY not configured on the server" },
      { status: 500 },
    );
  }

  let body: {
    to?: unknown;
    docDraft?: unknown;
    mintRequestId?: unknown;
    priceUsdc?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const to = String(body.to ?? "");
  const mintRequestId = String(body.mintRequestId ?? "");
  if (!ADDR_RE.test(to)) {
    return NextResponse.json({ ok: false, error: "to must be a 0x address" }, { status: 400 });
  }
  if (!mintRequestId || mintRequestId.length > 200) {
    return NextResponse.json({ ok: false, error: "mintRequestId required" }, { status: 400 });
  }
  if (typeof body.docDraft !== "object" || body.docDraft === null || Array.isArray(body.docDraft)) {
    return NextResponse.json({ ok: false, error: "docDraft must be an object" }, { status: 400 });
  }
  const priceUsdc =
    body.priceUsdc === undefined || body.priceUsdc === null || body.priceUsdc === ""
      ? undefined
      : String(body.priceUsdc);
  if (priceUsdc !== undefined && !USDC_RE.test(priceUsdc)) {
    return NextResponse.json(
      { ok: false, error: "priceUsdc must be a decimal string with at most 6 decimals" },
      { status: 400 },
    );
  }

  // REQ-S-16 (META-T32): name the signed-in human on every mutating call.
  const actor = await getActor();
  const tenant = await getTenant();
  const authHeaders = {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
    ...tenantHeader(tenant),
    ...(relayerKey ? { "x-relayer-key": relayerKey } : {}),
    ...actorHeader(actor),
  };

  let mintRes: Response;
  try {
    mintRes = await fetch(`${SERVICES_URL}/api/v1/assets/mint?wait=true`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ to, docDraft: body.docDraft, mintRequestId }),
      signal: AbortSignal.timeout(MINT_WAIT_MS),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      // The request reached services (or may have) and services keeps going
      // on its own invocation — report pending, never "failed": a failure
      // message here is what invites a duplicate-minting retry.
      return pendingReply(mintRequestId);
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  const mintData: UpstreamMint = await mintRes
    .json()
    .catch(() => ({ ok: false, error: `mint upstream returned ${mintRes.status}` }));

  const tokenId = mintData.ok ? mintData.tokenId : undefined;
  if (!tokenId) {
    // Submitted but not finalized: either an idempotent replay of a row that
    // is still pending (202 ok:true), or a sync wait whose receipt outcome is
    // unknown (502, row left mint_pending for the reconciler). Both are
    // "in flight", not failures.
    const rowStatus = mintData.status ?? mintData.item?.status;
    if (rowStatus === "mint_pending" && (mintData.ok || mintData.txHash || mintData.item?.txHash)) {
      return pendingReply(mintRequestId, mintData.txHash ?? mintData.item?.txHash);
    }
    return NextResponse.json(
      {
        ok: false,
        error: mintData.error || `mint failed (upstream ${mintRes.status})`,
        ...(rowStatus ? { status: rowStatus } : {}),
      },
      { status: mintRes.ok ? 502 : mintRes.status },
    );
  }

  // Optional listing — best-effort after a successful mint; a price failure
  // must not hide the minted token from the caller.
  let priceResult: unknown = undefined;
  if (priceUsdc !== undefined) {
    try {
      const priceRes = await fetch(`${SERVICES_URL}/api/v1/assets/${tokenId}/price`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ action: "LIST", priceUsdc }),
      });
      priceResult = await priceRes
        .json()
        .catch(() => ({ ok: false, error: `price upstream returned ${priceRes.status}` }));
    } catch (e) {
      priceResult = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json({
    ok: true,
    status: "minted",
    tokenId,
    txHash: mintData.txHash,
    created: mintData.created,
    ...(priceResult !== undefined ? { price: priceResult } : {}),
  });
}

export async function GET(req: Request) {
  if (!canMutateCatalog(await getActorRole())) {
    return NextResponse.json({ ok: false, error: "viewer role is read-only" }, { status: 403 });
  }
  const apiKey = process.env.SERVICES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "SERVICES_API_KEY not configured on the server" },
      { status: 500 },
    );
  }

  const mintRequestId = new URL(req.url).searchParams.get("mintRequestId") ?? "";
  if (!mintRequestId || mintRequestId.length > 200) {
    return NextResponse.json({ ok: false, error: "mintRequestId required" }, { status: 400 });
  }

  const tenant = await getTenant();
  try {
    const res = await fetch(
      `${SERVICES_URL}/api/v1/assets/mint/${encodeURIComponent(mintRequestId)}/status`,
      {
        headers: { authorization: `Bearer ${apiKey}`, ...tenantHeader(tenant) },
        cache: "no-store",
      },
    );
    const data = await res
      .json()
      .catch(() => ({ ok: false, error: `status upstream returned ${res.status}` }));
    return NextResponse.json(
      {
        ok: data.ok === true,
        ...(data.ok === true
          ? {
              mintRequestId,
              status: data.status,
              ...(data.tokenId ? { tokenId: data.tokenId } : {}),
              ...(data.txHash ? { txHash: data.txHash } : {}),
            }
          : { error: data.error ?? `status upstream returned ${res.status}` }),
      },
      { status: res.status },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
