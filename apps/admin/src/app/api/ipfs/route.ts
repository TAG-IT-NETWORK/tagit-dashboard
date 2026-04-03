import { NextRequest, NextResponse } from "next/server";

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud";

/** POST /api/ipfs — Upload file or JSON to IPFS via Pinata */
export async function POST(req: NextRequest) {
  if (!PINATA_JWT) {
    return NextResponse.json({ error: "IPFS not configured" }, { status: 500 });
  }

  const contentType = req.headers.get("content-type") || "";

  // JSON metadata upload
  if (contentType.includes("application/json")) {
    const body = await req.json();
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: body.metadata,
        pinataMetadata: { name: body.name || "tagit-metadata" },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || "Pinata error" }, { status: 500 });
    }
    return NextResponse.json({
      cid: data.IpfsHash,
      url: `ipfs://${data.IpfsHash}`,
      gateway: `${PINATA_GATEWAY}/ipfs/${data.IpfsHash}`,
    });
  }

  // File upload (image)
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const pinataForm = new FormData();
  pinataForm.append("file", file);
  pinataForm.append("pinataMetadata", JSON.stringify({ name: `tagit-${Date.now()}-${file.name}` }));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: pinataForm,
  });
  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: data.error || "Pinata upload failed" }, { status: 500 });
  }

  return NextResponse.json({
    cid: data.IpfsHash,
    url: `ipfs://${data.IpfsHash}`,
    gateway: `${PINATA_GATEWAY}/ipfs/${data.IpfsHash}`,
  });
}
