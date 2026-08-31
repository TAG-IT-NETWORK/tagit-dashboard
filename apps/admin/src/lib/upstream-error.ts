/**
 * Human-readable error from an upstream JSON body.
 *
 * Services error bodies are { error: CODE, message: human } (its
 * error-handler middleware); the admin proxies either pass that through
 * verbatim or produce { ok: false, error: human } themselves. Prefer the
 * human message, fall back to the error field, then to the status — so an
 * operator sees "At most 12 files per request…" and never a bare
 * VALIDATION_ERROR code.
 */
export function upstreamErrorMessage(data: unknown, status: number, action = "request"): string {
  const d = (data ?? {}) as Record<string, unknown>;
  if (typeof d.message === "string" && d.message.length > 0) return d.message;
  if (typeof d.error === "string" && d.error.length > 0) return d.error;
  return `${action} failed (${status})`;
}
