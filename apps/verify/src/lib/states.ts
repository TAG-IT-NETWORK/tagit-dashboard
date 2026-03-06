export const STATES: Record<number, {
  label: string;
  color: string;
  bg: string;
  text: string;
  border: string;
  glow: string;
}> = {
  0: { label: "NONE", color: "gray", bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/30", glow: "" },
  1: { label: "MINTED", color: "blue", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", glow: "shadow-blue-500/20" },
  2: { label: "BOUND", color: "purple", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30", glow: "shadow-purple-500/20" },
  3: { label: "ACTIVATED", color: "green", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", glow: "shadow-emerald-500/20" },
  4: { label: "CLAIMED", color: "amber", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", glow: "shadow-amber-500/20" },
  5: { label: "FLAGGED", color: "red", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", glow: "shadow-red-500/20" },
  6: { label: "RECYCLED", color: "gray", bg: "bg-gray-500/10", text: "text-gray-500", border: "border-gray-500/30", glow: "" },
};

export const STATE_DESCRIPTIONS: Record<number, string> = {
  0: "This asset does not exist",
  1: "Digital twin created, awaiting NFC binding",
  2: "Bound to physical NFC tag",
  3: "Quality verified, in distribution",
  4: "Owned by end consumer",
  5: "Flagged for investigation",
  6: "End of life, permanently retired",
};
