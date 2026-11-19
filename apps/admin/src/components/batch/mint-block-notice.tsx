"use client";

/**
 * Why a batch cannot be created or minted right now, and what to do about it
 * (TAP-T19). The reasons come from mintBlock() in lib/catalog/batch-logic.ts,
 * which mirrors the checks the services side enforces.
 */

import Link from "next/link";
import { Button } from "@tagit/ui";
import { AlertTriangle, ArrowRight } from "lucide-react";

import type { MintBlock } from "@/lib/catalog/batch-logic";

interface MintBlockNoticeProps {
  block: MintBlock;
  templateId: string;
  /** Read the template again (after publishing it in another tab). */
  onRecheck?: () => void;
}

export function MintBlockNotice({ block, templateId, onRecheck }: MintBlockNoticeProps) {
  return (
    <div
      role="alert"
      data-testid="mint-block"
      data-kind={block.kind}
      className="flex items-start gap-3 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
      <div className="space-y-2">
        <p className="font-medium">{block.title}</p>
        <p className="text-muted-foreground">{block.fix}</p>
        {block.toTemplate && (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/catalog/${templateId}`}>
                Open the template
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
            {onRecheck && (
              <Button type="button" size="sm" variant="ghost" onClick={onRecheck}>
                Check again
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
