"use client";

import { useActionState } from "react";
import { Button, Input, Label } from "@tagit/ui";

import {
  publishProduct,
  saveProduct,
  type ProductFormState,
  type PublishState,
} from "@/app/(brand)/products/actions";
import { FIELD_LABELS, type ProductField, type ProductValues } from "@/lib/brand-product-form";

const HINTS: Partial<Record<ProductField, string>> = {
  sku: "Your own stock code.",
  origin: "Where it is made, for example France.",
  price: "In US dollars, like 29.99. Leave empty for no price.",
};

function Field({
  field,
  value,
  error,
  required = false,
}: {
  field: ProductField;
  value: string;
  error?: string;
  required?: boolean;
}) {
  const hint = HINTS[field];
  const describedBy =
    [error ? `${field}-error` : null, hint ? `${field}-hint` : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={field}>
        {FIELD_LABELS[field]}
        {required ? null : field === "price" ? null : (
          <span className="font-normal text-muted-foreground"> · needed to publish</span>
        )}
      </Label>
      {field === "description" ? (
        <textarea
          id={field}
          name={field}
          defaultValue={value}
          rows={5}
          maxLength={5000}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      ) : (
        <Input
          id={field}
          name={field}
          defaultValue={value}
          required={required}
          maxLength={field === "price" ? 13 : 200}
          inputMode={field === "price" ? "decimal" : undefined}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      )}
      {hint ? (
        <p id={`${field}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${field}-error`} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Create or edit a product. `productId` is set when editing. */
export function ProductForm({
  productId,
  values,
  photoUrl,
}: {
  productId: string | null;
  values: ProductValues;
  photoUrl: string | null;
}) {
  const initial: ProductFormState = { values, errors: {}, problem: null };
  const [state, action, pending] = useActionState(saveProduct, initial);
  const v = state.values;
  const e = state.errors;

  return (
    <form action={action} className="space-y-5">
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}
      {state.problem ? (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"
        >
          {state.problem}
        </p>
      ) : null}

      <Field field="name" value={v.name} error={e.name} required />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field field="model" value={v.model} error={e.model} />
        <Field field="sku" value={v.sku} error={e.sku} />
        <Field field="category" value={v.category} error={e.category} />
        <Field field="origin" value={v.origin} error={e.origin} />
      </div>
      <Field field="description" value={v.description} error={e.description} />
      <div className="max-w-xs">
        <Field field="price" value={v.price} error={e.price} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="photo">
          Photo<span className="font-normal text-muted-foreground"> · needed to publish</span>
        </Label>
        {photoUrl ? (
          // The product's own photo, from our media storage (checked in lib/brand-product-form.ts).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt="Current product photo"
            referrerPolicy="no-referrer"
            className="h-32 w-32 rounded-lg border object-cover"
          />
        ) : null}
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-invalid={e.photo ? true : undefined}
          aria-describedby={e.photo ? "photo-error photo-hint" : "photo-hint"}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
        />
        <p id="photo-hint" className="text-xs text-muted-foreground">
          PNG, JPG or WebP, up to 4 MB.{photoUrl ? " Choose a file only to replace the photo." : ""}
        </p>
        {e.photo ? (
          <p id="photo-error" role="alert" className="text-sm text-red-700">
            {e.photo}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : productId ? "Save changes" : "Create product"}
        </Button>
        <a href={productId ? `/products/${productId}` : "/products"} className="text-sm underline">
          Cancel
        </a>
      </div>
    </form>
  );
}

/** The Publish button with its own answer line. Shown to Managers only. */
export function PublishButton({ productId, label }: { productId: string; label: string }) {
  const initial: PublishState = { problem: null };
  const [state, action, pending] = useActionState(publishProduct, initial);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Publishing…" : label}
      </Button>
      {state.problem ? (
        <p role="alert" className="text-sm text-red-700">
          {state.problem}
        </p>
      ) : null}
    </form>
  );
}
