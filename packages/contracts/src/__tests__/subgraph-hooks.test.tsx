import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// The subgraph URL is captured once at module load (client.ts), so every
// scenario re-imports the module graph after setting/clearing
// window.__SUBGRAPH_URL__ — the same hook the browser build honours.
type SubgraphWindow = Window & { __SUBGRAPH_URL__?: string };
type EnvLike = { process?: { env?: Record<string, string | undefined> } };

async function loadSubgraph(url?: string) {
  vi.resetModules();
  const env = (globalThis as unknown as EnvLike).process?.env;
  if (env) delete env.NEXT_PUBLIC_SUBGRAPH_URL;
  const w = window as SubgraphWindow;
  if (url) w.__SUBGRAPH_URL__ = url;
  else delete w.__SUBGRAPH_URL__;
  const client = await import("../subgraph/client");
  const hooks = await import("../subgraph/hooks");
  return { ...client, ...hooks };
}

const fetchMock = vi.fn();

function okResponse(data: unknown) {
  return { ok: true, statusText: "OK", json: async () => ({ data }) };
}

// Let the fetch → json → setState chain settle without relying on timers.
async function flushPromises() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("SubgraphClient without a configured URL", () => {
  it("rejects instead of calling fetch('') — the browser resolves that to the current page", async () => {
    const { SubgraphClient, hasSubgraphUrl } = await loadSubgraph(undefined);
    expect(hasSubgraphUrl()).toBe(false);
    await expect(
      new SubgraphClient().query("{ _meta { block { number } } }"),
    ).rejects.toThrow(/not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useSubgraphQuery hooks without a configured URL", () => {
  it("never fetch, report not-loading, and stay idle across re-renders, polling ticks and refetch", async () => {
    vi.useFakeTimers();
    const { useGlobalStats } = await loadSubgraph(undefined);

    const { result, rerender } = renderHook(() =>
      useGlobalStats({ pollingInterval: 1000 }),
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    for (let i = 0; i < 5; i++) rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await act(async () => {
      await result.current.refetch();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useSubgraphQuery hooks with a configured URL", () => {
  const URL = "https://subgraph.example/tagit";

  it("fetch once on mount and do NOT re-fetch on re-render after a failure (regression: /dashboard request loop)", async () => {
    fetchMock.mockResolvedValue({ ok: false, statusText: "Not Found" });
    const { useGlobalStats } = await loadSubgraph(URL);

    const { result, rerender } = renderHook(() => useGlobalStats());
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.isLoading).toBe(false);
    const firstError = result.current.error;

    for (let i = 0; i < 5; i++) rerender();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(URL);
    expect(result.current.error).toBe(firstError);
  });

  it("transform a successful response and re-fetch only on the polling interval", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(
      okResponse({
        globalStats: {
          totalAssets: "12",
          totalUsers: "3",
          totalTransfers: "7",
          dailyMints: 1,
          dailyTransfers: 2,
          flaggedCount: 0,
        },
      }),
    );
    const { useGlobalStats } = await loadSubgraph(URL);

    const { result, rerender } = renderHook(() =>
      useGlobalStats({ pollingInterval: 1000 }),
    );
    expect(result.current.isLoading).toBe(true);
    await flushPromises();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({
      totalAssets: 12,
      totalUsers: 3,
      totalTransfers: 7,
      dailyMints: 1,
      dailyTransfers: 2,
      flaggedCount: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i++) rerender();
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("time-window hooks (useDailyMints / useActiveUsers)", () => {
  const URL = "https://subgraph.example/tagit";
  const DAY = 24 * 60 * 60;

  function sentSince(callIndex: number): string {
    const init = fetchMock.mock.calls[callIndex][1] as { body: string };
    return (JSON.parse(init.body) as { variables: { since: string } }).variables
      .since;
  }

  it("compute `since` per fetch, not per render: later re-renders do not re-fetch, and polls carry a fresh window", async () => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
      ],
    });
    const t0 = new Date("2026-10-13T12:00:00Z");
    vi.setSystemTime(t0);
    fetchMock.mockResolvedValue(
      okResponse({ transfers: [{ id: "a" }, { id: "b" }] }),
    );
    const { useDailyMints } = await loadSubgraph(URL);

    const { result, rerender } = renderHook(() =>
      useDailyMints({ pollingInterval: 30_000 }),
    );
    await flushPromises();
    expect(result.current.data).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentSince(0)).toBe(String(Math.floor(t0.getTime() / 1000) - DAY));

    // Unrelated renders a few seconds later (e.g. another dashboard hook's
    // poll completing) must not issue requests outside the polling interval.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
    });
    for (let i = 0; i < 5; i++) rerender();
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The scheduled poll fires exactly once, with a freshly computed window.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(27_500);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentSince(1)).toBe(
      String(Math.floor((t0.getTime() + 30_000) / 1000) - DAY),
    );
  });
});

describe("useSubgraphQuery hooks with a client configured via getSubgraphClient({ url })", () => {
  it("treat the singleton's explicit URL as configured when no env/window URL is set", async () => {
    const URL = "https://configured.example/tagit";
    fetchMock.mockResolvedValue(okResponse({ globalStats: null }));
    const mod = await loadSubgraph(undefined);
    expect(mod.hasSubgraphUrl()).toBe(false);

    mod.getSubgraphClient({ url: URL });
    expect(mod.hasSubgraphUrl()).toBe(true);

    const { result } = renderHook(() => mod.useGlobalStats());
    expect(result.current.isLoading).toBe(true);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(URL);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({
      totalAssets: 0,
      totalUsers: 0,
      totalTransfers: 0,
      dailyMints: 0,
      dailyTransfers: 0,
      flaggedCount: 0,
    });
  });
});
