import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      accountAssociation: { header: "", payload: "", signature: "" },
      frame: {
        version: "0.0.0",
        name: "TAG IT Network",
        iconUrl: "https://admin.tagit.network/favicon.png",
        homeUrl: "https://admin.tagit.network",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    },
  );
}
