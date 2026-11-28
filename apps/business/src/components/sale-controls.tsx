"use client";

import { useActionState, useState } from "react";
import { Button, Input, Label } from "@tagit/ui";

import { sellItem, sellReadyItems, type SellState } from "@/app/(brand)/products/sell-actions";

const NOTHING: SellState = { problem: null };

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="text-sm text-red-700">
      {text}
    </p>
  ) : null;
}

/** Every ready item on the page, at one price. */
export function SellReadyForm({
  productId,
  after,
  count,
  defaultPrice,
}: {
  productId: string;
  after: string | null;
  count: number;
  defaultPrice: string;
}) {
  const [state, action, pending] = useActionState(sellReadyItems, NOTHING);
  // Kept in the component, so a refused price stays in the field to be fixed.
  const [price, setPrice] = useState(defaultPrice);
  const items = `${count} ${count === 1 ? "item" : "items"}`;
  return (
    <form action={action} className="space-y-3 rounded-xl border p-5">
      <input type="hidden" name="productId" value={productId} />
      {after !== null ? <input type="hidden" name="after" value={after} /> : null}
      <h2 className="font-semibold">
        {items} on this page {count === 1 ? "is" : "are"} ready for sale
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bulk-price">Price each, in US dollars</Label>
          <Input
            id="bulk-price"
            name="price"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="decimal"
            maxLength={10}
            required
            autoComplete="off"
            className="max-w-32"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Putting on sale…" : `Put ${items} on sale`}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Shoppers can buy them straight away. Payment goes to your brand.
      </p>
      <Problem text={state.problem} />
    </form>
  );
}

/** One item: put on sale, or change its price or take it off. */
export function ItemSaleForm({
  productId,
  after,
  item,
  onSale,
  defaultPrice,
}: {
  productId: string;
  after: string | null;
  item: string;
  onSale: boolean;
  defaultPrice: string;
}) {
  const [state, action, pending] = useActionState(sellItem, NOTHING);
  const [price, setPrice] = useState(defaultPrice);
  // Open while there is something to read: a refusal must not fold away.
  const [open, setOpen] = useState(false);
  const priceId = `price-${item}`;
  return (
    <details
      className="w-full text-sm"
      open={open || state.problem !== null}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer underline">
        {onSale ? "Change price or take off sale" : "Put on sale"}
      </summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="item" value={item} />
        {after !== null ? <input type="hidden" name="after" value={after} /> : null}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={priceId}>Price, in US dollars</Label>
            <Input
              id={priceId}
              name="price"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              inputMode="decimal"
              maxLength={10}
              autoComplete="off"
              className="max-w-32"
            />
          </div>
          <Button
            type="submit"
            name="intent"
            value={onSale ? "reprice" : "list"}
            disabled={pending}
          >
            {onSale ? "Change price" : "Put on sale"}
          </Button>
          {onSale ? (
            <Button type="submit" name="intent" value="delist" variant="outline" disabled={pending}>
              Take off sale
            </Button>
          ) : null}
        </div>
        <Problem text={state.problem} />
      </form>
    </details>
  );
}
