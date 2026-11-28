"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@tagit/ui";

import { prepareItems, startItems, type MakeState } from "@/app/(brand)/products/make-actions";

const NOTHING: MakeState = { problem: null };

/** Step 1: how many. Sets a run up; nothing is made yet. */
export function QuantityForm({
  productId,
  max,
  withFacts = false,
}: {
  productId: string;
  max: number;
  /** Offer a lot and dates (products that take them). */
  withFacts?: boolean;
}) {
  const [state, action, pending] = useActionState(prepareItems, NOTHING);
  return (
    <form action={action} className="space-y-4 rounded-xl border p-5">
      <input type="hidden" name="productId" value={productId} />
      <div className="space-y-1.5">
        <Label htmlFor="quantity">How many items?</Label>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          step={1}
          required
          autoComplete="off"
          className="max-w-32"
          aria-describedby="quantity-hint"
        />
        <p id="quantity-hint" className="text-xs text-muted-foreground">
          From 1 to {max} at a time.
        </p>
      </div>
      {withFacts ? (
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">
            Lot and dates <span className="font-normal text-muted-foreground">· optional</span>
          </legend>
          <p className="text-xs text-muted-foreground">
            Shown to shoppers on each item of this run. They cannot be changed afterwards.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="lot">Lot</Label>
            <Input
              id="lot"
              name="lot"
              maxLength={60}
              autoComplete="off"
              className="max-w-xs"
              aria-invalid={state.errors?.lot ? true : undefined}
              aria-describedby={state.errors?.lot ? "lot-error" : undefined}
            />
            {state.errors?.lot ? (
              <p id="lot-error" role="alert" className="text-sm text-red-700">
                {state.errors.lot}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["madeOn", "Made on"],
                ["bestBefore", "Best before"],
              ] as const
            ).map(([field, label]) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={field}>{label}</Label>
                <Input
                  id={field}
                  name={field}
                  type="date"
                  min="2000-01-01"
                  max="2100-12-31"
                  aria-invalid={state.errors?.[field] ? true : undefined}
                  aria-describedby={state.errors?.[field] ? `${field}-error` : undefined}
                />
                {state.errors?.[field] ? (
                  <p id={`${field}-error`} role="alert" className="text-sm text-red-700">
                    {state.errors[field]}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </fieldset>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Setting up…" : "Continue"}
      </Button>
      {state.problem ? (
        <p role="alert" className="text-sm text-red-700">
          {state.problem}
        </p>
      ) : null}
    </form>
  );
}

/** Step 2: confirm. Starts the run, once. */
export function StartButton({
  productId,
  runId,
  label,
}: {
  productId: string;
  runId: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(startItems, NOTHING);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="runId" value={runId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Starting…" : label}
      </Button>
      {state.problem ? (
        <p role="alert" className="text-sm text-red-700">
          {state.problem}
        </p>
      ) : null}
    </form>
  );
}

const REFRESH_EVERY_MS = 4000;
const REFRESH_TIMES = 60;

/**
 * While items are being made the page asks again every few seconds, for a
 * few minutes, then stops and offers a button instead.
 */
export function WatchRun() {
  const router = useRouter();
  const [stopped, setStopped] = useState(false);
  useEffect(() => {
    let times = 0;
    const timer = setInterval(() => {
      times += 1;
      if (times > REFRESH_TIMES) {
        clearInterval(timer);
        setStopped(true);
        return;
      }
      router.refresh();
    }, REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, [router]);
  if (!stopped) return null;
  return (
    <Button type="button" variant="outline" onClick={() => router.refresh()}>
      Check again
    </Button>
  );
}
