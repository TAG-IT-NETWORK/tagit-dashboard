import { keccak256, encodePacked } from "viem";

/**
 * Convert NFC tag UID string to bytes32 tagId hash
 * @param uid - Tag UID in format "04:A1:B2:C3:D4:E5:F6" (7 bytes for NTAG424)
 * @returns keccak256 hash of the UID bytes
 */
export function uidToTagId(uid: string): `0x${string}` {
  // uid format: "04:A1:B2:C3:D4:E5:F6" (7 bytes for NTAG424)
  const normalizedUid = uid.toUpperCase().replace(/[^0-9A-F]/g, ":");
  const parts = normalizedUid.split(":").filter((p) => p.length > 0);

  // Convert to bytes
  const bytes = parts.map((b) => parseInt(b, 16));
  const uidHex = `0x${bytes.map((b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;

  return keccak256(encodePacked(["bytes"], [uidHex]));
}

/**
 * Validate NFC tag UID format
 * @param uid - Tag UID string to validate
 * @returns true if valid NTAG424 UID format (7 bytes)
 */
export function isValidUID(uid: string): boolean {
  // Accept various formats: 04:A1:B2:C3:D4:E5:F6 or 04A1B2C3D4E5F6 or 04-A1-B2-C3-D4-E5-F6
  const normalized = uid.toUpperCase().replace(/[^0-9A-F]/g, "");

  // NTAG424 DNA has 7-byte UID
  if (normalized.length !== 14) {
    return false;
  }

  // Verify all characters are valid hex
  return /^[0-9A-F]{14}$/.test(normalized);
}

/**
 * Format UID bytes to display format
 * @param uid - Raw UID string (hex or colon-separated)
 * @returns Formatted UID like "04:A1:B2:C3:D4:E5:F6"
 */
export function formatUID(uid: string): string {
  const normalized = uid.toUpperCase().replace(/[^0-9A-F]/g, "");
  const pairs = normalized.match(/.{1,2}/g) || [];
  return pairs.join(":");
}

/**
 * Parse UID from various input formats
 * @param input - UID in any format
 * @returns Normalized UID or null if invalid
 */
export function parseUID(input: string): string | null {
  if (!isValidUID(input)) {
    return null;
  }

  return formatUID(input);
}

/**
 * Generate a random test UID for development
 * @returns Random 7-byte UID in format "04:XX:XX:XX:XX:XX:XX"
 */
export function generateTestUID(): string {
  // NTAG424 UIDs always start with 04 (NXP manufacturer code)
  const bytes = [0x04];
  for (let i = 0; i < 6; i++) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  return bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":");
}

/**
 * Truncate tagId hash for display
 * @param tagId - Full bytes32 tagId
 * @returns Truncated format like "0x1234...5678"
 */
export function truncateTagId(tagId: string): string {
  if (tagId.length <= 14) return tagId;
  return `${tagId.slice(0, 10)}...${tagId.slice(-8)}`;
}
