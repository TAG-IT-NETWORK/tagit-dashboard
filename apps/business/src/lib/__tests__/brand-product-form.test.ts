import { describe, expect, it } from "vitest";

import {
  bodyForCreate,
  bodyForEdit,
  canEditProducts,
  canPublishProducts,
  heroPhoto,
  isOurPhotoUrl,
  listWords,
  missingParts,
  parseCreatedProduct,
  parsePrice,
  parseProductDetail,
  parseProductForm,
  parseProductId,
  parseUploadedPhoto,
  PHOTO_MAX_BYTES,
  photoProblem,
  priceForForm,
  readAttributes,
  stateWords,
  withHeroPhoto,
  type ProductField,
} from "@/lib/brand-product-form";

const SHA = "a".repeat(64);
const PHOTO = `https://media.tagit.network/i/${SHA}/lg.webp`;
const form = (fields: Partial<Record<ProductField, unknown>>) =>
  parseProductForm((field) => fields[field]);

describe("who may do what", () => {
  it("lets Editors and Managers edit, and only Managers publish", () => {
    expect([null, "viewer", "operator", "admin"].map((r) => canEditProducts(r as never))).toEqual([
      false,
      false,
      true,
      true,
    ]);
    expect(
      [null, "viewer", "operator", "admin"].map((r) => canPublishProducts(r as never)),
    ).toEqual([false, false, false, true]);
  });
});

describe("parseProductId", () => {
  it("accepts ids exactly as tagit-services makes them", () => {
    expect(parseProductId("tpl_01M7RBE451J802R65S9887MSCD")).toBe("tpl_01M7RBE451J802R65S9887MSCD");
  });
  it("refuses anything that could become another path", () => {
    for (const bad of [
      "",
      "tpl_",
      "x",
      "tpl_a/b",
      "tpl_a?x=1",
      "tpl_a#b",
      "../tpl_a",
      "tpl_a ",
      " tpl_a",
      "tpl_a\n",
      "TPL_a",
      "tpl_a-b",
      "tpl_a.b",
      "tpl_a%2F",
      `tpl_${"a".repeat(65)}`,
      null,
      undefined,
      7,
      ["tpl_a"],
      {},
    ]) {
      expect(parseProductId(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("isOurPhotoUrl", () => {
  it("accepts only a photo address of our own media storage", () => {
    for (const size of ["orig", "lg", "md", "sm", "t"]) {
      expect(isOurPhotoUrl(`https://media.tagit.network/i/${SHA}/${size}.webp`), size).toBe(true);
    }
  });
  it("refuses every other address", () => {
    for (const bad of [
      `http://media.tagit.network/i/${SHA}/lg.webp`,
      `https://media.tagit.network.evil.example/i/${SHA}/lg.webp`,
      `https://evil.example/i/${SHA}/lg.webp`,
      `https://user@media.tagit.network/i/${SHA}/lg.webp`,
      `https://media.tagit.network/i/${SHA}/lg.webp?x=1`,
      `https://media.tagit.network/i/${SHA}/lg.webp#x`,
      `https://media.tagit.network/i/${SHA}/../x/lg.webp`,
      `https://media.tagit.network/i/${"A".repeat(64)}/lg.webp`,
      `https://media.tagit.network/i/${"a".repeat(63)}/lg.webp`,
      `https://media.tagit.network/i/${SHA}/xl.webp`,
      `https://media.tagit.network/i/${SHA}/lg.svg`,
      `https://media.tagit.network/i/${SHA}/lg.webp\n`,
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "",
      null,
      undefined,
      7,
    ]) {
      expect(isOurPhotoUrl(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("parsePrice", () => {
  it("reads dollars with up to two decimals and writes two", () => {
    expect(parsePrice("29.99")).toBe("29.99");
    expect(parsePrice("22.5")).toBe("22.50");
    expect(parsePrice("7")).toBe("7.00");
    expect(parsePrice("007.10")).toBe("7.10");
    expect(parsePrice("0.01")).toBe("0.01");
    expect(parsePrice("999999999.99")).toBe("999999999.99");
  });
  it("refuses everything else, and zero", () => {
    for (const bad of [
      "",
      "0",
      "0.00",
      "-5",
      "+5",
      "5.",
      ".5",
      "5.999",
      "1,000",
      "1e3",
      "0x10",
      "5 ",
      " 5",
      "five",
      "1234567890",
      "$5",
      "5.5.5",
      "٥",
    ]) {
      expect(parsePrice(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("parseProductForm", () => {
  it("builds exactly the body tagit-services takes, with no brand name in it", () => {
    const result = form({
      name: "  Day Cream ",
      model: "Anti-Wrinkle",
      sku: "232501",
      category: "Cosmetics",
      origin: "France",
      description: "50 ml.\nAvoid the eye area.",
      price: "29.9",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toEqual({
      name: "Day Cream",
      model: "Anti-Wrinkle",
      sku: "232501",
      category: "Cosmetics",
      origin: "France",
      description: "50 ml.\nAvoid the eye area.",
      priceUsdc6: "29.90",
    });
  });

  it("sends nothing the form did not name, whatever else was posted", () => {
    const posted: Record<string, unknown> = {
      name: "Cream",
      brand: "Someone Else",
      businessId: "other",
      status: "published",
      attributes: "[]",
      slug: "x",
      createdBy: "me",
    };
    const result = parseProductForm((field) => posted[field]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.body).sort()).toEqual(
      ["category", "description", "model", "name", "origin", "priceUsdc6", "sku"].sort(),
    );
    // The brand name is added by the server, never read from the form.
    expect("brand" in result.body).toBe(false);
    expect(bodyForCreate(result.body, "Acme").brand).toBe("Acme");
  });

  it("turns empty fields into nothing, and needs a name", () => {
    const ok = form({ name: "Cream" });
    expect(ok.ok && ok.body).toMatchObject({
      model: null,
      sku: null,
      category: null,
      origin: null,
      description: null,
      priceUsdc6: null,
    });
    for (const name of ["", "   ", undefined, null, 7, new Blob(["x"])]) {
      const result = form({ name });
      expect(result.ok, JSON.stringify(name)).toBe(false);
      if (!result.ok) expect(result.errors.name).toBe("Give the product a name.");
    }
  });

  it("refuses text that is too long and keeps what it echoes short", () => {
    const result = form({ name: "x".repeat(900), description: "y".repeat(9000) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toContain("200");
    expect(result.errors.description).toContain("5,000");
    expect(result.values.name.length).toBe(201);
    expect(result.values.description.length).toBe(5001);
    expect(form({ name: "x".repeat(200), description: "y".repeat(5000) }).ok).toBe(true);
  });

  it("refuses control characters, but allows line breaks in a description", () => {
    for (const bad of ["a\u0000b", "a\u0007b", "a\u007fb", "a\u001bb"]) {
      const result = form({ name: bad });
      expect(result.ok, JSON.stringify(bad)).toBe(false);
    }
    expect(form({ name: "Cream", model: "a\nb" }).ok).toBe(false);
    expect(form({ name: "Cream", description: "a\nb\r\n\tc" }).ok).toBe(true);
    expect(form({ name: "Cream", description: "a\u0000b" }).ok).toBe(false);
  });

  it("keeps markup as plain text: it is escaped where it is shown, not here", () => {
    const result = form({ name: "<img src=x onerror=alert(1)>" });
    expect(result.ok && result.body.name).toBe("<img src=x onerror=alert(1)>");
  });

  it("refuses a price that is not dollars and cents, and reports every problem at once", () => {
    const result = form({ name: "", price: "abc", sku: "z".repeat(300) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["name", "price", "sku"]);
    expect(result.values.price).toBe("abc");
  });
});

describe("the photo", () => {
  it("accepts PNG, JPG and WebP up to the limit", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      expect(photoProblem({ type, size: 1 }), type).toBeNull();
      expect(photoProblem({ type, size: PHOTO_MAX_BYTES }), type).toBeNull();
    }
  });
  it("refuses other types, an empty file and one that is too large", () => {
    for (const type of [
      "image/svg+xml",
      "image/gif",
      "image/heic",
      "text/html",
      "application/pdf",
      "",
      "IMAGE/PNG",
      "image/png; x",
    ]) {
      expect(photoProblem({ type, size: 10 }), type).toBe("Use a PNG, JPG or WebP image.");
    }
    expect(photoProblem({ type: "image/png", size: 0 })).toBe("That file is empty.");
    expect(photoProblem({ type: "image/png", size: PHOTO_MAX_BYTES + 1 })).toContain("too large");
  });

  it("takes the large copy of a stored photo, and only one of ours", () => {
    const media = (lg: unknown) => ({ ok: true, media: [{ urls: { lg, sm: PHOTO } }] });
    expect(parseUploadedPhoto(201, media(PHOTO))).toBe(PHOTO);
    expect(parseUploadedPhoto(200, media(PHOTO))).toBe(PHOTO);
    for (const [status, body] of [
      [201, media("https://evil.example/x.webp")],
      [201, media(undefined)],
      [201, { ok: false, media: [{ urls: { lg: PHOTO } }] }],
      [201, { ok: true, media: [] }],
      [201, { ok: true, media: [{ urls: { lg: PHOTO } }, { urls: { lg: PHOTO } }] }],
      [201, { ok: true, media: [null] }],
      [201, { ok: true }],
      [400, media(PHOTO)],
      [403, media(PHOTO)],
      [500, media(PHOTO)],
      [201, null],
      [201, "x"],
    ] as Array<[number, unknown]>) {
      expect(parseUploadedPhoto(status, body), JSON.stringify(body)).toBeNull();
    }
  });

  it("sets the main photo and keeps every other stored row", () => {
    const stored = [
      { trait_type: "Size", value: "50 ml" },
      { trait_type: "media:hero", value: "https://media.tagit.network/i/old/lg.webp" },
      { trait_type: "media:gallery", value: PHOTO },
    ];
    expect(withHeroPhoto(stored, PHOTO)).toEqual([
      { trait_type: "media:hero", value: PHOTO },
      { trait_type: "Size", value: "50 ml" },
      { trait_type: "media:gallery", value: PHOTO },
    ]);
    expect(withHeroPhoto([], PHOTO)).toEqual([{ trait_type: "media:hero", value: PHOTO }]);
    // The stored list is not changed in place.
    expect(stored).toHaveLength(3);
  });

  it("reads stored rows, dropping malformed ones, and shows a main photo only when it is ours", () => {
    expect(
      readAttributes([
        { trait_type: "a", value: "b", extra: 1 },
        null,
        "x",
        { trait_type: 1, value: "b" },
        { trait_type: "c" },
      ]),
    ).toEqual([{ trait_type: "a", value: "b" }]);
    for (const none of [null, undefined, "x", {}, 7]) expect(readAttributes(none)).toEqual([]);
    expect(heroPhoto([{ trait_type: "media:hero", value: PHOTO }])).toBe(PHOTO);
    expect(
      heroPhoto([{ trait_type: "media:hero", value: "https://evil.example/x.png" }]),
    ).toBeNull();
    expect(heroPhoto([{ trait_type: "media:gallery", value: PHOTO }])).toBeNull();
    expect(heroPhoto([])).toBeNull();
  });
});

describe("a product read back", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: "tpl_1",
    businessId: "acme",
    status: "published",
    version: 2,
    name: "Day Cream",
    model: "M",
    sku: "S",
    category: "C",
    origin: "France",
    description: "D",
    priceUsdc6: "29990000",
    attributes: [
      { trait_type: "media:hero", value: PHOTO },
      { trait_type: "Size", value: "50 ml" },
    ],
    createdBy: "staff@tagit.test",
    ...over,
  });
  const read = (over: Record<string, unknown> = {}, brandId = "acme", id = "tpl_1") =>
    parseProductDetail(200, { ok: true, template: row(over), versions: [] }, id, brandId);

  it("reads the category of the newest PUBLISHED version, not of the working copy", () => {
    const withVersions = (versions: unknown) =>
      parseProductDetail(
        200,
        { ok: true, template: row({ category: "Apparel" }), versions },
        "tpl_1",
        "acme",
      );
    expect(read()?.publishedCategory).toBeNull();
    expect(withVersions(undefined)?.publishedCategory).toBeNull();
    expect(withVersions("x")?.publishedCategory).toBeNull();
    expect(
      withVersions([
        { version: 1, snapshot: { category: "Apparel" } },
        { version: 3, snapshot: { category: " Cosmetics " } },
        { version: 2, snapshot: { category: "Watches" } },
        { version: "9", snapshot: { category: "Ignored" } },
        null,
      ])?.publishedCategory,
    ).toBe("Cosmetics");
    // The working copy says something else, and is not what items are made from.
    expect(
      withVersions([{ version: 1, snapshot: { category: "Cosmetics" } }])?.values.category,
    ).toBe("Apparel");
    // A published version with no category has none.
    expect(withVersions([{ version: 1, snapshot: {} }])?.publishedCategory).toBe("");
    expect(withVersions([{ version: 1, snapshot: null }])?.publishedCategory).toBe("");
  });

  it("gives the form its values, the photo, and nothing else from the answer", () => {
    const product = read();
    expect(product).toMatchObject({
      id: "tpl_1",
      state: "live",
      photoUrl: PHOTO,
      missing: [],
      values: {
        name: "Day Cream",
        model: "M",
        sku: "S",
        category: "C",
        origin: "France",
        description: "D",
        price: "29.99",
      },
    });
    expect(JSON.stringify(product)).not.toContain("staff@tagit.test");
    expect(product!.attributes).toHaveLength(2);
  });

  it("is nothing when the answer is about another brand or another product", () => {
    expect(read({}, "other")).toBeNull();
    expect(read({ businessId: null })).toBeNull();
    expect(read({ businessId: "ACME" })).toBeNull();
    expect(read({ businessId: undefined })).toBeNull();
    expect(read({ id: "tpl_2" })).toBeNull();
    expect(read({}, "acme", "tpl_2")).toBeNull();
  });

  it("is nothing for any answer that is not a good one", () => {
    for (const [status, body] of [
      [404, { ok: false }],
      [403, { ok: true, template: row() }],
      [500, { ok: true, template: row() }],
      [200, null],
      [200, { ok: false, template: row() }],
      [200, { ok: true }],
      [200, { ok: true, template: "x" }],
      [200, { ok: true, template: row({ status: "deleted" }) }],
      [200, { ok: true, template: row({ name: "  " }) }],
    ] as Array<[number, unknown]>) {
      expect(parseProductDetail(status, body, "tpl_1", "acme"), JSON.stringify(body)).toBeNull();
    }
  });

  it("names the four states a product can be in", () => {
    expect(read({ status: "draft", version: 0 })!.state).toBe("draft");
    expect(read({ status: "published", version: 3 })!.state).toBe("live");
    expect(read({ status: "draft", version: 3 })!.state).toBe("live-with-changes");
    expect(read({ status: "archived", version: 3 })!.state).toBe("archived");
    expect(
      ["draft", "live", "live-with-changes", "archived"].map((s) => stateWords(s as never)),
    ).toEqual(["Draft", "Live", "Live, with changes not yet published", "Archived"]);
  });

  it("lists what a publish still needs, in plain words", () => {
    const product = read({ model: null, origin: "", description: undefined, attributes: [] });
    expect(product!.missing).toEqual(["model", "country of origin", "description", "a photo"]);
    expect(listWords(product!.missing)).toBe("model, country of origin, description and a photo");
    expect(listWords(["a photo"])).toBe("a photo");
    expect(listWords([])).toBe("");
    // A price is never needed to publish.
    expect(missingParts({ ...read()!.values, price: "" }, PHOTO)).toEqual([]);
    // A photo that is not ours counts as no photo.
    expect(
      read({ attributes: [{ trait_type: "media:hero", value: "https://evil.example/x.png" }] })!
        .missing,
    ).toEqual(["a photo"]);
  });

  it("shows a stored price the way the form takes one", () => {
    expect(priceForForm("29990000")).toBe("29.99");
    expect(priceForForm("7000000")).toBe("7.00");
    expect(parsePrice(priceForForm("1234567890000"))).toBe("1234567.89");
    for (const none of [null, undefined, "", "0", "-1", "1.5", 29990000])
      expect(priceForForm(none)).toBe("");
  });

  it("reads the id of a product just created, only for this brand", () => {
    const created = (over: Record<string, unknown> = {}) => ({
      ok: true,
      template: { id: "tpl_9", businessId: "acme", ...over },
    });
    expect(parseCreatedProduct(201, created(), "acme")).toBe("tpl_9");
    expect(parseCreatedProduct(201, created({ businessId: "other" }), "acme")).toBeNull();
    expect(parseCreatedProduct(201, created({ businessId: null }), "acme")).toBeNull();
    expect(parseCreatedProduct(201, created({ id: "../x" }), "acme")).toBeNull();
    expect(parseCreatedProduct(200, created(), "acme")).toBeNull();
    expect(parseCreatedProduct(400, created(), "acme")).toBeNull();
    expect(parseCreatedProduct(201, null, "acme")).toBeNull();
  });
});

describe("what an edit sends", () => {
  const body = {
    name: "Cream",
    model: null,
    sku: null,
    category: null,
    origin: null,
    description: null,
    priceUsdc6: "1.23",
  };
  const values = {
    name: "Cream",
    model: "",
    sku: "",
    category: "",
    origin: "",
    description: "",
    price: "1.23",
  };
  const stored = (price: string, hasBrandName = true) => ({
    values: { ...values, price },
    hasBrandName,
  });

  it("leaves the price out when the person did not change it, so a finer stored price is kept", () => {
    // Stored 1.234567 shows as 1.23; saving another field must not round it.
    expect(priceForForm("1234567")).toBe("1.23");
    const sent = bodyForEdit(body, values, stored("1.23"), "Acme");
    expect("priceUsdc6" in sent).toBe(false);
  });

  it("sends the price when it was changed, set or cleared", () => {
    expect(
      bodyForEdit(
        { ...body, priceUsdc6: "2.00" },
        { ...values, price: "2" },
        stored("1.23"),
        "Acme",
      ).priceUsdc6,
    ).toBe("2.00");
    expect(bodyForEdit(body, values, stored(""), "Acme").priceUsdc6).toBe("1.23");
    const cleared = bodyForEdit(
      { ...body, priceUsdc6: null },
      { ...values, price: "" },
      stored("1.23"),
      "Acme",
    );
    expect(cleared.priceUsdc6).toBeNull();
    expect("priceUsdc6" in cleared).toBe(true);
  });

  it("leaves a price below half a cent stored when the form is saved untouched", () => {
    const sent = bodyForEdit(
      { ...body, priceUsdc6: null },
      { ...values, price: "" },
      stored(priceForForm("4999")),
      "Acme",
    );
    expect("priceUsdc6" in sent).toBe(false);
  });

  it("never overwrites a product's brand name", () => {
    expect("brand" in bodyForEdit(body, values, stored("1.23", true), "Acme")).toBe(false);
    expect(
      "brand" in bodyForEdit({ ...body, brand: "Sneaked" }, values, stored("1.23", true), "Acme"),
    ).toBe(false);
  });

  it("fills in a missing brand name only when the brand's real name is known", () => {
    expect(bodyForEdit(body, values, stored("1.23", false), "Acme").brand).toBe("Acme");
    expect("brand" in bodyForEdit(body, values, stored("1.23", false), null)).toBe(false);
    expect(
      bodyForEdit({ ...body, brand: "Sneaked" }, values, stored("1.23", false), "Acme").brand,
    ).toBe("Acme");
  });

  it("keeps every other field of the form", () => {
    const sent = bodyForEdit(
      { ...body, model: "M", description: "D" },
      values,
      stored("1.23"),
      "Acme",
    );
    expect(sent).toEqual({
      name: "Cream",
      model: "M",
      sku: null,
      category: null,
      origin: null,
      description: "D",
    });
  });
});

describe("whether a product carries a brand name", () => {
  const read = (brand: unknown) =>
    parseProductDetail(
      200,
      {
        ok: true,
        template: {
          id: "tpl_1",
          businessId: "acme",
          status: "draft",
          version: 0,
          name: "Cream",
          brand,
          attributes: [],
        },
      },
      "tpl_1",
      "acme",
    )!.hasBrandName;
  it("is true only for real text", () => {
    expect(read("Acme")).toBe(true);
    for (const none of [null, undefined, "", "   ", 7])
      expect(read(none), String(none)).toBe(false);
  });
});
