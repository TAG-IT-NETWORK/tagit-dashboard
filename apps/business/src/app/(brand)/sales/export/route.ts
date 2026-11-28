import { NextResponse } from "next/server";

import { SIGN_IN_PATH } from "@/lib/access";
import { canExportSales } from "@/lib/brand-numbers";
import { getBrandSalesFile } from "@/lib/brand-services";
import { getBrandSession } from "@/lib/brand-session";

export const dynamic = "force-dynamic";

/**
 * The brand's sales as a file (TAP-T18). MANAGERS ONLY.
 *
 * Three checks, each enough alone: the gate (lib/access.ts PATH_ROLES), this
 * handler, and tagit-services against the brand's roster. The brand is the
 * session's; the request names nothing.
 */
export async function GET(request: Request): Promise<Response> {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  const session = await getBrandSession();
  if (session === null) return to(SIGN_IN_PATH);
  if (!canExportSales(session.role)) return to("/sales");

  const file = await getBrandSalesFile(session);
  if (file === null) return to("/sales?file=failed");

  const day = new Date().toISOString().slice(0, 10);
  return new Response(file, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="sales-${day}.csv"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
