import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { StepCreate } from "../batch/step-create";
import { DetailsTab } from "../catalog/details-tab";
import type { TemplateDto } from "@/lib/catalog/template-types";

/**
 * TAP-T09: the two console forms that take product facts.
 *   Details tab  — size, ingredients, how to use, warnings, use within
 *   Batch step 1 — lot, made on, best before
 * Both show the fields only for a cosmetics product on an API that knows
 * facts, and neither mentions facts in its request otherwise.
 */

function makeTemplate(overrides: Partial<TemplateDto> = {}): TemplateDto {
  return {
    id: "tpl_01ABC",
    slug: "night-cream",
    status: "draft",
    version: 0,
    name: "Night Cream",
    brand: "House Brand",
    model: "NC-50",
    sku: "HB-NC-50",
    category: "Cosmetics",
    origin: "US",
    description: "A rich night cream.",
    attributes: null,
    facts: null,
    priceUsdc6: null,
    msrpAmount: null,
    msrpCurrency: null,
    businessId: null,
    createdBy: "tester",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function type(label: RegExp | string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Details tab: product facts", () => {
  function renderTab(template: TemplateDto, disabled = false) {
    const onSave = vi.fn(async (_patch: Record<string, unknown>) => null as string | null);
    render(<DetailsTab template={template} disabled={disabled} onSave={onSave} />);
    return { onSave };
  }
  const save = () => fireEvent.click(screen.getByRole("button", { name: /save details/i }));

  it("offers the five facts for a cosmetics product, labelled in plain words", () => {
    renderTab(makeTemplate());

    expect(screen.getByTestId("product-facts")).toBeInTheDocument();
    for (const label of [
      "Size",
      "Use within (months after opening)",
      "Ingredients",
      "How to use",
      "Warnings",
    ]) {
      expect(screen.getByLabelText(label), label).toBeInTheDocument();
    }
  });

  it("shows what the template already holds", () => {
    renderTab(
      makeTemplate({
        facts: { size: "50 ml", ingredients: "Aqua, Glycerin", useWithinMonths: 12 },
      }),
    );

    expect(screen.getByLabelText("Size")).toHaveValue("50 ml");
    expect(screen.getByLabelText("Ingredients")).toHaveValue("Aqua, Glycerin");
    expect(screen.getByLabelText("Use within (months after opening)")).toHaveValue("12");
    expect(screen.getByLabelText("How to use")).toHaveValue("");
  });

  it("saves the filled facts, folded to single lines, with the other details", async () => {
    const { onSave } = renderTab(makeTemplate());

    type("Size", " 50 ml ");
    type("Ingredients", "Aqua,\nGlycerin,\n  Niacinamide");
    type("Use within (months after opening)", "12");
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      name: "Night Cream",
      category: "Cosmetics",
      facts: { size: "50 ml", ingredients: "Aqua, Glycerin, Niacinamide", useWithinMonths: 12 },
    });
  });

  it("sends facts: null when every fact was cleared", async () => {
    const { onSave } = renderTab(makeTemplate({ facts: { size: "50 ml" } }));

    type("Size", "");
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![0]).toHaveProperty("facts", null);
  });

  it("hides the facts for another category and leaves them out of the save", async () => {
    const { onSave } = renderTab(makeTemplate({ category: "apparel", facts: { size: "50 ml" } }));

    expect(screen.queryByTestId("product-facts")).not.toBeInTheDocument();
    expect(screen.getByText(/set the category to cosmetics/i)).toBeInTheDocument();
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    // Not mentioned at all, so the stored facts stay as they are.
    expect(onSave.mock.calls[0]![0]).not.toHaveProperty("facts");
  });

  it("brings the facts in as soon as the category is typed as cosmetics", () => {
    renderTab(makeTemplate({ category: "apparel" }));
    expect(screen.queryByTestId("product-facts")).not.toBeInTheDocument();

    type("Category", "cosmetics");

    expect(screen.getByTestId("product-facts")).toBeInTheDocument();
  });

  it("stays out of the way on an API that does not know facts yet", async () => {
    const legacy = makeTemplate();
    delete (legacy as { facts?: unknown }).facts;
    const { onSave } = renderTab(legacy);

    expect(screen.queryByTestId("product-facts")).not.toBeInTheDocument();
    expect(screen.queryByText(/set the category to cosmetics/i)).not.toBeInTheDocument();
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![0]).not.toHaveProperty("facts");
  });

  it("explains a bad value next to its field and does not save it", () => {
    const { onSave } = renderTab(makeTemplate());

    type("Use within (months after opening)", "soon");

    expect(screen.getByText(/whole number of months/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save details/i })).toBeDisabled();
    save();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("counts characters against the cap and blocks a save over it", () => {
    renderTab(makeTemplate());

    type("Warnings", "x".repeat(1501));

    expect(screen.getByText("1,501 / 1,500")).toBeInTheDocument();
    expect(screen.getByText(/keep this to 1,500 characters/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save details/i })).toBeDisabled();
  });

  it("is read-only for a viewer", () => {
    renderTab(makeTemplate({ facts: { size: "50 ml" } }), true);

    for (const label of ["Size", "Ingredients", "How to use", "Warnings"]) {
      expect(screen.getByLabelText(label), label).toBeDisabled();
    }
  });
});

describe("Batch step 1: batch details", () => {
  const TPL = "tpl_01ABC";

  function stubCreate() {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, batch: { id: "bat_01X", size: 20 } }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  const sentBody = (fetchMock: ReturnType<typeof vi.fn>) =>
    JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body)) as Record<
      string,
      unknown
    >;
  const submit = () =>
    fireEvent.click(screen.getByRole("button", { name: /validate & create batch/i }));

  it("offers lot, made on and best before when the product takes facts", () => {
    render(<StepCreate templateId={TPL} canCreate factsAvailable onCreated={vi.fn()} />);

    expect(screen.getByTestId("batch-facts")).toBeInTheDocument();
    for (const label of ["Lot number", "Made on", "Best before"]) {
      expect(screen.getByLabelText(label), label).toBeInTheDocument();
    }
    expect(screen.getByText(/cannot be changed after the batch is minted/i)).toBeInTheDocument();
  });

  it("sends the filled details with the batch", async () => {
    const fetchMock = stubCreate();
    const onCreated = vi.fn();
    render(<StepCreate templateId={TPL} canCreate factsAvailable onCreated={onCreated} />);

    type(/quantity/i, "20");
    type("Lot number", " L2406A ");
    type("Made on", "2026-06-01");
    type("Best before", "2028-06-01");
    submit();

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(sentBody(fetchMock)).toEqual({
      templateId: TPL,
      quantity: 20,
      facts: { lot: "L2406A", madeOn: "2026-06-01", bestBefore: "2028-06-01" },
    });
  });

  it("sends no facts key when the details are left empty", async () => {
    const fetchMock = stubCreate();
    const onCreated = vi.fn();
    render(<StepCreate templateId={TPL} canCreate factsAvailable onCreated={onCreated} />);

    type(/quantity/i, "20");
    submit();

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(sentBody(fetchMock)).toEqual({ templateId: TPL, quantity: 20 });
  });

  it("hides the details, and never sends them, when the product does not take facts", async () => {
    const fetchMock = stubCreate();
    const onCreated = vi.fn();
    render(<StepCreate templateId={TPL} canCreate factsAvailable={false} onCreated={onCreated} />);

    expect(screen.queryByTestId("batch-facts")).not.toBeInTheDocument();
    type(/quantity/i, "20");
    submit();

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(sentBody(fetchMock)).toEqual({ templateId: TPL, quantity: 20 });
  });

  it("does not send details that were typed before they stopped being available", async () => {
    const fetchMock = stubCreate();
    const onCreated = vi.fn();
    const { rerender } = render(
      <StepCreate templateId={TPL} canCreate factsAvailable onCreated={onCreated} />,
    );
    type(/quantity/i, "20");
    type("Lot number", "L2406A");

    rerender(
      <StepCreate templateId={TPL} canCreate factsAvailable={false} onCreated={onCreated} />,
    );
    submit();

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(sentBody(fetchMock)).toEqual({ templateId: TPL, quantity: 20 });
  });

  it("blocks the batch while best before is earlier than made on", () => {
    const fetchMock = stubCreate();
    render(<StepCreate templateId={TPL} canCreate factsAvailable onCreated={vi.fn()} />);

    type(/quantity/i, "20");
    type("Made on", "2026-06-01");
    type("Best before", "2026-05-31");

    expect(screen.getByText(/cannot be earlier than the made-on date/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /validate & create batch/i })).toBeDisabled();
    submit();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows what services says when it refuses the details", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: "VALIDATION_ERROR",
            message:
              "facts: lot, made-on and best-before are only available for products in the cosmetics category",
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<StepCreate templateId={TPL} canCreate factsAvailable onCreated={vi.fn()} />);

    type(/quantity/i, "20");
    type("Lot number", "L2406A");
    submit();

    expect(
      await screen.findByText(/only available for products in the cosmetics category/i),
    ).toBeInTheDocument();
  });
});
