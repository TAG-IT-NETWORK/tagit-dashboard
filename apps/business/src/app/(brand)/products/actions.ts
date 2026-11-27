"use server";

import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/lib/access";
import { loadBrand } from "@/lib/brand-request";
import {
  canEditProducts,
  canPublishProducts,
  listWords,
  parseProductForm,
  parseProductId,
  photoProblem,
  withHeroPhoto,
  type ProductField,
  type ProductValues,
} from "@/lib/brand-product-form";
import {
  createBrandProduct,
  getBrandProduct,
  publishBrandProduct,
  updateBrandProduct,
  uploadBrandPhoto,
} from "@/lib/brand-services";

/**
 * The writes of the brand app (TAP-T17, brand editing). SERVER ONLY.
 *
 * Every action, before anything else:
 *   1. reads the session on the server. No brand session → sign in.
 *   2. checks the role. Saving needs an Editor, publishing a Manager. The
 *      buttons are hidden for others too, but this is the check that counts:
 *      an action can be called without its button.
 *   3. takes the brand from the session and nothing else. The product id
 *      comes from the form, and tagit-services answers "not found" for an id
 *      of another brand.
 *
 * Next refuses a server action posted from another site.
 */

export interface ProductFormState {
  values: ProductValues;
  errors: Partial<Record<ProductField | "photo", string>>;
  /** A problem that is not about one field. */
  problem: string | null;
}

export interface PublishState {
  problem: string | null;
}

const NOT_ALLOWED = "Your account can view products but not change them.";
const NOT_SAVED = "That could not be saved just now. Nothing was changed. Try again in a moment.";

/** A real, non-empty file from the form, or null. */
function chosenPhoto(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

export async function saveProduct(
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const brand = await loadBrand();
  if (brand === null) redirect(SIGN_IN_PATH);
  const { session, profile } = brand;

  const form = parseProductForm((field) => formData.get(field), profile.name);
  if (!canEditProducts(session.role)) {
    return { values: form.values, errors: {}, problem: NOT_ALLOWED };
  }
  if (!form.ok) return { values: form.values, errors: form.errors, problem: null };

  const photo = chosenPhoto(formData.get("photo"));
  if (photo !== null) {
    const problem = photoProblem(photo);
    if (problem !== null) return { values: form.values, errors: { photo: problem }, problem: null };
  }

  // An id in the form means "edit this one"; none means "a new product".
  const rawId = formData.get("productId");
  const editing = rawId !== null && rawId !== "";
  const productId = editing ? parseProductId(rawId) : null;
  // The product must be this brand's and still editable BEFORE a photo is stored.
  const current = productId !== null ? await getBrandProduct(session, productId) : null;
  if (editing && (current === null || current.state === "archived")) {
    return { values: form.values, errors: {}, problem: "This product cannot be edited." };
  }

  let photoUrl: string | null = null;
  if (photo !== null) {
    photoUrl = await uploadBrandPhoto(session, photo);
    if (photoUrl === null) {
      return {
        values: form.values,
        errors: { photo: "That image could not be stored. Try another one." },
        problem: null,
      };
    }
  }

  let savedId: string;
  if (current !== null) {
    const saved = await updateBrandProduct(session, current.id, {
      ...form.body,
      // Sent only when the photo changed; every other stored row is kept.
      ...(photoUrl !== null ? { attributes: withHeroPhoto(current.attributes, photoUrl) } : {}),
    });
    if (!saved) return { values: form.values, errors: {}, problem: NOT_SAVED };
    savedId = current.id;
  } else {
    const createdId = await createBrandProduct(session, form.body);
    if (createdId === null) return { values: form.values, errors: {}, problem: NOT_SAVED };
    if (photoUrl !== null) {
      const withPhoto = await updateBrandProduct(session, createdId, {
        ...form.body,
        attributes: withHeroPhoto([], photoUrl),
      });
      // The product exists; only its photo did not attach. Say so on its page.
      if (!withPhoto) redirect(`/products/${createdId}?saved=no-photo`);
    }
    savedId = createdId;
  }
  redirect(`/products/${savedId}?saved=1`);
}

export async function publishProduct(
  _previous: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const brand = await loadBrand();
  if (brand === null) redirect(SIGN_IN_PATH);
  const { session } = brand;

  if (!canPublishProducts(session.role)) {
    return { problem: "Only a Manager of your brand can publish a product." };
  }
  const productId = parseProductId(formData.get("productId"));
  const current = productId !== null ? await getBrandProduct(session, productId) : null;
  if (current === null || current.state === "archived") {
    return { problem: "This product cannot be published." };
  }
  if (current.missing.length > 0) {
    return { problem: `Before publishing, add: ${listWords(current.missing)}.` };
  }
  if (!(await publishBrandProduct(session, current.id))) {
    return { problem: "That could not be published just now. Try again in a moment." };
  }
  redirect(`/products/${current.id}?saved=published`);
}
