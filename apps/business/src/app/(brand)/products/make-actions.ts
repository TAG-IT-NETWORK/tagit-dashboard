"use server";

import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/lib/access";
import {
  canMakeItems,
  MAX_ITEMS_PER_RUN,
  parseQuantity,
  parseRunFacts,
  parseRunId,
  takesRunFacts,
  type RunFactField,
  startProblem,
} from "@/lib/brand-make-items";
import { parseProductId } from "@/lib/brand-product-form";
import { loadBrand } from "@/lib/brand-request";
import { createBrandRun, getBrandProduct, getBrandRun, startBrandRun } from "@/lib/brand-services";

/**
 * Making items (TAP-T17). SERVER ONLY. Items cannot be un-made, so it takes
 * two actions: set a run up, then start it.
 *
 * Every action, before anything else:
 *   1. reads the session on the server. No brand session → sign in.
 *   2. checks the role: a Manager, nobody else. The pages hide the buttons
 *      from others too, but this is the check that counts.
 *   3. takes the brand from the session and nothing else. The product is
 *      loaded under that brand first; a run is used only when tagit-services
 *      files it under that product.
 *
 * Nothing the browser sends reaches tagit-services except a checked product
 * id, a checked run id and a number from 1 to 100.
 */

export interface MakeState {
  problem: string | null;
  /** Problems with the lot and dates, by field. */
  errors?: Partial<Record<RunFactField, string>>;
}

const MANAGERS_ONLY = "Only a Manager of your brand can make items.";
const NOT_PUBLISHED = "This product has to be published before items can be made.";

export async function prepareItems(_previous: MakeState, formData: FormData): Promise<MakeState> {
  const brand = await loadBrand();
  if (brand === null) redirect(SIGN_IN_PATH);
  const { session } = brand;
  if (!canMakeItems(session.role)) return { problem: MANAGERS_ONLY };

  const quantity = parseQuantity(formData.get("quantity"));
  if (quantity === null) {
    return { problem: `Enter a whole number from 1 to ${MAX_ITEMS_PER_RUN}.` };
  }
  const productId = parseProductId(formData.get("productId"));
  const product = productId !== null ? await getBrandProduct(session, productId) : null;
  if (product === null) return { problem: "This product could not be found." };
  if (product.state !== "live" && product.state !== "live-with-changes") {
    return { problem: NOT_PUBLISHED };
  }

  // Lot and dates: only for a product whose category takes them. For any
  // other product whatever the form sent is ignored, not passed on.
  let facts = null;
  if (takesRunFacts(product.values.category)) {
    const parsed = parseRunFacts((field) => formData.get(field));
    if (!parsed.ok) return { problem: null, errors: parsed.errors };
    facts = parsed.facts;
  }

  const runId = await createBrandRun(session, product.id, quantity, facts);
  if (runId === null) {
    return {
      problem: "That could not be set up just now. Nothing was made. Try again in a moment.",
    };
  }
  redirect(`/products/${product.id}/make/${runId}`);
}

export async function startItems(_previous: MakeState, formData: FormData): Promise<MakeState> {
  const brand = await loadBrand();
  if (brand === null) redirect(SIGN_IN_PATH);
  const { session } = brand;
  if (!canMakeItems(session.role)) return { problem: MANAGERS_ONLY };

  const productId = parseProductId(formData.get("productId"));
  const runId = parseRunId(formData.get("runId"));
  const product = productId !== null ? await getBrandProduct(session, productId) : null;
  // The run must be filed under this product, which is this brand's.
  const run =
    product !== null && runId !== null ? await getBrandRun(session, product.id, runId) : null;
  if (product === null || run === null) return { problem: "This run could not be found." };

  // Already going or done: there is nothing to start. Show how it stands.
  if (run.state === "waiting" || run.state === "failed") {
    const result = await startBrandRun(session, run.id);
    if (result.kind !== "started") return { problem: startProblem(result, run.size) };
  }
  redirect(`/products/${product.id}/make/${run.id}`);
}
