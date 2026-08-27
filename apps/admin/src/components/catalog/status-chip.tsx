import { cn } from "@tagit/ui";

import { templateStatusStyle } from "@/lib/catalog/template-logic";

/** Template status chip (draft / published / archived) — server-renderable. */
export function StatusChip({ status, className }: { status: string; className?: string }) {
  const style = templateStatusStyle(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
