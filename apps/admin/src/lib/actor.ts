/**
 * REQ-S-16 actor seam: every mutating server proxy forwards the signed-in
 * user's identity upstream as the X-Actor header (and the services `actor`
 * body field where the endpoint accepts one).
 *
 * META-T32 establishes the admin session; on this base there is no
 * authenticated identity yet, so the helper resolves null and callers omit
 * X-Actor entirely rather than fabricating an identity. When T32 lands, this
 * function becomes the single place that reads the session.
 */
export async function getActor(): Promise<string | null> {
  return null;
}
