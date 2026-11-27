import { describe, expect, it } from "vitest";

import {
  executeBody,
  mintRecipientFor,
  BATCH_ID_RE,
  BATCH_SIZE_ADVICE,
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
  parseServerBatchList,
  upsertRecentBatch,
  mintBlock,
  validateQuantity,
  wizardStepForBatch,
  wizardStepIndex,
  type RecentBatch,
} from "@/lib/catalog/batch-logic";
import type { MintReadiness } from "@/lib/catalog/template-logic";

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
  it('parses quoted fields, "" escapes and CRLF/LF breaks', () => {
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
    expect(buildCsvPreview(big).structuralError).toBe(
      "This CSV has 101 rows. A batch can hold at most 100 items. Split a larger run into several batches.",
    );
    // Exactly the cap is fine.
    const atCap = `serial\n${Array.from({ length: MAX_BATCH_SIZE }, (_, i) => `SN-${i}`).join("\n")}`;
    expect(buildCsvPreview(atCap).structuralError).toBeNull();
    expect(buildCsvPreview(atCap).rows).toHaveLength(100);
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

// ── WB-09: server batch list → Recent-batches rail ──────────────────────────

describe("parseServerBatchList (WB-09)", () => {
  const serverBatch = {
    id: "bat_01HZX",
    templateId: "tpl_1",
    state: "minted",
    quantity: 25,
    minted: 25,
    createdAt: "2026-08-20T10:00:00.000Z",
  };

  it("maps the {ok, batches} envelope onto rail rows", () => {
    expect(parseServerBatchList({ ok: true, count: 1, batches: [serverBatch] })).toEqual([
      { id: "bat_01HZX", size: 25, state: "minted", createdAt: "2026-08-20T10:00:00.000Z" },
    ]);
  });

  it("returns null for non-list envelopes (triggers the localStorage fallback)", () => {
    expect(parseServerBatchList(null)).toBeNull();
    expect(parseServerBatchList({ ok: false, error: "boom" })).toBeNull();
    expect(parseServerBatchList({ ok: true, batches: "nope" })).toBeNull();
  });

  it("drops malformed rows instead of corrupting the rail", () => {
    const rows = parseServerBatchList({
      ok: true,
      batches: [
        serverBatch,
        { id: "not-a-batch-id", state: "minted", quantity: 1, createdAt: "x" },
        { id: "bat_2", state: "minted", quantity: "25", createdAt: "x" },
        null,
      ],
    });
    expect(rows).toEqual([
      { id: "bat_01HZX", size: 25, state: "minted", createdAt: "2026-08-20T10:00:00.000Z" },
    ]);
  });

  it("tolerates a missing createdAt (empty string)", () => {
    const rows = parseServerBatchList({
      ok: true,
      batches: [{ id: "bat_3", state: "validated", quantity: 2 }],
    });
    expect(rows).toEqual([{ id: "bat_3", size: 2, state: "validated", createdAt: "" }]);
  });
});

// ── Cream-run guardrails (TAP-T19) ───────────────────────────────────────────

describe("batch size: at most 100, the registry's own limit (TAP-T19)", () => {
  it("is the registry's number, and the advice names it", () => {
    // TAGITCore.MAX_BATCH_SIZE. The services cap (batch.ts) mirrors it too.
    expect(MAX_BATCH_SIZE).toBe(100);
    expect(BATCH_SIZE_ADVICE).toBe(
      "A batch can hold at most 100 items. Split a larger run into several batches.",
    );
  });

  it("a quantity of 100 is taken; 101 is refused and told what to do", () => {
    expect(validateQuantity("100")).toEqual({ quantity: 100, error: null });
    expect(validateQuantity("101")).toEqual({ quantity: null, error: BATCH_SIZE_ADVICE });
    expect(validateQuantity("250")).toEqual({ quantity: null, error: BATCH_SIZE_ADVICE });
  });

  it("zero is told what a batch needs, in plain words", () => {
    expect(validateQuantity("0")).toEqual({
      quantity: null,
      error: "A batch needs at least 1 item.",
    });
  });
});

describe("mintBlock: can this batch be created or minted? (TAP-T19)", () => {
  const ready: MintReadiness = { published: true, missing: [] };
  const neverPublished: MintReadiness = { published: false, missing: [] };
  const incomplete: MintReadiness = { published: true, missing: ["brand", "photo"] };
  const fresh = { size: null, hasTx: false };

  it("nothing blocks a ready template", () => {
    expect(mintBlock(fresh, ready)).toBeNull();
    expect(mintBlock({ size: 100, hasTx: false }, ready)).toBeNull();
  });

  it("a template that was never published: publish it first", () => {
    expect(mintBlock(fresh, neverPublished)).toEqual({
      kind: "not_published",
      title: "Publish the template first.",
      fix: "Items can only be minted from a published template.",
      toTemplate: true,
    });
  });

  it("a published version that misses parts: says which, and what to do", () => {
    expect(mintBlock(fresh, incomplete)).toEqual({
      kind: "incomplete",
      title: "The published version of this template is missing: Brand and a photo.",
      fix: "Add what is missing, publish the template again, then come back here.",
      toTemplate: true,
    });
  });

  it("a stored batch over the limit is blocked, whatever the template", () => {
    const block = mintBlock({ size: 180, hasTx: false }, ready);
    expect(block).toEqual({
      kind: "too_large",
      title: "This batch has 180 items.",
      fix: BATCH_SIZE_ADVICE,
      toTemplate: false,
    });
    // Size is judged first: it is the one no template change can fix.
    expect(mintBlock({ size: 180, hasTx: false }, neverPublished)?.kind).toBe("too_large");
    // …and without knowing the template at all.
    expect(mintBlock({ size: 101, hasTx: false }, null)?.kind).toBe("too_large");
  });

  it("a batch with a transaction on record is never blocked", () => {
    // The retry looks for that transaction first; a mint that already landed
    // has to be finished whatever the template looks like today.
    for (const readiness of [ready, neverPublished, incomplete, null]) {
      expect(mintBlock({ size: 180, hasTx: true }, readiness)).toBeNull();
    }
  });

  it("while the template is unknown nothing is blocked: the API decides", () => {
    expect(mintBlock(fresh, null)).toBeNull();
    expect(mintBlock({ size: 5, hasTx: false }, null)).toBeNull();
  });
});

// ── TAP-T17: who receives a batch ────────────────────────────────────────────

describe("who receives a batch", () => {
  const ADDR = "0x8aE1E82C00145d5e08b8E63DF35cA455F0aabe23";

  it("a product with a brand goes to that brand's wallet; any other asks for an address", () => {
    expect(mintRecipientFor("aura-skin")).toEqual({ kind: "brand", brandId: "aura-skin" });
    for (const none of [null, undefined, "", "   ", 7, {}, ["aura-skin"]]) {
      expect(mintRecipientFor(none), JSON.stringify(none)).toEqual({ kind: "typed" });
    }
  });

  it("sends no address for a brand's batch, whatever is in the field", () => {
    const brand = mintRecipientFor("aura-skin");
    expect(executeBody(brand, "")).toEqual({});
    expect(executeBody(brand, ADDR)).toEqual({});
    expect(executeBody(brand, "junk")).toEqual({});
  });

  it("needs a real address for a batch with no brand", () => {
    const typed = mintRecipientFor(null);
    expect(executeBody(typed, ADDR)).toEqual({ to: ADDR });
    for (const bad of ["", "0x", "0x123", `${ADDR}00`, ` ${ADDR}`, "aura-skin"]) {
      expect(executeBody(typed, bad), bad).toBeNull();
    }
  });
});
