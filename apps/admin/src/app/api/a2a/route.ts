import { NextRequest, NextResponse } from "next/server";

const GATEWAY_URL = process.env.A2A_GATEWAY_URL || "https://api.tagit.network";
const API_KEY = process.env.API_KEY || process.env.A2A_API_KEY || "dev-api-key-change-me";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const targetUrl = body.agentUrl || GATEWAY_URL;

  const res = await fetch(`${targetUrl}/a2a`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body.payload),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
