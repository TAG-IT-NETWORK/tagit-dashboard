/**
 * NXP NTAG 424 DNA — Secure Dynamic Messaging (SDM / "SUN") verifier.
 *
 * Server-side only. Implements the PICC decryption + truncated AES-CMAC checks
 * per NXP application note AN12196. Given the URL params a 424 DNA tag emits
 * on tap (`picc_data` + `cmac`) and the SDM master key personalized on the
 * chip, we can prove:
 *   1) the tag is genuine (only a chip with the master key could produce that
 *      `cmac` over that `picc_data`), and
 *   2) the tap counter (a monotonic 24-bit value the chip increments on every
 *      read) — so replay/clone is detectable downstream.
 *
 * IMPORTANT: never import this module from a client component. The SDM master
 * key lives only on the server (Vercel env `SDM_MASTER_KEY`).
 *
 * Hand-rolls AES-CMAC (RFC 4493) on top of node:crypto's AES-128-ECB so we
 * don't pull in a dep we'd have to vet.
 */
import { createCipheriv, createDecipheriv } from "node:crypto";

const BLOCK_SIZE = 16; // AES-128 block
const PICC_TAG_UID_AND_CTR = 0xc7; // first byte of plaintext PICC when UID+Ctr included

// ── AES-CMAC (RFC 4493) ────────────────────────────────────────────────────

function aesEcbEncryptBlock(key: Buffer, block: Buffer): Buffer {
  if (block.length !== BLOCK_SIZE) throw new Error("aes block must be 16 bytes");
  // node:crypto refuses AES-ECB without auto-padding only when input is a multiple
  // of block size; we explicitly disable padding for the single-block primitive.
  const cipher = createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(block), cipher.final()]);
}

/** Bitwise left-shift a 16-byte block by one bit (RFC 4493 leftShift1). */
function leftShift1(block: Uint8Array): Buffer {
  const out = Buffer.alloc(BLOCK_SIZE);
  let overflow = 0;
  for (let i = BLOCK_SIZE - 1; i >= 0; i--) {
    const v = (block[i] << 1) | overflow;
    out[i] = v & 0xff;
    overflow = (v >> 8) & 0x01;
  }
  return out;
}

function xorBlock(a: Uint8Array, b: Uint8Array): Buffer {
  const out = Buffer.alloc(BLOCK_SIZE);
  for (let i = 0; i < BLOCK_SIZE; i++) out[i] = a[i] ^ b[i];
  return out;
}

/** Derive CMAC subkeys K1, K2 from the cipher key (RFC 4493 §2.3). */
function deriveSubkeys(key: Buffer): { k1: Buffer; k2: Buffer } {
  const Rb = Buffer.alloc(BLOCK_SIZE);
  Rb[BLOCK_SIZE - 1] = 0x87;
  const L = aesEcbEncryptBlock(key, Buffer.alloc(BLOCK_SIZE));
  const k1 = (L[0] & 0x80) === 0 ? leftShift1(L) : xorBlock(leftShift1(L), Rb);
  const k2 = (k1[0] & 0x80) === 0 ? leftShift1(k1) : xorBlock(leftShift1(k1), Rb);
  return { k1, k2 };
}

/** AES-128-CMAC over `message`. Returns the 16-byte tag. */
export function aesCmac(key: Buffer, message: Buffer): Buffer {
  const { k1, k2 } = deriveSubkeys(key);
  const n = Math.ceil(message.length / BLOCK_SIZE) || 1;
  const lastBlockComplete = message.length > 0 && message.length % BLOCK_SIZE === 0;

  let lastBlock: Buffer;
  if (lastBlockComplete) {
    lastBlock = xorBlock(message.subarray((n - 1) * BLOCK_SIZE, n * BLOCK_SIZE), k1);
  } else {
    const remainder = message.length - (n - 1) * BLOCK_SIZE;
    const padded = Buffer.alloc(BLOCK_SIZE);
    if (remainder > 0) message.copy(padded, 0, (n - 1) * BLOCK_SIZE, message.length);
    padded[remainder] = 0x80;
    lastBlock = xorBlock(padded, k2);
  }

  let x = Buffer.alloc(BLOCK_SIZE);
  for (let i = 0; i < n - 1; i++) {
    const block = message.subarray(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE);
    // Buffer.from() narrows Buffer<ArrayBufferLike> (what Buffer.concat returns
    // in current @types/node) back to Buffer<ArrayBuffer> so the loop variable
    // keeps its inferred type.
    x = Buffer.from(aesEcbEncryptBlock(key, xorBlock(x, block)));
  }
  return aesEcbEncryptBlock(key, xorBlock(x, lastBlock));
}

// ── SDM primitives ─────────────────────────────────────────────────────────

/** Decrypt the 16-byte PICC payload with AES-128-CBC, zero IV. */
export function decryptPicc(piccCiphertext: Buffer, key: Buffer): Buffer {
  if (piccCiphertext.length !== BLOCK_SIZE) throw new Error("picc data must be 16 bytes");
  const decipher = createDecipheriv("aes-128-cbc", key, Buffer.alloc(BLOCK_SIZE));
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(piccCiphertext), decipher.final()]);
}

/** Parse the decrypted PICC payload (tag byte, 7-byte UID, 3-byte LE counter). */
export function parsePiccPlaintext(plain: Buffer): { tag: number; uid: Buffer; counter: number } {
  if (plain.length !== BLOCK_SIZE) throw new Error("picc plaintext must be 16 bytes");
  const tag = plain[0];
  const uid = plain.subarray(1, 8);
  const counter = plain[8] | (plain[9] << 8) | (plain[10] << 16);
  return { tag, uid, counter };
}

/**
 * Derive the per-tap session key KSesSDMFileRead per AN12196 §3.5.4:
 *
 *     SV2 = 3C C3 00 01 00 80 ‖ SDMReadCtr(3 LE) ‖ UID(7)
 *     KSes = AES-CMAC(SDMFileReadKey, SV2)
 */
export function deriveSessionKey(sdmFileReadKey: Buffer, uid: Buffer, counter: number): Buffer {
  if (uid.length !== 7) throw new Error("uid must be 7 bytes");
  const sv2 = Buffer.alloc(16);
  sv2.set([0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80], 0);
  sv2[6] = counter & 0xff;
  sv2[7] = (counter >> 8) & 0xff;
  sv2[8] = (counter >> 16) & 0xff;
  uid.copy(sv2, 9);
  return aesCmac(sdmFileReadKey, sv2);
}

/**
 * Truncate a 16-byte CMAC tag to the 8 bytes the chip emits in the URL: take
 * bytes at odd indices (1, 3, 5, 7, 9, 11, 13, 15). Per AN12196 §3.5.4.
 */
export function truncateCmac(fullTag: Buffer): Buffer {
  if (fullTag.length !== 16) throw new Error("CMAC tag must be 16 bytes");
  const out = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) out[i] = fullTag[1 + 2 * i];
  return out;
}

// ── URL-level verifier ─────────────────────────────────────────────────────

export interface SunVerifyOK {
  valid: true;
  uid: string; // 14 hex chars, uppercase
  counter: number; // 0..16,777,215 — monotonic per chip
}
export interface SunVerifyFail {
  valid: false;
  reason: string;
}
export type SunVerifyResult = SunVerifyOK | SunVerifyFail;

/**
 * Verify a SUN URL's `picc` + `cmac` query params against a single master key.
 * (The metaRead and fileRead keys are the same here; pass them separately if
 * they ever diverge.)
 *
 *   `picc` = 32 hex chars (16-byte encrypted PICC, "PICCDataTag" 0xC7 + UID + Ctr)
 *   `cmac` = 16 hex chars (8-byte truncated AES-CMAC of an empty message under
 *            the per-tap session key)
 */
export function verifySunUrl(piccHex: string, cmacHex: string, masterKey: Buffer): SunVerifyResult {
  if (!/^[0-9a-fA-F]{32}$/.test(piccHex)) return { valid: false, reason: "bad picc hex" };
  if (!/^[0-9a-fA-F]{16}$/.test(cmacHex)) return { valid: false, reason: "bad cmac hex" };
  if (masterKey.length !== 16) return { valid: false, reason: "master key must be 16 bytes" };

  let plain: Buffer;
  try {
    plain = decryptPicc(Buffer.from(piccHex, "hex"), masterKey);
  } catch {
    return { valid: false, reason: "picc decrypt failed" };
  }
  const { tag, uid, counter } = parsePiccPlaintext(plain);
  if (tag !== PICC_TAG_UID_AND_CTR) {
    return { valid: false, reason: `unexpected PICC tag 0x${tag.toString(16)}` };
  }

  const sessionKey = deriveSessionKey(masterKey, uid, counter);
  // For URLs that only carry UID+Counter (no encrypted file data), the CMAC
  // covers an empty message under the per-tap session key.
  const fullTag = aesCmac(sessionKey, Buffer.alloc(0));
  const expected = truncateCmac(fullTag);
  const got = Buffer.from(cmacHex, "hex");
  if (!timingSafeEqual(expected, got)) return { valid: false, reason: "cmac mismatch" };

  return {
    valid: true,
    uid: uid.toString("hex").toUpperCase(),
    counter,
  };
}

/** Constant-time buffer compare. */
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ── Test-URL minter (used by the dev helper script + a future bridge writer) ──

/** Mint a valid SUN URL for a given UID + counter under `masterKey`. */
export function mintSunUrl(
  baseUrl: string,
  masterKey: Buffer,
  uid: Buffer,
  counter: number,
): string {
  if (uid.length !== 7) throw new Error("uid must be 7 bytes");
  if (counter < 0 || counter > 0xffffff) throw new Error("counter out of range");

  const plain = Buffer.alloc(16);
  plain[0] = PICC_TAG_UID_AND_CTR;
  uid.copy(plain, 1);
  plain[8] = counter & 0xff;
  plain[9] = (counter >> 8) & 0xff;
  plain[10] = (counter >> 16) & 0xff;
  // bytes 11..15 are padding (zeros); they don't affect verification.

  const cipher = createCipheriv("aes-128-cbc", masterKey, Buffer.alloc(16));
  cipher.setAutoPadding(false);
  const picc = Buffer.concat([cipher.update(plain), cipher.final()]);

  const sessionKey = deriveSessionKey(masterKey, uid, counter);
  const fullTag = aesCmac(sessionKey, Buffer.alloc(0));
  const cmac = truncateCmac(fullTag);

  const url = new URL(baseUrl);
  url.searchParams.set("picc", picc.toString("hex").toUpperCase());
  url.searchParams.set("cmac", cmac.toString("hex").toUpperCase());
  return url.toString();
}
