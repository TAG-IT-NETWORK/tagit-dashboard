import { describe, expect, it } from "vitest";

import {
  BATCH_ID_RE,
  MAX_BATCH_SIZE,
  STALE_MINTING_MS,
  attachServerErrors,
  basescanTxUrl,
  buildCsvPreview,
  canExecuteBatch,
  canUnstickBatch,
  isBatchInFlight,
  parseRecentBatches,
  parseRfc4180,
  upsertRecentBatch,
  validateQuantity,
  wizardStepForBatch,
  wizardStepIndex,
  type RecentBatch,
} from "@/lib/catalog/batch-logic";

// ── Wizard state machine ─────────────────────────────────────────────────────

describe("wizardStepForBatch", () => {
  it("derives the step from the server-side batch state (resume contract)", () => {
    expect(wizardStepForBatch(null)).toBe("create");
    expect(wizardStepForBatch(undefined)).toBe("create");
    expect(wizardStepForBatch("validated")).toBe("mint");
    expect(wizardStepForBatch("minting")).toBe("mint");
    expect(wizardStepForBatch("mint_failed")).toBe("mint");
    expect(wizardStepForBatch("minted")).toBe("export");
  });

  it("lands unknown future states on the status step, never create", () => {
    expect(wizardStepForBatch("some_new_state")).toBe("mint");
  });

  it("orders steps create < mint < export", () => {
    expect(wizardStepIndex("create")).toBeLessThan(wizardStepIndex("mint"));
    expect(wizardStepIndex("mint")).toBeLessThan(wizardStepIndex("export"));
  });
});

describe("canExecuteBatch / isBatchInFlight", () => {
  it("execute is only legal from validated and mint_failed (services guard)", () => {
    expect(canExecuteBatch("validated")).toBe(true);
    expect(canExecuteBatch("mint_failed")).toBe(true);
    expect(canExecuteBatch("minting")).toBe(false);
    expect(canExecuteBatch("minted")).toBe(false);
    expect(canExecuteBatch(null)).toBe(false);
  });

  it("only 'minting' is in flight", () => {
    expect(isBatchInFlight("minting")).toBe(true);
    expect(isBatchInFlight("minted")).toBe(false);
    expect(isBatchInFlight("validated")).toBe(false);
  });
});

describe("canUnstickBatch", () => {
  it("requires ADMIN + state=minting + stale", () => {
    expect(canUnstickBatch("admin", "minting", STALE_MINTING_MS)).toBe(true);
    expect(canUnstickBatch("admin", "minting", STALE_MINTING_MS + 1)).toBe(true);
  });

  it("denies editors and viewers regardless of staleness", () => {
    expect(canUnstickBatch("editor", "minting", STALE_MINTING_MS * 2)).toBe(false);
    expect(canUnstickBatch("viewer", "minting", STALE_MINTING_MS * 2)).toBe(false);
    expect(canUnstickBatch(null, "minting", STALE_MINTING_MS * 2)).toBe(false);
  });

  it("denies fresh minting and non-minting states", () => {
    expect(canUnstickBatch("admin", "minting", STALE_MINTING_MS - 1)).toBe(false);
    expect(canUnstickBatch("admin", "minted", STALE_MINTING_MS * 2)).toBe(false);
    expect(canUnstickBatch("admin", "validated", STALE_MINTING_MS * 2)).toBe(false);
  });
});

// ── RFC 4180 parser (mirror of services parseRfc4180) ────────────────────────

describe("parseRfc4180", () => {
  it("parses quoted fields, \"\" escapes and CRLF/LF breaks", () => {
    expect(parseRfc4180('serial,name_override\r\n"SN,1","say ""hi"""\nSN2,plain')).toEqual([
      ["serial", "name_override"],
      ["SN,1", 'say "hi"'],
      ["SN2", "plain"],
    ]);
  });

  it("rejects ragged rows", () => {
    expect(() => parseRfc4180("a,b\n1,2,3")).toThrow(/ragged row/);
  });

  it("rejects unterminated quotes, stray quotes and bare CR", () => {
    expect(() => parseRfc4180('serial\n"unterminated')).toThrow(/unterminated/);
    expect(() => parseRfc4180('serial\nab"c')).toThrow(/unexpected '"'/);
    expect(() => parseRfc4180("serial\rx")).toThrow(/bare CR/);
  });

  it("rejects empty input", () => {
    expect(() => parseRfc4180("")).toThrow(/empty/);
  });
});

// ── CSV validation preview ───────────────────────────────────────────────────

describe("buildCsvPreview", () => {
  it("accepts a clean CSV and preserves cells verbatim", () => {
    const preview = buildCsvPreview(
      "serial,tag_uid,name_override,price_usdc\nSN-1,04AA,First,29.99\nSN-2,,,",
    );
    expect(preview.ok).toBe(true);
    expect(preview.structuralError).toBeNull();
    expect(preview.header).toEqual(["serial", "tag_uid", "name_override", "price_usdc"]);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0]).toEqual({
      row: 1,
      cells: ["SN-1", "04AA", "First", "29.99"],
      errors: [],
    });
    expect(preview.errorCount).toBe(0);
  });

  it("collects row-level errors with 1-based data-row indices (matches services)", () => {
    const preview = buildCsvPreview("serial\nSN-1\n\nSN-1\nSN-4");
    // row 2: empty serial; row 3: duplicate of SN-1
    expect(preview.ok).toBe(false);
    expect(preview.rows[1].errors).toEqual(["serial is required"]);
    expect(preview.rows[2].errors).toEqual(["duplicate serial 'SN-1'"]);
    expect(preview.rows[3].errors).toEqual([]);
    expect(preview.errorCount).toBe(2);
  });

  it("enforces the services field caps and price format", () => {
    const long = "x".repeat(201);
    const preview = buildCsvPreview(
      `serial,tag_uid,name_override,price_usdc\n${long},${long},${long},1.2345678`,
    );
    expect(preview.ok).toBe(false);
    expect(preview.rows[0].errors).toEqual([
      "serial exceeds 200 characters",
      "tag_uid exceeds 200 characters",
      "name_override exceeds 200 characters",
      "price_usdc: must be a decimal string with at most 6 decimals",
    ]);
  });

  it("REQ-S-29: rejects formula-leading cells inline (= + - @ TAB CR)", () => {
    for (const first of ["=1+1", "+1", "-1", "@cmd", "\tx"]) {
      const preview = buildCsvPreview(`serial,name_override\nSN-1,"${first}"`);
      expect(preview.ok).toBe(false);
      expect(preview.rows[0].errors.join(" ")).toMatch(/REQ-S-29/);
    }
  });

  it("REQ-S-29: quoting a formula does NOT smuggle it through (quoted-formula rejection)", () => {
    // The parser unquotes first, then the denylist checks the CELL CONTENT —
    // exactly like the services import path.
    const preview = buildCsvPreview('serial,name_override\nSN-1,"=HYPERLINK(""http://evil"")"');
    expect(preview.ok).toBe(false);
    expect(preview.rows[0].cells[1]).toBe('=HYPERLINK("http://evil")');
    expect(preview.rows[0].errors.join(" ")).toMatch(/forbidden character/);
  });

  it("rejects a formula-leading HEADER cell structurally", () => {
    const preview = buildCsvPreview("=serial\nSN-1");
    expect(preview.ok).toBe(false);
    expect(preview.structuralError).toMatch(/REQ-S-29/);
  });

  it("rejects unknown/duplicate/missing-serial headers structurally", () => {
    expect(buildCsvPreview("serial,nope\nSN-1,x").structuralError).toMatch(/unknown CSV column/);
    expect(buildCsvPreview("serial,serial\nSN-1,SN-2").structuralError).toMatch(/duplicate/);
    expect(buildCsvPreview("tag_uid\n04AA").structuralError).toMatch(/'serial' column/);
  });

  it("rejects header-only files and oversize batches structurally", () => {
    expect(buildCsvPreview("serial\n").structuralError).toMatch(/no data rows/);
    const big = `serial\n${Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => `SN-${i}`).join("\n")}`;
    expect(buildCsvPreview(big).structuralError).toMatch(/max 250 per batch/);
  });

  it("surfaces parse failures as the structural error", () => {
    const preview = buildCsvPreview("serial,tag_uid\nSN-1");
    expect(preview.structuralError).toMatch(/ragged row/);
    expect(preview.rows).toHaveLength(0);
  });
});

describe("attachServerErrors", () => {
  it("pins server-side errors on the matching rows and dedupes repeats", () => {
    const preview = buildCsvPreview("serial\nSN-1\n");
    expect(preview.ok).toBe(true);
    const merged = attachServerErrors(preview, [
      { row: 1, error: "serial already minted in another batch" },
      { row: 1, error: "serial already minted in another batch" },
    ]);
    expect(merged.ok).toBe(false);
    expect(merged.rows[0].errors).toEqual(["serial already minted in another batch"]);
    expect(merged.errorCount).toBe(1);
    // Original preview untouched (pure).
    expect(preview.rows[0].errors).toEqual([]);
  });

  it("is a no-op for an empty error list", () => {
    const preview = buildCsvPreview("serial\nSN-1\n");
    expect(attachServerErrors(preview, [])).toBe(preview);
  });
});

// ── Quantity path ────────────────────────────────────────────────────────────

describe("validateQuantity", () => {
  it("accepts 1..MAX_BATCH_SIZE integers", () => {
    expect(validateQuantity("1")).toEqual({ quantity: 1, error: null });
    expect(validateQuantity(` ${MAX_BATCH_SIZE} `)).toEqual({
      quantity: MAX_BATCH_SIZE,
      error: null,
    });
  });

  it("rejects zero, overflow and non-integers", () => {
    expect(validateQuantity("0").quantity).toBeNull();
    expect(validateQuantity(String(MAX_BATCH_SIZE + 1)).quantity).toBeNull();
    expect(validateQuantity("12.5").quantity).toBeNull();
    expect(validateQuantity("-3").quantity).toBeNull();
    expect(validateQuantity("abc").quantity).toBeNull();
    expect(validateQuantity("").quantity).toBeNull();
  });
});

// ── Recent-batch memory ──────────────────────────────────────────────────────

describe("recent batches", () => {
  const entry = (id: string): RecentBatch => ({
    id,
    size: 5,
    state: "validated",
    createdAt: "2026-08-25T00:00:00.000Z",
  });

  it("parseRecentBatches degrades malformed storage to []", () => {
    expect(parseRecentBatches(null)).toEqual([]);
    expect(parseRecentBatches("not json")).toEqual([]);
    expect(parseRecentBatches('{"a":1}')).toEqual([]);
    expect(parseRecentBatches('[{"id":"nope","size":1,"state":"x","createdAt":"y"}]')).toEqual([]);
  });

  it("parseRecentBatches keeps only well-formed bat_ rows", () => {
    const good = entry("bat_ABC123");
    const parsed = parseRecentBatches(JSON.stringify([good, { id: "bat_ok" }, 42]));
    expect(parsed).toEqual([good]);
    expect(BATCH_ID_RE.test(parsed[0].id)).toBe(true);
  });

  it("upsertRecentBatch dedupes by id, newest first, capped", () => {
    const list = [entry("bat_A"), entry("bat_B")];
    const updated = upsertRecentBatch(list, { ...entry("bat_B"), state: "minted" });
    expect(updated.map((b) => b.id)).toEqual(["bat_B", "bat_A"]);
    expect(updated[0].state).toBe("minted");

    const capped = upsertRecentBatch([entry("bat_1"), entry("bat_2")], entry("bat_3"), 2);
    expect(capped.map((b) => b.id)).toEqual(["bat_3", "bat_1"]);
  });
});

describe("basescanTxUrl", () => {
  it("links to Base Sepolia (the only live chain)", () => {
    expect(basescanTxUrl("0xabc")).toBe("https://sepolia.basescan.org/tx/0xabc");
  });
});
