/**
 * Tri-state metadata-anchor verdict for the verify page's verdict band.
 * Pure function over the DTO verification block (tagit-services assets API).
 *
 * This is about METADATA integrity (is the served product doc the one anchored
 * on-chain?), distinct from the lifecycle verdict (is the item authentic?).
 */
import type { AssetVerificationBlock } from "./services";

export type AnchorTone = "green" | "yellow" | "red";

export interface AnchorVerdict {
  tone: AnchorTone;
  label: string;
  detail: string;
}

const ZERO_HASH_RE = /^0x0+$/;

/**
 * True when a newer product-doc version exists than the one whose anchor is
 * confirmed on-chain — i.e. an edit is still propagating (META-T37).
 *
 * This drives a SUBTLE HINT ONLY. The tri-state anchorVerdict below stays the
 * authoritative statement about metadata integrity; this predicate never
 * changes a tone, and the hint it gates links to nothing. Both versions must
 * be present numbers: a null anchoredVersion is "not yet anchored" (the
 * verdict band's yellow state), not "propagating".
 */
export function newerVersionPropagating(
  verification: AssetVerificationBlock | undefined | null,
): boolean {
  if (!verification) return false;
  const { latestVersion, anchoredVersion } = verification;
  return (
    typeof latestVersion === "number" &&
    typeof anchoredVersion === "number" &&
    latestVersion > anchoredVersion
  );
}

export function anchorVerdict(
  verification: AssetVerificationBlock | undefined | null,
): AnchorVerdict {
  // No verification block at all (legacy/unmigrated token): nothing is
  // anchored yet — that is a pending state, not a failure.
  if (!verification) {
    return {
      tone: "yellow",
      label: "Not yet anchored",
      detail: "No metadata anchor exists for this token yet.",
    };
  }

  if (verification.verified) {
    return {
      tone: "green",
      label: "Verified",
      detail: "Product metadata matches the on-chain anchor.",
    };
  }

  const hashMissing =
    verification.metadataHash === null ||
    verification.metadataHash === undefined ||
    ZERO_HASH_RE.test(verification.metadataHash);
  const pending =
    verification.anchorStatus === "pending" ||
    verification.anchorStatus === null ||
    verification.anchorStatus === undefined;

  if (pending || hashMissing) {
    return {
      tone: "yellow",
      label: "Not yet anchored",
      detail: "Metadata exists but its on-chain anchor has not confirmed yet.",
    };
  }

  // Anchored, but the served doc does not match (newer unanchored version,
  // failed anchor, or hash mismatch) — that is a red verification failure.
  return {
    tone: "red",
    label: "Metadata verification FAILED",
    detail: "The served product metadata does not match the confirmed on-chain anchor.",
  };
}
