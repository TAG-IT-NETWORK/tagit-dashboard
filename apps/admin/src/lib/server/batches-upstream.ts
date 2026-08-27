/**
 * Server-side helpers for the /catalog batch surface (META-T34). Route
 * handlers ONLY — this module reads SERVICES_API_KEY (and RELAYER_API_KEY for
 * execute), which must never reach a client bundle.
 *
 * Upstream = the tagit-services admin batch rail (src/catalog/
 * batch-router.ts), authed with the admin API key injected here — same
 * pattern as templates-upstream (META-T33) / media-proxy / mint-proxy
 * (META-T18). REQ-S-16: mutating calls forward the signed-in identity as
 * X-Actor via lib/actor.ts. Batch create additionally speaks text/csv (the
 * upstream CSV path takes a raw body + templateId out-of-band), and export
 * streams text/csv back — both outside templates-upstream's JSON-only shape,
 * hence this sibling module.
 */

import { getActor } from "@/lib/actor";

const SERVICES_URL = process.env.SERVICES_URL || "https://api.tagit.network";
const FETCH_TIMEOUT_MS = 15_000;

export interface UpstreamResult {
  status: number;
  body: Record<string, unknown>;
}

interface BatchUpstreamInit {
  method?: string;
  /** JSON body (content-type application/json). */
  json?: unknown;
  /** Raw CSV body (content-type text/csv) — batch create's CSV path. */
  csv?: string;
  /**
   * Send the second-tier relayer key. Execute broadcasts a relayer-funded
   * batchMint and sits behind requireRelayerKey in services server.ts —
   * same admin rail the T33 propagate proxy uses.
   */
  relayer?: boolean;
}

async function upstreamHeaders(
  init: BatchUpstreamInit,
  method: string,
): Promise<Record<string, string> | { error: string }> {
  const apiKey = process.env.SERVICES_API_KEY;
  if (!apiKey) return { error: "SERVICES_API_KEY not configured on the server" };
  const relayerKey = process.env.RELAYER_API_KEY;
  const actor = await getActor();
  return {
    authorization: `Bearer ${apiKey}`,
    ...(init.json !== undefined ? { "content-type": "application/json" } : {}),
    ...(init.csv !== undefined ? { "content-type": "text/csv" } : {}),
    ...(init.relayer && relayerKey ? { "x-relayer-key": relayerKey } : {}),
    // REQ-S-16: forward identity on writes; omit entirely when unknown.
    ...(actor && method !== "GET" ? { "x-actor": actor } : {}),
  };
}

/**
 * JSON call to the services admin batch surface. Never throws — network
 * failures come back as a 502-shaped result.
 */
export async function batchesUpstream(
  path: string,
  init: BatchUpstreamInit = {},
): Promise<UpstreamResult> {
  const method = init.method ?? "GET";
  const headers = await upstreamHeaders(init, method);
  if ("error" in headers) return { status: 500, body: { ok: false, error: headers.error } };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVICES_URL}${path}`, {
      method,
      headers,
      ...(init.json !== undefined
        ? { body: JSON.stringify(init.json) }
        : init.csv !== undefined
          ? { body: init.csv }
          : {}),
      cache: "no-store",
      signal: ctrl.signal,
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return {
      status: res.status,
      body: body ?? { ok: false, error: `services returned ${res.status} with a non-JSON body` },
    };
  } catch (e) {
    return {
      status: 502,
      body: { ok: false, error: e instanceof Error ? e.message : String(e) },
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface UpstreamCsvResult {
  status: number;
  /** The CSV text on 200; null otherwise. */
  csv: string | null;
  error: string | null;
}

/** text/csv GET (export.csv passthrough). Never throws. */
export async function batchesUpstreamCsv(path: string): Promise<UpstreamCsvResult> {
  const headers = await upstreamHeaders({}, "GET");
  if ("error" in headers) return { status: 500, csv: null, error: headers.error };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVICES_URL}${path}`, {
      headers,
      cache: "no-store",
      signal: ctrl.signal,
    });
    const text = await res.text().catch(() => "");
    if (res.status !== 200) {
      // Error bodies are the JSON AppError envelope — surface its message.
      let message = `services export returned ${res.status}`;
      try {
        const parsed = JSON.parse(text) as { message?: string; error?: string };
        message = parsed.message ?? parsed.error ?? message;
      } catch {
        // non-JSON error body — keep the generic message
      }
      return { status: res.status, csv: null, error: message };
    }
    return { status: 200, csv: text, error: null };
  } catch (e) {
    return { status: 502, csv: null, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}
