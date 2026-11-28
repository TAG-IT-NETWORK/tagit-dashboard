import type { BrandSession } from "@/lib/brand-session";
import {
  parseProducts,
  parseSummary,
  type ItemCounts,
  type ProductList,
} from "@/lib/brand-catalog";
import {
  parseCreatedProduct,
  parseProductDetail,
  parseProductId,
  parseUploadedPhoto,
  type ProductBody,
  type ProductDetail,
} from "@/lib/brand-product-form";
import {
  dayWords,
  ITEMS_PER_PAGE,
  parseCursor,
  parseItems,
  type ItemPage,
} from "@/lib/brand-items";
import {
  bodyForRun,
  parseCreatedRun,
  parseQuantity,
  parseRun,
  parseRunId,
  parseRuns,
  parseStart,
  RUNS_SHOWN,
  type ItemRun,
  type RunFacts,
  type RunSummary,
  type StartResult,
} from "@/lib/brand-make-items";
import {
  parseItemNumber,
  parseSaleAnswer,
  saleBody,
  type SaleIntent,
  type SaleResult,
} from "@/lib/brand-selling";
import {
  parseTeam,
  parseTeamAnswer,
  parseTeamEmail,
  parseTeamRole,
  type TeamMember,
  type TeamResult,
} from "@/lib/brand-team";
import { parseBrandProfile, type BrandProfile } from "@/lib/brand-view";

/**
 * The one door from the brand app to tagit-services (TAP-T17). SERVER ONLY.
 *
 * Rules, each pinned by a unit test:
 * - a call needs a BrandSession, and is ALWAYS made under that session's
 *   brand: the brand header is set here and cannot be left out or replaced;
 * - the caller cannot pass headers at all, so nothing from the browser can
 *   name another brand, another actor or another key;
 * - only /api/v1/ paths, and only on the configured services host;
 * - the key is read here, on the server, and is never returned or logged.
 *
 * tagit-services checks the brand again on every call; this is the first
 * wall, not the only one.
 */

const DEFAULT_SERVICES_URL = "https://api.tagit.network";
const SERVICES_TIMEOUT_MS = 10_000;

export class BrandServicesError extends Error {
  constructor(public readonly code: "NOT_CONFIGURED" | "NO_BRAND" | "BAD_PATH") {
    super(code);
    this.name = "BrandServicesError";
  }
}

export interface BrandCall {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Sent as JSON. */
  body?: unknown;
  /**
   * One file, sent as a multipart upload in the field tagit-services reads
   * ("files"). Not together with `body`.
   */
  file?: Blob;
}

/** The path must be a plain /api/v1/ path: no host, no dot segments, no tricks. */
export function isServicesPath(path: unknown): path is string {
  if (typeof path !== "string" || !path.startsWith("/api/v1/") || path.length > 1000) return false;
  if (path.includes("//") || path.includes("\\") || path.includes("..")) return false;
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f || code === 0x23 /* # */ || code === 0x40 /* @ */) {
      return false;
    }
  }
  return true;
}

export interface BrandAnswer {
  status: number;
  body: unknown;
}

export async function brandFetch(
  session: BrandSession,
  path: string,
  call: BrandCall = {},
): Promise<BrandAnswer> {
  const apiKey = process.env.SERVICES_API_KEY;
  if (!apiKey) throw new BrandServicesError("NOT_CONFIGURED");
  // The type already demands a brand session; check again at run time, so a
  // cast or a bad object can never produce a call with no brand on it.
  if (!session || typeof session.brandId !== "string" || session.brandId.length === 0) {
    throw new BrandServicesError("NO_BRAND");
  }
  if (!isServicesPath(path)) throw new BrandServicesError("BAD_PATH");

  const base = (process.env.SERVICES_URL || DEFAULT_SERVICES_URL).replace(/\/+$/, "");
  const headers: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
    "x-business-id": session.brandId,
    "x-actor": session.email,
  };
  const hasBody = call.body !== undefined;
  let payload: string | FormData | undefined;
  if (call.file !== undefined) {
    // The multipart boundary is set by fetch; a content-type here would break it.
    const form = new FormData();
    form.append("files", call.file, "photo");
    payload = form;
  } else if (hasBody) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(call.body);
  }

  const res = await fetch(`${base}${path}`, {
    method: call.method ?? "GET",
    headers,
    body: payload,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(SERVICES_TIMEOUT_MS),
  });
  const body: unknown = await res.json().catch(() => null);
  return { status: res.status, body };
}

/** The signed-in brand's own record. Never throws: the page opens regardless. */
export async function getBrandProfile(session: BrandSession): Promise<BrandProfile> {
  try {
    const answer = await brandFetch(
      session,
      `/api/v1/admin/businesses/${encodeURIComponent(session.brandId)}`,
    );
    return parseBrandProfile(answer.status, answer.body, session.brandId);
  } catch {
    return parseBrandProfile(0, null, session.brandId);
  }
}

/** The signed-in brand's products. Never throws: the page says it could not load. */
export async function getBrandProducts(session: BrandSession): Promise<ProductList> {
  try {
    const answer = await brandFetch(session, "/api/v1/admin/templates");
    return parseProducts(answer.status, answer.body, session.brandId);
  } catch {
    return parseProducts(0, null, session.brandId);
  }
}

/** The signed-in brand's item counts, or null when they could not be read. */
export async function getBrandSummary(session: BrandSession): Promise<ItemCounts | null> {
  try {
    const answer = await brandFetch(session, "/api/v1/admin/catalog/summary");
    return parseSummary(answer.status, answer.body);
  } catch {
    return null;
  }
}

// ── Product editing (TAP-T17) ────────────────────────────────────────────────
// None of these checks WHO is asking beyond "a brand session": the role rule
// lives in the server actions that call them (app/(brand)/products/actions.ts).
// None of them throws: a failure is a null or a false the caller turns into
// plain words.

/** One of the signed-in brand's products, or null (also for another brand's id). */
export async function getBrandProduct(
  session: BrandSession,
  productId: string,
): Promise<ProductDetail | null> {
  const id = parseProductId(productId);
  if (id === null) return null;
  try {
    const answer = await brandFetch(session, `/api/v1/admin/templates/${id}`);
    return parseProductDetail(answer.status, answer.body, id, session.brandId);
  } catch {
    return null;
  }
}

/** Create a draft product for the signed-in brand. Its id, or null. */
export async function createBrandProduct(
  session: BrandSession,
  body: ProductBody,
): Promise<string | null> {
  try {
    const answer = await brandFetch(session, "/api/v1/admin/templates", { method: "POST", body });
    return parseCreatedProduct(answer.status, answer.body, session.brandId);
  } catch {
    return null;
  }
}

/** Save an edit. `attributes` is sent only when the photo changed. */
export async function updateBrandProduct(
  session: BrandSession,
  productId: string,
  body: ProductBody & { attributes?: Array<{ trait_type: string; value: string }> },
): Promise<boolean> {
  const id = parseProductId(productId);
  if (id === null) return false;
  try {
    const answer = await brandFetch(session, `/api/v1/admin/templates/${id}`, {
      method: "PUT",
      body,
    });
    return answer.status === 200 && (answer.body as { ok?: unknown } | null)?.ok === true;
  } catch {
    return false;
  }
}

/** Publish the product: its saved state becomes the live one. */
export async function publishBrandProduct(
  session: BrandSession,
  productId: string,
): Promise<boolean> {
  const id = parseProductId(productId);
  if (id === null) return false;
  try {
    const answer = await brandFetch(session, `/api/v1/admin/templates/${id}/publish`, {
      method: "POST",
      body: {},
    });
    return answer.status === 201 && (answer.body as { ok?: unknown } | null)?.ok === true;
  } catch {
    return false;
  }
}

/** Store a photo in our media storage. Its address, or null. */
export async function uploadBrandPhoto(session: BrandSession, file: Blob): Promise<string | null> {
  try {
    const answer = await brandFetch(session, "/api/v1/media", { method: "POST", file });
    return parseUploadedPhoto(answer.status, answer.body);
  } catch {
    return null;
  }
}

/**
 * One page of the items of one of the signed-in brand's products. Never
 * throws. `after` is where the page starts (from the previous page's `next`).
 * The caller loads the product itself first ({@link getBrandProduct}), which
 * is refused for another brand's product.
 */
export async function getBrandProductItems(
  session: BrandSession,
  productId: string,
  after: string | null,
): Promise<ItemPage> {
  const id = parseProductId(productId);
  if (id === null) return parseItems(0, null, productId);
  // A position that is not plain digits is dropped, not sent.
  const cursor = parseCursor(after);
  const query = `limit=${ITEMS_PER_PAGE}${cursor !== null ? `&cursor=${cursor}` : ""}`;
  try {
    const answer = await brandFetch(session, `/api/v1/admin/templates/${id}/items?${query}`);
    return parseItems(answer.status, answer.body, id);
  } catch {
    return parseItems(0, null, id);
  }
}

// ── Making items (TAP-T17) ───────────────────────────────────────────────────
// Like product editing: the role rule lives in the server actions
// (app/(brand)/products/[id]/make/actions.ts), and none of these throws.

/**
 * Set up a run of `quantity` items of one of the signed-in brand's products.
 * Nothing is made yet. The run's id, or null. tagit-services refuses a
 * product of another brand and one that is not published.
 */
export async function createBrandRun(
  session: BrandSession,
  productId: string,
  quantity: number,
  facts: RunFacts | null = null,
): Promise<string | null> {
  const id = parseProductId(productId);
  if (id === null || parseQuantity(String(quantity)) !== quantity) return null;
  try {
    const answer = await brandFetch(session, "/api/v1/admin/batches", {
      method: "POST",
      body: bodyForRun(id, quantity, facts),
    });
    return parseCreatedRun(answer.status, answer.body, id, quantity);
  } catch {
    return null;
  }
}

/** The runs of one of the signed-in brand's products, newest first, or null. */
export async function getBrandRuns(
  session: BrandSession,
  productId: string,
): Promise<RunSummary[] | null> {
  const id = parseProductId(productId);
  if (id === null) return null;
  try {
    const answer = await brandFetch(
      session,
      `/api/v1/admin/batches?templateId=${id}&limit=${RUNS_SHOWN}`,
    );
    return parseRuns(answer.status, answer.body, id, dayWords);
  } catch {
    return null;
  }
}

/** One run of one of the signed-in brand's products, or null. */
export async function getBrandRun(
  session: BrandSession,
  productId: string,
  runId: string,
): Promise<ItemRun | null> {
  const product = parseProductId(productId);
  const run = parseRunId(runId);
  if (product === null || run === null) return null;
  try {
    const answer = await brandFetch(session, `/api/v1/admin/batches/${run}`);
    return parseRun(answer.status, answer.body, run, product);
  } catch {
    return null;
  }
}

/**
 * Start a run: its items are made. NOTHING is sent with the request; where
 * the items go is decided by tagit-services from the brand's record. Starting
 * a run twice makes nothing more.
 */
export async function startBrandRun(session: BrandSession, runId: string): Promise<StartResult> {
  const run = parseRunId(runId);
  if (run === null) return { kind: "failed" };
  try {
    const answer = await brandFetch(session, `/api/v1/admin/batches/${run}/execute`, {
      method: "POST",
      body: {},
    });
    return parseStart(answer.status, answer.body, run);
  } catch {
    return { kind: "failed" };
  }
}

// ── Selling (TAP-T17) ────────────────────────────────────────────────────────

/**
 * Put one of the signed-in brand's items on sale, change its price or take
 * it off. Only an action and a price are sent; the API pays the brand's own
 * sale wallet and refuses an item that is not the brand's to sell. Never
 * throws. The role rule lives in the server actions.
 */
export async function setBrandItemSale(
  session: BrandSession,
  itemNumber: string,
  intent: SaleIntent,
  price: string | null,
): Promise<SaleResult> {
  const number = parseItemNumber(itemNumber);
  const body = saleBody(intent, price);
  if (number === null || body === null) return { kind: "failed" };
  try {
    const answer = await brandFetch(session, `/api/v1/assets/${number}/price`, {
      method: "PUT",
      body,
    });
    return parseSaleAnswer(answer.status, answer.body, number, intent);
  } catch {
    return { kind: "failed" };
  }
}

// ── Team (TAP-T17) ───────────────────────────────────────────────────────────
// The role rule lives in the server actions (app/(brand)/team/actions.ts) and
// again in tagit-services, on the roster. None of these throws. None of them
// sends a brand in the body: the person joins the brand the session acts for.

/** The signed-in brand's team, or null when it could not be read. */
export async function getBrandTeam(session: BrandSession): Promise<TeamMember[] | null> {
  try {
    const answer = await brandFetch(session, "/api/v1/admin/users");
    return parseTeam(answer.status, answer.body, session.brandId);
  } catch {
    return null;
  }
}

export async function addBrandTeamMember(
  session: BrandSession,
  rawEmail: string,
  rawRole: string,
): Promise<TeamResult> {
  const email = parseTeamEmail(rawEmail);
  const role = parseTeamRole(rawRole);
  if (email === null || role === null) return { kind: "failed" };
  try {
    const answer = await brandFetch(session, "/api/v1/admin/users", {
      method: "POST",
      body: { email, role },
    });
    return parseTeamAnswer(answer.status, answer.body, "add", email, session.brandId, role);
  } catch {
    return { kind: "failed" };
  }
}

export async function changeBrandTeamRole(
  session: BrandSession,
  rawEmail: string,
  rawRole: string,
): Promise<TeamResult> {
  const email = parseTeamEmail(rawEmail);
  const role = parseTeamRole(rawRole);
  if (email === null || role === null) return { kind: "failed" };
  try {
    const answer = await brandFetch(session, `/api/v1/admin/users/${encodeURIComponent(email)}`, {
      method: "PUT",
      body: { role },
    });
    return parseTeamAnswer(answer.status, answer.body, "change", email, session.brandId, role);
  } catch {
    return { kind: "failed" };
  }
}

export async function removeBrandTeamMember(
  session: BrandSession,
  rawEmail: string,
): Promise<TeamResult> {
  const email = parseTeamEmail(rawEmail);
  if (email === null) return { kind: "failed" };
  try {
    const answer = await brandFetch(session, `/api/v1/admin/users/${encodeURIComponent(email)}`, {
      method: "DELETE",
    });
    return parseTeamAnswer(answer.status, answer.body, "remove", email, session.brandId, null);
  } catch {
    return { kind: "failed" };
  }
}
