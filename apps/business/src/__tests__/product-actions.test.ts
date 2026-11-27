import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The brand app's writes (TAP-T17, brand editing): who may save, who may
 * publish, and that nothing reaches tagit-services when the answer is no.
 */

const services = vi.hoisted(() => ({
  getBrandProduct: vi.fn(),
  createBrandProduct: vi.fn(),
  updateBrandProduct: vi.fn(),
  publishBrandProduct: vi.fn(),
  uploadBrandPhoto: vi.fn(),
}));
const request = vi.hoisted(() => ({ loadBrand: vi.fn() }));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/brand-services", () => services);
vi.mock("@/lib/brand-request", () => request);
// redirect() ends the action by throwing, as it does in Next.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

const { saveProduct, publishProduct } = await import("@/app/(brand)/products/actions");

const SHA = "b".repeat(64);
const PHOTO = `https://media.tagit.network/i/${SHA}/lg.webp`;
const EMPTY = { values: {} as never, errors: {}, problem: null };

const signedIn = (role: "viewer" | "operator" | "admin" | null, brandId = "acme") =>
  request.loadBrand.mockResolvedValue({
    session: { email: "jane@acme.test", role, brandId },
    profile: { name: "Acme", nameKnown: true, logoUrl: null },
  });

const fields = (over: Record<string, string | Blob> = {}) => {
  const data = new FormData();
  const all: Record<string, string | Blob> = {
    name: "Day Cream",
    model: "M",
    price: "29.99",
    ...over,
  };
  for (const [key, value] of Object.entries(all)) data.append(key, value);
  return data;
};
const png = (size = 10) => new File([new Uint8Array(size)], "p.png", { type: "image/png" });
const stored = (over: Record<string, unknown> = {}) => ({
  id: "tpl_1",
  state: "draft",
  photoUrl: null,
  hasBrandName: true,
  attributes: [{ trait_type: "Size", value: "50 ml" }],
  missing: [],
  values: {
    name: "Day Cream",
    model: "M",
    sku: "",
    category: "",
    origin: "",
    description: "",
    price: "29.99",
  },
  ...over,
});
const outcome = async (run: Promise<unknown>) => {
  try {
    return await run;
  } catch (err) {
    return (err as Error).message;
  }
};
const noWrites = () => {
  expect(services.createBrandProduct).not.toHaveBeenCalled();
  expect(services.updateBrandProduct).not.toHaveBeenCalled();
  expect(services.publishBrandProduct).not.toHaveBeenCalled();
  expect(services.uploadBrandPhoto).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  services.createBrandProduct.mockResolvedValue("tpl_new");
  services.updateBrandProduct.mockResolvedValue(true);
  services.publishBrandProduct.mockResolvedValue(true);
  services.uploadBrandPhoto.mockResolvedValue(PHOTO);
  services.getBrandProduct.mockResolvedValue(stored());
});

describe("saveProduct", () => {
  it("sends a visitor with no brand session to sign in, and writes nothing", async () => {
    request.loadBrand.mockResolvedValue(null);
    expect(await outcome(saveProduct(EMPTY, fields()))).toBe("REDIRECT /signin");
    noWrites();
  });

  it("refuses a View-only account and an account with no role, and writes nothing", async () => {
    for (const role of ["viewer", null] as const) {
      signedIn(role);
      const state = (await saveProduct(EMPTY, fields({ productId: "tpl_1", photo: png() }))) as {
        problem: string;
      };
      expect(state.problem, String(role)).toContain("view products but not change");
    }
    noWrites();
    expect(services.getBrandProduct).not.toHaveBeenCalled();
  });

  it("creates a product for an Editor, from the named fields only", async () => {
    signedIn("operator");
    const data = fields({ businessId: "other", brand: "Someone Else", status: "published" });
    expect(await outcome(saveProduct(EMPTY, data))).toBe("REDIRECT /products/tpl_new?saved=1");
    expect(services.createBrandProduct).toHaveBeenCalledTimes(1);
    const [session, body] = services.createBrandProduct.mock.calls[0]!;
    expect(session.brandId).toBe("acme");
    expect(body).toEqual({
      name: "Day Cream",
      brand: "Acme",
      model: "M",
      sku: null,
      category: null,
      origin: null,
      description: null,
      priceUsdc6: "29.99",
    });
    expect(services.updateBrandProduct).not.toHaveBeenCalled();
  });

  it("returns the field errors and writes nothing when the form is not valid", async () => {
    signedIn("admin");
    const state = (await saveProduct(EMPTY, fields({ name: "", price: "abc" }))) as {
      errors: Record<string, string>;
    };
    expect(Object.keys(state.errors).sort()).toEqual(["name", "price"]);
    noWrites();
  });

  it("refuses a file that is not a photo before anything is stored", async () => {
    signedIn("operator");
    for (const file of [
      new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }),
      new File(["x"], "x.html", { type: "text/html" }),
      new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }),
    ]) {
      const state = (await saveProduct(EMPTY, fields({ photo: file }))) as {
        errors: Record<string, string>;
      };
      expect(state.errors.photo, file.name).toBeTruthy();
    }
    noWrites();
  });

  it("creates with a photo: the photo is stored, then attached to the new product", async () => {
    signedIn("operator");
    expect(await outcome(saveProduct(EMPTY, fields({ photo: png() })))).toBe(
      "REDIRECT /products/tpl_new?saved=1",
    );
    expect(services.uploadBrandPhoto).toHaveBeenCalledTimes(1);
    expect(services.updateBrandProduct.mock.calls[0]![1]).toBe("tpl_new");
    expect(services.updateBrandProduct.mock.calls[0]![2].attributes).toEqual([
      { trait_type: "media:hero", value: PHOTO },
    ]);
  });

  it("stops when the photo cannot be stored, and creates nothing", async () => {
    signedIn("operator");
    services.uploadBrandPhoto.mockResolvedValue(null);
    const state = (await saveProduct(EMPTY, fields({ photo: png() }))) as {
      errors: Record<string, string>;
    };
    expect(state.errors.photo).toContain("could not be stored");
    expect(services.createBrandProduct).not.toHaveBeenCalled();
    expect(services.updateBrandProduct).not.toHaveBeenCalled();
  });

  it("edits a product of this brand, keeping stored rows it does not know", async () => {
    signedIn("operator");
    expect(await outcome(saveProduct(EMPTY, fields({ productId: "tpl_1" })))).toBe(
      "REDIRECT /products/tpl_1?saved=1",
    );
    expect(services.getBrandProduct.mock.calls[0]![1]).toBe("tpl_1");
    const [, id, body] = services.updateBrandProduct.mock.calls[0]!;
    expect(id).toBe("tpl_1");
    // No photo was chosen: the stored rows are not sent at all, so none can be lost.
    expect("attributes" in body).toBe(false);
    expect(services.createBrandProduct).not.toHaveBeenCalled();

    vi.clearAllMocks();
    services.getBrandProduct.mockResolvedValue(stored());
    services.uploadBrandPhoto.mockResolvedValue(PHOTO);
    services.updateBrandProduct.mockResolvedValue(true);
    await outcome(saveProduct(EMPTY, fields({ productId: "tpl_1", photo: png() })));
    expect(services.updateBrandProduct.mock.calls[0]![2].attributes).toEqual([
      { trait_type: "media:hero", value: PHOTO },
      { trait_type: "Size", value: "50 ml" },
    ]);
  });

  it("never turns an edit into a new product: an id that is not this brand's product edits nothing", async () => {
    signedIn("admin");
    // Another brand's id and a missing one read the same from tagit-services: nothing.
    services.getBrandProduct.mockResolvedValue(null);
    for (const productId of ["tpl_theirs", "../x", "tpl_", "x"]) {
      const state = (await saveProduct(EMPTY, fields({ productId, photo: png() }))) as {
        problem: string;
      };
      expect(state.problem, productId).toBe("This product cannot be edited.");
    }
    noWrites();
  });

  it("refuses to edit an archived product", async () => {
    signedIn("admin");
    services.getBrandProduct.mockResolvedValue(stored({ state: "archived" }));
    const state = (await saveProduct(EMPTY, fields({ productId: "tpl_1" }))) as { problem: string };
    expect(state.problem).toBe("This product cannot be edited.");
    noWrites();
  });

  it("says nothing was changed when tagit-services refuses the save", async () => {
    signedIn("operator");
    services.updateBrandProduct.mockResolvedValue(false);
    const edit = (await saveProduct(EMPTY, fields({ productId: "tpl_1" }))) as { problem: string };
    expect(edit.problem).toContain("could not be saved");
    services.createBrandProduct.mockResolvedValue(null);
    const create = (await saveProduct(EMPTY, fields())) as { problem: string };
    expect(create.problem).toContain("could not be saved");
  });

  it("uses the brand of the session whatever the form says", async () => {
    signedIn("operator", "acme");
    await outcome(
      saveProduct(EMPTY, fields({ productId: "tpl_1", businessId: "other", brandId: "other" })),
    );
    expect(services.getBrandProduct.mock.calls[0]![0].brandId).toBe("acme");
    expect(services.updateBrandProduct.mock.calls[0]![0].brandId).toBe("acme");
    expect(JSON.stringify(services.updateBrandProduct.mock.calls[0]![2])).not.toContain("other");
  });
});

describe("saveProduct: what an edit leaves alone", () => {
  it("does not send the price or the brand name when neither was changed", async () => {
    signedIn("operator");
    await outcome(saveProduct(EMPTY, fields({ productId: "tpl_1", model: "New model" })));
    const body = services.updateBrandProduct.mock.calls[0]![2];
    expect(body.model).toBe("New model");
    expect("priceUsdc6" in body).toBe(false);
    expect("brand" in body).toBe(false);
  });

  it("sends the price when it was changed", async () => {
    signedIn("operator");
    await outcome(saveProduct(EMPTY, fields({ productId: "tpl_1", price: "31" })));
    expect(services.updateBrandProduct.mock.calls[0]![2].priceUsdc6).toBe("31.00");
  });

  it("fills in the brand name of a product that has none", async () => {
    signedIn("operator");
    services.getBrandProduct.mockResolvedValue(stored({ hasBrandName: false }));
    await outcome(saveProduct(EMPTY, fields({ productId: "tpl_1" })));
    expect(services.updateBrandProduct.mock.calls[0]![2].brand).toBe("Acme");
  });
});

describe("saveProduct: when the brand's record could not be read", () => {
  const standIn = (role: "operator" | "admin") =>
    request.loadBrand.mockResolvedValue({
      session: { email: "jane@acme.test", role, brandId: "acme" },
      // The header shows the brand id as a stand-in; it is not the brand's name.
      profile: { name: "acme", nameKnown: false, logoUrl: null },
    });

  it("creates nothing, stores no photo, and says so", async () => {
    standIn("operator");
    const state = (await saveProduct(EMPTY, fields({ photo: png() }))) as { problem: string };
    expect(state.problem).toContain("could not be loaded");
    noWrites();
  });

  it("still saves an edit, without touching the product's brand name", async () => {
    standIn("admin");
    expect(await outcome(saveProduct(EMPTY, fields({ productId: "tpl_1", model: "X" })))).toBe(
      "REDIRECT /products/tpl_1?saved=1",
    );
    expect("brand" in services.updateBrandProduct.mock.calls[0]![2]).toBe(false);
    // Even a product with no brand name is not given the stand-in.
    vi.clearAllMocks();
    services.updateBrandProduct.mockResolvedValue(true);
    services.getBrandProduct.mockResolvedValue(stored({ hasBrandName: false }));
    await outcome(saveProduct(EMPTY, fields({ productId: "tpl_1" })));
    expect("brand" in services.updateBrandProduct.mock.calls[0]![2]).toBe(false);
  });
});

describe("publishProduct", () => {
  const publish = (productId = "tpl_1") => {
    const data = new FormData();
    data.append("productId", productId);
    return publishProduct({ problem: null }, data);
  };

  it("sends a visitor with no brand session to sign in", async () => {
    request.loadBrand.mockResolvedValue(null);
    expect(await outcome(publish())).toBe("REDIRECT /signin");
    noWrites();
  });

  it("refuses an Editor, a View-only account and an account with no role", async () => {
    for (const role of ["operator", "viewer", null] as const) {
      signedIn(role);
      const state = (await publish()) as { problem: string };
      expect(state.problem, String(role)).toBe(
        "Only a Manager of your brand can publish a product.",
      );
    }
    noWrites();
    expect(services.getBrandProduct).not.toHaveBeenCalled();
  });

  it("publishes a complete product of this brand for a Manager", async () => {
    signedIn("admin");
    expect(await outcome(publish())).toBe("REDIRECT /products/tpl_1?saved=published");
    expect(services.publishBrandProduct).toHaveBeenCalledTimes(1);
    expect(services.publishBrandProduct.mock.calls[0]![0].brandId).toBe("acme");
    expect(services.publishBrandProduct.mock.calls[0]![1]).toBe("tpl_1");
  });

  it("does not publish a product that is not this brand's, is archived, or is incomplete", async () => {
    signedIn("admin");
    services.getBrandProduct.mockResolvedValue(null);
    expect(((await publish("tpl_theirs")) as { problem: string }).problem).toBe(
      "This product cannot be published.",
    );
    expect(((await publish("../x")) as { problem: string }).problem).toBe(
      "This product cannot be published.",
    );
    services.getBrandProduct.mockResolvedValue(stored({ state: "archived" }));
    expect(((await publish()) as { problem: string }).problem).toBe(
      "This product cannot be published.",
    );
    services.getBrandProduct.mockResolvedValue(stored({ missing: ["model", "a photo"] }));
    expect(((await publish()) as { problem: string }).problem).toBe(
      "Before publishing, add: model and a photo.",
    );
    expect(services.publishBrandProduct).not.toHaveBeenCalled();
  });

  it("says so when tagit-services refuses the publish", async () => {
    signedIn("admin");
    services.publishBrandProduct.mockResolvedValue(false);
    expect(((await publish()) as { problem: string }).problem).toContain("could not be published");
  });
});
