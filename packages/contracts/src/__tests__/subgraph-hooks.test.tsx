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
