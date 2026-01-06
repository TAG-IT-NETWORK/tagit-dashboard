/**
 * Web NFC Integration for NTAG424 DNA tags
 *
 * Web NFC API is only available in Chrome on Android
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API
 */

// Type definitions for Web NFC API (not in standard TypeScript libs)
declare global {
  interface Window {
    NDEFReader?: typeof NDEFReader;
  }

  class NDEFReader {
    constructor();
    scan(options?: { signal?: AbortSignal }): Promise<void>;
    write(
      message: NDEFMessageInit,
      options?: { signal?: AbortSignal; overwrite?: boolean }
    ): Promise<void>;
    onreading: ((event: NDEFReadingEvent) => void) | null;
    onreadingerror: ((event: Event) => void) | null;
  }

  interface NDEFReadingEvent extends Event {
    serialNumber: string;
    message: NDEFMessage;
  }

  interface NDEFMessage {
    records: NDEFRecord[];
  }

  interface NDEFRecord {
    recordType: string;
    mediaType?: string;
    id?: string;
    data?: DataView;
    encoding?: string;
    lang?: string;
    toRecords?(): NDEFRecord[];
  }

  interface NDEFMessageInit {
    records: NDEFRecordInit[];
  }

  interface NDEFRecordInit {
    recordType: string;
    mediaType?: string;
    id?: string;
    encoding?: string;
    lang?: string;
    data?: string | BufferSource | NDEFMessageInit;
  }
}

export interface NFCTagInfo {
  uid: string;
  records: NFCRecord[];
}

export interface NFCRecord {
  type: string;
  data: string | null;
  mediaType?: string;
}

/**
 * Check if Web NFC API is supported
 * Only available in Chrome on Android with HTTPS
 */
export function isNFCSupported(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

/**
 * Get NFC support status with detailed info
 */
export function getNFCSupportStatus(): {
  supported: boolean;
  reason?: string;
} {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Server-side rendering" };
  }

  if (!("NDEFReader" in window)) {
    // Check if it's a browser/platform issue
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isChrome = /Chrome/i.test(navigator.userAgent);
    const isSecure = location.protocol === "https:" || location.hostname === "localhost";

    if (!isAndroid) {
      return { supported: false, reason: "Web NFC requires Android device" };
    }
    if (!isChrome) {
      return { supported: false, reason: "Web NFC requires Chrome browser" };
    }
    if (!isSecure) {
      return { supported: false, reason: "Web NFC requires HTTPS connection" };
    }
    return { supported: false, reason: "Web NFC not available" };
  }

  return { supported: true };
}

/**
 * Read NFC tag UID and NDEF records
 * @param signal - Optional AbortSignal to cancel the scan
 * @returns Promise with tag UID and records
 */
export async function readNFCTag(signal?: AbortSignal): Promise<NFCTagInfo> {
  if (!isNFCSupported()) {
    throw new Error("Web NFC is not supported on this device/browser");
  }

  const ndef = new NDEFReader();
  await ndef.scan({ signal });

  return new Promise((resolve, reject) => {
    ndef.onreading = (event: NDEFReadingEvent) => {
      // Format serial number as colon-separated hex bytes
      const uid = formatSerialNumber(event.serialNumber);

      // Parse NDEF records
      const records: NFCRecord[] = event.message.records.map((record) => ({
        type: record.recordType,
        data: decodeRecordData(record),
        mediaType: record.mediaType,
      }));

      resolve({ uid, records });
    };

    ndef.onreadingerror = (error: Event) => {
      reject(new Error("Failed to read NFC tag"));
    };

    // Handle abort signal
    if (signal) {
      signal.addEventListener("abort", () => {
        reject(new DOMException("NFC scan was cancelled", "AbortError"));
      });
    }
  });
}

/**
 * Write NDEF records to NFC tag
 * @param tokenId - Asset token ID
 * @param verifyUrl - Base URL for verification (optional)
 */
export async function writeNFCTag(
  tokenId: bigint,
  verifyUrl: string = "https://verify.tagit.network"
): Promise<void> {
  if (!isNFCSupported()) {
    throw new Error("Web NFC is not supported on this device/browser");
  }

  const ndef = new NDEFReader();
  await ndef.write({
    records: [
      {
        recordType: "url",
        data: `${verifyUrl}/${tokenId.toString()}`,
      },
      {
        recordType: "text",
        data: JSON.stringify({
          tokenId: tokenId.toString(),
          chain: "optimism-sepolia",
          contract: "0x6a58eE8f2d500981b1793868C55072789c58fba6",
        }),
      },
    ],
  });
}

/**
 * Format serial number from Web NFC API to colon-separated hex
 * The serial number comes as a string like "04:a1:b2:c3:d4:e5:f6"
 */
function formatSerialNumber(serialNumber: string): string {
  // Serial number might already be formatted or might be raw bytes
  const cleaned = serialNumber.replace(/[^0-9a-fA-F]/g, "");
  const pairs = cleaned.match(/.{1,2}/g) || [];
  return pairs.map((p) => p.toUpperCase()).join(":");
}

/**
 * Decode NDEF record data to string
 */
function decodeRecordData(record: NDEFRecord): string | null {
  if (!record.data) return null;

  try {
    const decoder = new TextDecoder(record.encoding || "utf-8");
    return decoder.decode(record.data);
  } catch {
    // Return hex string for binary data
    const bytes = new Uint8Array(record.data.buffer);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

/**
 * Create an AbortController for cancellable NFC operations
 */
export function createNFCAbortController(): AbortController {
  return new AbortController();
}

/**
 * Hook-like helper for NFC scanning state
 * Use this with React useState/useEffect
 */
export interface NFCScanState {
  isScanning: boolean;
  tagInfo: NFCTagInfo | null;
  error: string | null;
}

export const initialNFCScanState: NFCScanState = {
  isScanning: false,
  tagInfo: null,
  error: null,
};
