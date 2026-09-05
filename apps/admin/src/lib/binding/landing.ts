import { BATCH_ID_RE, parseBatchTokens } from "./station";

/**
 * Binding-station landing page logic (pure — unit-tested). Turns the
 * services batch list + per-batch status DTOs into "what still needs a chip"
 * so an operator can find the station without navigating template → batch →
 * bind by hand.
 */

export interface BatchListRow {
  id: string;
  templateId: string | null;
  size: number;
  state: string;
  createdAt: string;
}

/** Parse GET /api/v1/admin/batches ({ok, batches:[…]}) keeping templateId. */
export function parseBatchListRows(body: unknown): BatchListRow[] | null {
  if (typeof body !== "object" || body === null) return null;
  const env = body as { ok?: unknown; batches?: unknown };
  if (env.ok !== true || !Array.isArray(env.batches)) return null;
  const rows: BatchListRow[] = [];
  for (const raw of env.batches) {
    if (typeof raw !== "object" || raw === null) continue;
    const b = raw as Record<string, unknown>;
    if (typeof b.id !== "string" || !BATCH_ID_RE.test(b.id)) continue;
    if (typeof b.state !== "string") continue;
    const size =
      typeof b.quantity === "number" && Number.isFinite(b.quantity)
        ? b.quantity
        : typeof b.size === "number" && Number.isFinite(b.size)
          ? b.size
          : null;
    if (size === null) continue;
    rows.push({
      id: b.id,
      templateId: typeof b.templateId === "string" ? b.templateId : null,
      size,
      state: b.state,
      createdAt: typeof b.createdAt === "string" ? b.createdAt : "",
    });
  }
  return rows;
}

/** Parse GET /api/v1/admin/templates ({ok, templates:[{id,name}]}) → id → name. */
export function parseTemplateNames(body: unknown): Map<string, string> {
  const out = new Map<string, string>();
  const env = body as { templates?: unknown } | null;
  if (!env || !Array.isArray(env.templates)) return out;
  for (const raw of env.templates) {
    const t = raw as { id?: unknown; name?: unknown };
    if (typeof t?.id === "string" && typeof t?.name === "string") out.set(t.id, t.name);
  }
  return out;
}

export interface BatchStationSummary extends BatchListRow {
  templateName: string | null;
  /** Tokens still MINTED — waiting for a chip. */
  unbound: number;
  /** Tokens bound or anchored. */
  bound: number;
  recycled: number;
  /** Minted so far (the batch may still be minting). */
  total: number;
  /** Status DTO could not be read — counts unknown. */
  unknown: boolean;
}

/** Fold the batch-status DTO (GET /admin/batches/:id) into station counts. */
export function summarizeBatch(
  row: BatchListRow,
  statusBody: unknown,
  templateName: string | null,
): BatchStationSummary {
  const tokens = parseBatchTokens(statusBody);
  if (tokens === null) {
    return { ...row, templateName, unbound: 0, bound: 0, recycled: 0, total: 0, unknown: true };
  }
  let unbound = 0;
  let bound = 0;
  let recycled = 0;
  for (const t of tokens) {
    if (t.lifecycle === "minted") unbound++;
    else if (t.lifecycle === "recycled") recycled++;
    else bound++;
  }
  return { ...row, templateName, unbound, bound, recycled, total: tokens.length, unknown: false };
}

/** Batches that still need chips first (most unbound on top), then newest. */
export function sortForStation(list: BatchStationSummary[]): BatchStationSummary[] {
  return [...list].sort((a, b) => {
    const aOpen = a.unbound > 0 ? 1 : 0;
    const bOpen = b.unbound > 0 ? 1 : 0;
    if (aOpen !== bOpen) return bOpen - aOpen;
    if (a.unbound !== b.unbound) return b.unbound - a.unbound;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function stationHref(templateId: string, batchId: string): string {
  return `/catalog/${encodeURIComponent(templateId)}/batch/bind?batch=${encodeURIComponent(batchId)}`;
}

export function batchWizardHref(templateId: string, batchId: string): string {
  return `/catalog/${encodeURIComponent(templateId)}/batch?batch=${encodeURIComponent(batchId)}`;
}
