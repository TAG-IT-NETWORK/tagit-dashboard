#!/usr/bin/env tsx
/**
 * Mint a valid SUN URL for testing the verifier without a personalized
 * NTAG 424 DNA chip. Reads SDM_MASTER_KEY from env (or accepts --key=<hex>),
 * picks a random UID + counter unless overridden, and prints the URL.
 *
 *   # Legacy /sun carrier:
 *   tsx scripts/mint-sun-url.ts --uid=04CC082E5F6180 --counter=42 \
 *       --base=https://verify.tagit.network/sun
 *
 *   # GS1 Digital Link carrier (DPP-001) — builds /01/{GTIN}/21/{serial}:
 *   tsx scripts/mint-sun-url.ts --gtin=09506000134376 --serial=SN0000123
 *   tsx scripts/mint-sun-url.ts --gtin=09506000134376 --serial=SN1 \
 *       --resolver=https://id.tagit.network
 *
 * The key MUST match what the deployment's verifier expects.
 */
import { randomBytes } from "node:crypto";
import { mintSunUrl } from "../src/lib/sdm";
import { buildGs1Path, normalizeGtin } from "../src/lib/gs1";

function arg(name: string): string | undefined {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : undefined;
}

const keyHex = (arg("key") ?? process.env.SDM_MASTER_KEY ?? "").trim();
if (!/^[0-9a-fA-F]{32}$/.test(keyHex)) {
  console.error(
    "ERROR: pass --key=<32 hex chars> or set SDM_MASTER_KEY in env. Must be 16 bytes (32 hex).",
  );
  process.exit(1);
}
const key = Buffer.from(keyHex, "hex");

const uidArg = arg("uid");
const uid = uidArg
  ? Buffer.from(uidArg.replace(/[:\-\s]/g, ""), "hex")
  : Buffer.concat([Buffer.from([0x04]), randomBytes(6)]); // NXP UIDs start 0x04
if (uid.length !== 7) {
  console.error("ERROR: --uid must be exactly 14 hex chars (7 bytes), e.g. 04CC082E5F6180");
  process.exit(1);
}

const counter = arg("counter") ? Number(arg("counter")) : Math.floor(Math.random() * 1000);
if (!Number.isInteger(counter) || counter < 0 || counter > 0xffffff) {
  console.error("ERROR: --counter must be an integer in 0..16777215");
  process.exit(1);
}

// Carrier selection:
//   --base=<full url>            → use verbatim (legacy /sun or any path)
//   --gtin=<digits> [--serial=]  → build a GS1 Digital Link on the resolver host
//   (default)                    → legacy https://verify.tagit.network/sun
const gtinArg = arg("gtin");
let base: string;
if (arg("base")) {
  base = arg("base")!;
} else if (gtinArg) {
  const gtin = normalizeGtin(gtinArg);
  if (!gtin) {
    console.error("ERROR: --gtin must be 8/12/13/14 digits, e.g. 09506000134376");
    process.exit(1);
  }
  const resolver = (arg("resolver") ?? "https://id.tagit.network").replace(/\/$/, "");
  base = resolver + buildGs1Path({ gtin, serial: arg("serial") });
} else {
  base = "https://verify.tagit.network/sun";
}

const url = mintSunUrl(base, key, uid, counter);

console.log(url);
console.error(`\n# uid     = ${uid.toString("hex").toUpperCase()}`);
console.error(`# counter = ${counter}`);
console.error(`# base    = ${base}`);
