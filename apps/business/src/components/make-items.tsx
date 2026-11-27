"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@tagit/ui";

import { prepareItems, startItems, type MakeState } from "@/app/(brand)/products/make-actions";

const NOTHING: MakeState = { problem: null };

/** Step 1: how many. Sets a run up; nothing is made yet. */
export function QuantityForm({ productId, max }: { productId: string; max: number }) {
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
