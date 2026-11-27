import { hasRole, type Role } from "@/lib/access";

/**
 * A brand's product as its own people edit it (TAP-T17, brand editing).
 * PURE: no fetch, no session, so every rule here is unit-tested.
 *
 * Three rules everything else leans on:
 * - what a person may do comes from their role, decided on the server
 *   ({@link canEditProducts}, {@link canPublishProducts});
 * - what is sent to tagit-services is BUILT here from named fields. Nothing
 *   the browser sends is passed through, so a form cannot add a field;
 * - a product read back is shown only when it carries this brand's id.
 */

// ── Who may do what ──────────────────────────────────────────────────────────

/** Create and edit: Editors and Managers. */
export function canEditProducts(role: Role | null): boolean {
  return hasRole(role, "operator");
}

/** Publish, which makes a product live: Managers only. */
export function canPublishProducts(role: Role | null): boolean {
  return hasRole(role, "admin");
}

// ── Ids and addresses ────────────────────────────────────────────────────────

const PRODUCT_ID_RE = /^tpl_[0-9A-Za-z]{1,64}$/;

/** A product id exactly as tagit-services makes them, or null. */
export function parseProductId(value: unknown): string | null {
  return typeof value === "string" && PRODUCT_ID_RE.test(value) ? value : null;
}

const OUR_PHOTO_RE =
  /^https:\/\/media\.tagit\.network\/i\/[0-9a-f]{64}\/(?:orig|lg|md|sm|t)\.webp$/;

/** True for a photo address of our own media storage, and nothing else. */
export function isOurPhotoUrl(value: unknown): value is string {
  return typeof value === "string" && OUR_PHOTO_RE.test(value);
}

// ── The form ─────────────────────────────────────────────────────────────────

export const PRODUCT_FIELDS = [
  "name",
  "model",
  "sku",
  "category",
  "origin",
  "description",
  "price",
] as const;
export type ProductField = (typeof PRODUCT_FIELDS)[number];
export type ProductValues = Record<ProductField, string>;

export const FIELD_LABELS: Record<ProductField, string> = {
  name: "Name",
  model: "Model",
  sku: "SKU",
  category: "Category",
  origin: "Country of origin",
  description: "Description",
  price: "Price",
};

const MAX_LENGTH: Record<ProductField, number> = {
  name: 200,
  model: 200,
  sku: 200,
  category: 200,
  origin: 200,
  description: 5000,
  price: 13,
};

export const EMPTY_PRODUCT: ProductValues = {
  name: "",
  model: "",
  sku: "",
  category: "",
  origin: "",
  description: "",
  price: "",
};

/**
 * What is sent to tagit-services for a create or an edit. Exactly these keys.
 * `brand` and `priceUsdc6` are left out of an edit that does not change them,
 * so what is stored stays exactly as it was ({@link bodyForEdit}).
 */
export interface ProductBody {
  name: string;
  brand?: string;
  model: string | null;
  sku: string | null;
  category: string | null;
  origin: string | null;
  description: string | null;
  priceUsdc6?: string | null;
}

export type FormResult =
  | { ok: true; values: ProductValues; body: ProductBody }
  | { ok: false; values: ProductValues; errors: Partial<Record<ProductField, string>> };

/** Characters that have no place in a product's text (tabs and line breaks are fine in a description). */
function hasControlCharacters(text: string, allowBreaks: boolean): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x7f) return true;
    if (code < 0x20) {
      if (allowBreaks && (code === 0x0a || code === 0x0d || code === 0x09)) continue;
      return true;
    }
  }
  return false;
}

/** "22.5" → "22.50". Dollars and at most two decimals, more than zero. */
export function parsePrice(text: string): string | null {
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, cents = ""] = text.split(".");
  const normalized = `${String(BigInt(whole!))}.${cents.padEnd(2, "0")}`;
  return normalized === "0.00" ? null : normalized;
}

/**
 * Read a submitted form. `get` returns the raw value of a field (a FormData
 * getter in production). Anything that is not text reads as empty. The
 * brand's name is NOT part of the form: the server adds it
 * ({@link bodyForCreate}, {@link bodyForEdit}).
 */
export function parseProductForm(get: (field: ProductField) => unknown): FormResult {
  const values = { ...EMPTY_PRODUCT };
  const errors: Partial<Record<ProductField, string>> = {};

  for (const field of PRODUCT_FIELDS) {
    const raw = get(field);
    const text = typeof raw === "string" ? raw.trim() : "";
    // Kept short even when refused, so an error page never echoes megabytes.
    values[field] = text.slice(0, MAX_LENGTH[field] + 1);
    if (text.length > MAX_LENGTH[field]) {
      errors[field] =
        `${FIELD_LABELS[field]} is too long (${MAX_LENGTH[field].toLocaleString("en-US")} characters at most).`;
    } else if (hasControlCharacters(text, field === "description")) {
      errors[field] = `${FIELD_LABELS[field]} has characters that cannot be used.`;
    }
  }

  if (values.name.length === 0) errors.name = "Give the product a name.";

  let price: string | null = null;
  if (values.price.length > 0 && errors.price === undefined) {
    price = parsePrice(values.price);
    if (price === null) {
      errors.price = "Enter a price in dollars, like 29.99. Leave it empty for no price.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, values, errors };

  const orNull = (text: string) => (text.length > 0 ? text : null);
  return {
    ok: true,
    values,
    body: {
      name: values.name,
      model: orNull(values.model),
      sku: orNull(values.sku),
      category: orNull(values.category),
      origin: orNull(values.origin),
      description: orNull(values.description),
      priceUsdc6: price,
    },
  };
}

/** A new product carries the brand's real name, read from its record on the server. */
export function bodyForCreate(body: ProductBody, brandName: string): ProductBody {
  return { ...body, brand: brandName };
}

/**
 * An edit changes only what the person changed:
 * - the price is sent only when the form's price differs from the one the
 *   form was given. A stored price can be finer than the form shows (six
 *   decimals against two); sending it back unchanged would round it.
 * - the brand name is never overwritten. It is filled in only when the
 *   product has none and the brand's real name is known.
 */
export function bodyForEdit(
  body: ProductBody,
  submitted: ProductValues,
  stored: Pick<ProductDetail, "values" | "hasBrandName">,
  brandName: string | null,
): ProductBody {
  const rest: ProductBody = { ...body };
  delete rest.priceUsdc6;
  delete rest.brand;
  return {
    ...rest,
    ...(submitted.price !== stored.values.price ? { priceUsdc6: body.priceUsdc6 ?? null } : {}),
    ...(!stored.hasBrandName && brandName !== null ? { brand: brandName } : {}),
  };
}

// ── The photo ────────────────────────────────────────────────────────────────

export const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
/** The hosting platform refuses a request body above 4.5 MB. */
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

/** Why a chosen file cannot be a product photo, or null when it can. */
export function photoProblem(file: { type: string; size: number }): string | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return "Use a PNG, JPG or WebP image.";
  }
  if (file.size > PHOTO_MAX_BYTES) return "That image is too large. Use one under 4 MB.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

/** The large copy of a photo tagit-services just stored, or null. Only ever our own address. */
export function parseUploadedPhoto(status: number, body: unknown): string | null {
  if ((status !== 200 && status !== 201) || typeof body !== "object" || body === null) return null;
  const answer = body as { ok?: unknown; media?: unknown };
  if (answer.ok !== true || !Array.isArray(answer.media) || answer.media.length !== 1) return null;
  const first = answer.media[0] as { urls?: { lg?: unknown } } | null;
  const url = first?.urls?.lg;
  return isOurPhotoUrl(url) ? url : null;
}

const HERO = "media:hero";

interface Attribute {
  trait_type: string;
  value: string;
}

function isAttribute(value: unknown): value is Attribute {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.trait_type === "string" && typeof row.value === "string";
}

/** A product's attribute rows as stored, dropping anything malformed. */
export function readAttributes(value: unknown): Attribute[] {
  return Array.isArray(value)
    ? value.filter(isAttribute).map((a) => ({ trait_type: a.trait_type, value: a.value }))
    : [];
}

/** The product's main photo, when it is one of ours. */
export function heroPhoto(attributes: readonly Attribute[]): string | null {
  const row = attributes.find((a) => a.trait_type === HERO);
  return row && isOurPhotoUrl(row.value) ? row.value : null;
}

/**
 * The attribute rows with the main photo set to `url`. Every other row is
 * kept exactly as it was: the form does not know them and must not lose them.
 */
export function withHeroPhoto(attributes: readonly Attribute[], url: string): Attribute[] {
  return [{ trait_type: HERO, value: url }, ...attributes.filter((a) => a.trait_type !== HERO)];
}

// ── A product read back ──────────────────────────────────────────────────────

export type ProductState = "draft" | "live" | "live-with-changes" | "archived";

export interface ProductDetail {
  id: string;
  values: ProductValues;
  state: ProductState;
  photoUrl: string | null;
  /** Whether the product already carries a brand name (needed to publish). */
  hasBrandName: boolean;
  /** Kept for a later save: see {@link withHeroPhoto}. */
  attributes: Attribute[];
  /** What a publish still needs, in plain words. Empty when complete. */
  missing: string[];
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Millionths of a dollar ("29990000") as the form shows a price ("29.99"). */
export function priceForForm(value: unknown): string {
  if (typeof value !== "string" || !/^\d{1,18}$/.test(value)) return "";
  const minor = BigInt(value);
  if (minor === 0n) return "";
  const cents = (minor + 5_000n) / 10_000n;
  // Less than half a cent shows as no price; an untouched form leaves it stored.
  if (cents === 0n) return "";
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

function productState(status: unknown, version: unknown): ProductState | null {
  const published = typeof version === "number" && Number.isInteger(version) && version > 0;
  if (status === "archived") return "archived";
  if (status === "published") return "live";
  // An edit of a live product sits in a working copy until it is published.
  if (status === "draft") return published ? "live-with-changes" : "draft";
  return null;
}

/** What a product still needs before it can be published. */
export function missingParts(values: ProductValues, photoUrl: string | null): string[] {
  const missing: string[] = [];
  for (const field of ["name", "model", "sku", "category", "origin", "description"] as const) {
    if (values[field].length === 0) missing.push(FIELD_LABELS[field].toLowerCase());
  }
  if (photoUrl === null) missing.push("a photo");
  return missing;
}

/**
 * One product as tagit-services returned it, or null. Null also when the
 * answer is about another product or another brand, whatever it says.
 */
export function parseProductDetail(
  status: number,
  body: unknown,
  productId: string,
  brandId: string,
): ProductDetail | null {
  if (status !== 200 || typeof body !== "object" || body === null) return null;
  const answer = body as { ok?: unknown; template?: unknown };
  if (answer.ok !== true || typeof answer.template !== "object" || answer.template === null) {
    return null;
  }
  const row = answer.template as Record<string, unknown>;
  if (row.id !== productId || row.businessId !== brandId) return null;
  const state = productState(row.status, row.version);
  if (state === null) return null;

  const values: ProductValues = {
    name: text(row.name, MAX_LENGTH.name),
    model: text(row.model, MAX_LENGTH.model),
    sku: text(row.sku, MAX_LENGTH.sku),
    category: text(row.category, MAX_LENGTH.category),
    origin: text(row.origin, MAX_LENGTH.origin),
    description: text(row.description, MAX_LENGTH.description),
    price: priceForForm(row.priceUsdc6),
  };
  if (values.name.length === 0) return null;
  const attributes = readAttributes(row.attributes);
  const photoUrl = heroPhoto(attributes);
  return {
    id: productId,
    values,
    state,
    photoUrl,
    hasBrandName: text(row.brand, 200).length > 0,
    attributes,
    missing: missingParts(values, photoUrl),
  };
}

/** The id of a product tagit-services just created for this brand, or null. */
export function parseCreatedProduct(status: number, body: unknown, brandId: string): string | null {
  if (status !== 201 || typeof body !== "object" || body === null) return null;
  const answer = body as { ok?: unknown; template?: { id?: unknown; businessId?: unknown } };
  if (answer.ok !== true || answer.template?.businessId !== brandId) return null;
  return parseProductId(answer.template.id);
}

export function stateWords(state: ProductState): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "live":
      return "Live";
    case "live-with-changes":
      return "Live, with changes not yet published";
    default:
      return "Archived";
  }
}

/** "name, a photo" → "name and a photo". */
export function listWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}
