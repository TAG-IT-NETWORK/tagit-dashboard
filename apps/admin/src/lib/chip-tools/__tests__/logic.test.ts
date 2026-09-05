import { describe, expect, it } from "vitest";

import { buildUrlRecords, decodeReadResult, estimateUrlBytes, validateHttpsUrl } from "../logic";

describe("validateHttpsUrl", () => {
  it("accepts bare https URLs and rejects everything else for the SDM base", () => {
    expect(validateHttpsUrl("https://verify.tagit.network/sun")).toEqual({ url: "https://verify.tagit.network/sun", error: null });
    expect(validateHttpsUrl("http://verify.tagit.network/sun").error).toMatch(/https/);
    expect(validateHttpsUrl("https://verify.tagit.network/sun?x=1").error).toMatch(/query/);
    expect(validateHttpsUrl("verify.tagit.network").error).toMatch(/absolute/);
    expect(validateHttpsUrl("   ").error).toMatch(/enter/);
  });
  it("allows a query string for plain URL writes when asked", () => {
    expect(validateHttpsUrl("https://tagit.network/?utm=demo", { allowQuery: true }).url).toBe("https://tagit.network/?utm=demo");
  });
});

describe("records + decode", () => {
  it("builds a single URI record and decodes read results tolerantly", () => {
    expect(buildUrlRecords("https://x.test")).toEqual([{ recordType: "url", data: "https://x.test" }]);
    const d = decodeReadResult({ records: [{ recordType: "url", data: "https://x.test" }, { bogus: 1 }], sun: null, sunError: "no key" });
    expect(d.records).toHaveLength(1);
    expect(d.url).toBe("https://x.test");
    expect(d.sunError).toBe("no key");
    expect(decodeReadResult(null)).toEqual({ records: [], sun: null, sunError: null, url: null });
  });
  it("estimates the on-chip size with the https:// prefix compressed away", () => {
    expect(estimateUrlBytes("https://verify.tagit.network/sun")).toBe(2 + 3 + 1 + 1 + "verify.tagit.network/sun".length);
  });
});
