const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min minimum
let lastSweep = 0;

export function shouldRunHealthSweep(): boolean {
  const now = Date.now();
  if (now - lastSweep < HEALTH_CHECK_INTERVAL_MS) return false;
  lastSweep = now;
  return true;
}

export async function sequentialHealthSweep(routes: string[], baseUrl: string) {
  if (!shouldRunHealthSweep()) return;
  const results: Record<string, number> = {};
  for (const route of routes) {
    try {
      const res = await fetch(`${baseUrl}${route}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(3000),
      });
      results[route] = res.status;
      await new Promise((r) => setTimeout(r, 500)); // stagger requests
    } catch {
      results[route] = 0;
    }
  }
  console.log("[Health] Sweep complete:", results);
  return results;
}
