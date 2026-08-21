import type { CatalogRole } from "@/lib/catalog/template-logic";

/**
 * Role half of the REQ-S-16 actor seam (see lib/actor.ts). META-T32 owns the
 * admin session + role model; on this base there is no session, so the role
 * resolves null and `canMutateCatalog(null)` keeps writes enabled (the
 * server-side API keys remain the only credential). When T32 lands, this
 * becomes the single place that maps the session onto a CatalogRole — the
 * mutating catalog proxies and the editor UI both already consume it.
 */
export async function getActorRole(): Promise<CatalogRole | null> {
  return null;
}
