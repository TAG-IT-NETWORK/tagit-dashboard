import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withinDeadline } from "../deadline";

describe("withinDeadline", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const after = <T>(ms: number, value: T) =>
    new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

  it("gives the value when it arrives in time", async () => {
    const result = withinDeadline(after(100, "reviews"), 600);
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe("reviews");
  });

  it("gives null when the value is late, and does not wait for it", async () => {
    let settled: string | null | undefined;
    void withinDeadline(after(900, "reviews"), 600).then((value) => (settled = value));
    await vi.advanceTimersByTimeAsync(599);
    expect(settled).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBeNull();
    // the late value changes nothing afterwards
    await vi.advanceTimersByTimeAsync(1000);
    expect(settled).toBeNull();
  });

  it("gives a value that is itself null as null, at once", async () => {
    const result = withinDeadline(Promise.resolve(null), 600);
    await vi.advanceTimersByTimeAsync(0);
    await expect(result).resolves.toBeNull();
  });

  it("treats a failure as not in time, and never rejects", async () => {
    const failing = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error("down")), 50),
    );
    const result = withinDeadline(failing, 600);
    await vi.advanceTimersByTimeAsync(50);
    await expect(result).resolves.toBeNull();
  });

  it("leaves no timer behind once the value is in", async () => {
    const result = withinDeadline(after(10, 1), 600);
    await vi.advanceTimersByTimeAsync(10);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
});
