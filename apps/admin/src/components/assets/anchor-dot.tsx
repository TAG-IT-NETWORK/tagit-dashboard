import type { AnchorVerdict } from "@/lib/catalog/types";

/**
 * REQ-S-12 tri-state anchor verdict, surfaced explicitly:
 *   confirmed → green, pending → YELLOW (never green), drift → red.
 */
const VERDICT_STYLES: Record<AnchorVerdict, { dot: string; text: string; label: string }> = {
  confirmed: { dot: "bg-green-500", text: "text-green-500", label: "Anchored" },
  pending: { dot: "bg-yellow-500", text: "text-yellow-500", label: "Anchor pending" },
  drift: { dot: "bg-red-500", text: "text-red-500", label: "Drift" },
};

export function AnchorDot({ verdict, showLabel }: { verdict: AnchorVerdict; showLabel?: boolean }) {
  const style = VERDICT_STYLES[verdict];
  return (
    <span className="inline-flex items-center gap-1.5" title={style.label}>
      <span
        className={`h-2 w-2 rounded-full ${style.dot}`}
        data-verdict={verdict}
        aria-label={style.label}
      />
      {showLabel && <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>}
    </span>
  );
}
