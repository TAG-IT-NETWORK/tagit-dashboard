import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { BatchWizard } from "../batch/batch-wizard";
import { StepCreate } from "../batch/step-create";
import { StepMint } from "../batch/step-mint";
import { ActivateListPanel } from "../binding/activate-list-panel";
import { BindingStation } from "../binding/binding-station";
import { PublishRail } from "../catalog/publish-rail";
import { BATCH_SIZE_ADVICE, mintBlock } from "@/lib/catalog/batch-logic";
import { computePublishState, workingCopySnapshot } from "@/lib/catalog/template-logic";
import type { BatchDto, BatchFailure } from "@/lib/catalog/batch-types";
import type { TemplateDto, TemplateVersionDto } from "@/lib/catalog/template-types";

/**
 * TAP-T19: the cream-run guardrails, as the console shows them.
 *
 *   1. a batch holds at most 100 items
 *   2. a batch can only be made and minted from a published template
 *   3. a template can only be published when it is complete, and the screen
 *      says what is missing
 *   4. a failed mint shows why it failed
 *   5. "Activate & list" is offered for the bound part of a batch
 *
 * The services side enforces 1 to 4; these tests cover what a person sees.
 */

// The station talks to a card reader over a local socket. None here.
vi.mock("@/lib/nfc-bridge", () => ({
  useNfcBridge: () => ({
    wsConnected: false,
    readerConnected: false,
    readerName: null,
    card: null,
    bridgeVersion: null,
    error: null,
    config: { url: "ws://127.0.0.1:8237", token: "" },
    ready: false,
    request: vi.fn(),
    setConfig: vi.fn(),
  }),
}));

const TPL = "tpl_01ABC";
const BAT = "bat_01XYZ";
const PHOTO = `https://media.tagit.network/i/${"5".repeat(64)}/lg.webp`;

function makeTemplate(overrides: Partial<TemplateDto> = {}): TemplateDto {
  return {
    id: TPL,
    slug: "renewal-cream",
    status: "draft",
    version: 0,
    name: "Renewal Cream",
    brand: "TAG IT Demo",
    model: "RC-50",
    sku: "TD-RC-50",
    category: "Cosmetics",
    origin: "US",
    description: "A rich renewal cream.",
    attributes: [{ trait_type: "media:hero", value: PHOTO }],
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

function versionOf(t: TemplateDto, version = 1): TemplateVersionDto {
  return {
    version,
    snapshot: workingCopySnapshot(t),
    publishedBy: "tester",
    publishedAt: "2026-11-02T00:00:00.000Z",
  };
}

function makeBatch(overrides: Partial<BatchDto> = {}): BatchDto {
  return {
    id: BAT,
    templateId: TPL,
    size: 5,
    state: "validated",
    txHash: null,
    tokenStart: null,
    tokenEnd: null,
    actor: "tester",
    facts: null,
    createdAt: "2026-11-03T00:00:00.000Z",
    updatedAt: "2026-11-03T00:00:00.000Z",
    ...overrides,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** Answer requests by address. Anything not listed fails the test loudly. */
function stubFetch(routes: Array<[RegExp, (init?: RequestInit) => Response]>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const route = routes.find(([pattern]) => pattern.test(url));
    if (!route) throw new Error(`unexpected request in test: ${url}`);
    return route[1](init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const callsTo = (fetchMock: ReturnType<typeof vi.fn>, pattern: RegExp, method = "POST") =>
  fetchMock.mock.calls.filter(
    ([url, init]) =>
      pattern.test(String(url)) && ((init as RequestInit | undefined)?.method ?? "GET") === method,
  );

function type(label: RegExp | string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

// ── 3. Required parts at template publish ────────────────────────────────────

describe("publish panel: what the template still needs", () => {
  function renderRail(template: TemplateDto, versions: TemplateVersionDto[] = []) {
    const onChanged = vi.fn();
    render(
      <PublishRail
        template={template}
        versions={versions}
        publishState={computePublishState(template, versions)}
        writable
        canPublish
        onChanged={onChanged}
      />,
    );
    return { onChanged };
  }
  const publishButton = () => screen.getByRole("button", { name: /publish v/i });

  it("lists every missing part with the tab it is added on, and offers no publish", () => {
    const fetchMock = stubFetch([]);
    renderRail(
      makeTemplate({ brand: null, model: "  ", origin: null, attributes: null, description: "" }),
    );

    const box = screen.getByTestId("publish-missing");
    expect(within(box).getByText("Add these before publishing:")).toBeInTheDocument();
    const items = within(box)
      .getAllByRole("listitem")
      .map((li) => li.textContent?.replace(/\s+/g, " ").trim());
    expect(items).toEqual([
      "Brand (Details tab)",
      "Model (Details tab)",
      "Origin (Details tab)",
      "Description (Details tab)",
      "A photo (Media tab)",
    ]);

    expect(publishButton()).toBeDisabled();
    expect(publishButton()).toHaveAttribute("title", "Add what is missing first");
    fireEvent.click(publishButton());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["brand", { brand: null }, "Brand (Details tab)"],
    ["model", { model: null }, "Model (Details tab)"],
    ["sku", { sku: null }, "SKU (Details tab)"],
    ["category", { category: null }, "Category (Details tab)"],
    ["origin", { origin: null }, "Origin (Details tab)"],
    ["description", { description: null }, "Description (Details tab)"],
    ["photo", { attributes: [{ trait_type: "Color", value: "Black" }] }, "A photo (Media tab)"],
  ] as Array<[string, Partial<TemplateDto>, string]>)(
    "names %s when that is all that is missing",
    (part, patch, line) => {
      renderRail(makeTemplate(patch));
      const items = within(screen.getByTestId("publish-missing")).getAllByRole("listitem");
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveAttribute("data-part", part);
      expect(items[0]!.textContent?.replace(/\s+/g, " ").trim()).toBe(line);
      expect(publishButton()).toBeDisabled();
    },
  );

  it("a complete template shows no list and publishes", async () => {
    const fetchMock = stubFetch([
      [/\/templates\/tpl_01ABC\/publish$/, () => json({ ok: true, version: 1 }, 201)],
    ]);
    const { onChanged } = renderRail(makeTemplate());

    expect(screen.queryByTestId("publish-missing")).not.toBeInTheDocument();
    expect(publishButton()).toBeEnabled();
    fireEvent.click(publishButton());

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(callsTo(fetchMock, /\/publish$/)).toHaveLength(1);
  });

  it("shows the API's own sentence when it refuses what this screen let through", async () => {
    // The API is the one that decides. If it ever knows a gap this screen
    // does not, its words are shown, not a code.
    stubFetch([
      [
        /\/publish$/,
        () =>
          json(
            {
              error: "TEMPLATE_INCOMPLETE",
              message:
                "This template cannot be published yet. Still missing: a photo. Add what is missing, then publish again.",
              details: { missing: ["photo"] },
            },
            400,
          ),
      ],
    ]);
    const { onChanged } = renderRail(makeTemplate());
    fireEvent.click(publishButton());

    expect(
      await screen.findByText(
        "This template cannot be published yet. Still missing: a photo. Add what is missing, then publish again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("TEMPLATE_INCOMPLETE")).not.toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("an archived template is not asked for parts", () => {
    renderRail(makeTemplate({ status: "archived", brand: null }));
    expect(screen.queryByTestId("publish-missing")).not.toBeInTheDocument();
  });
});

// ── 1 + 2. Batch step 1: size, and publish before mint ───────────────────────

describe("batch step 1: size and template", () => {
  const createButton = () => screen.getByRole("button", { name: /validate & create batch/i });

  it("takes 100 items and refuses 101, saying what to do", () => {
    const fetchMock = stubFetch([]);
    render(<StepCreate templateId={TPL} canCreate factsAvailable={false} onCreated={vi.fn()} />);

    type(/quantity/i, "101");
    expect(screen.getByText(BATCH_SIZE_ADVICE)).toBeInTheDocument();
    expect(createButton()).toBeDisabled();
    fireEvent.click(createButton());
    expect(fetchMock).not.toHaveBeenCalled();

    type(/quantity/i, "100");
    expect(screen.queryByText(BATCH_SIZE_ADVICE)).not.toBeInTheDocument();
    expect(createButton()).toBeEnabled();
  });

  it("says 100 wherever it names the limit", () => {
    render(<StepCreate templateId={TPL} canCreate factsAvailable={false} onCreated={vi.fn()} />);
    expect(screen.getByLabelText(/quantity/i)).toHaveAttribute("placeholder", "1–100");
    expect(screen.getByText(/At most 100 items per batch/)).toBeInTheDocument();
    expect(screen.queryByText(/250/)).not.toBeInTheDocument();
  });

  it("a CSV of 101 rows is refused with the same advice", () => {
    render(<StepCreate templateId={TPL} canCreate factsAvailable={false} onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /csv upload/i }));
    const rows = Array.from({ length: 101 }, (_, i) => `SN-${i}`).join("\n");
    fireEvent.change(screen.getByPlaceholderText(/serial,tag_uid/), {
      target: { value: `serial\n${rows}` },
    });
    expect(screen.getByText(`This CSV has 101 rows. ${BATCH_SIZE_ADVICE}`)).toBeInTheDocument();
    expect(createButton()).toBeDisabled();
  });

  it("a template that was never published: says so, links to it, offers no batch", () => {
    const fetchMock = stubFetch([]);
    const onRecheck = vi.fn();
    render(
      <StepCreate
        templateId={TPL}
        canCreate
        factsAvailable={false}
        block={mintBlock({ size: null, hasTx: false }, { published: false, missing: [] })}
        onRecheck={onRecheck}
        onCreated={vi.fn()}
      />,
    );

    const notice = screen.getByTestId("mint-block");
    expect(notice).toHaveAttribute("data-kind", "not_published");
    expect(within(notice).getByText("Publish the template first.")).toBeInTheDocument();
    expect(
      within(notice).getByText("Items can only be minted from a published template."),
    ).toBeInTheDocument();
    expect(within(notice).getByRole("link", { name: /open the template/i })).toHaveAttribute(
      "href",
      `/catalog/${TPL}`,
    );

    // A perfectly good quantity still cannot be sent.
    type(/quantity/i, "20");
    expect(createButton()).toBeDisabled();
    fireEvent.click(createButton());
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(notice).getByRole("button", { name: /check again/i }));
    expect(onRecheck).toHaveBeenCalledTimes(1);
  });

  it("a published version that misses parts: names them", () => {
    render(
      <StepCreate
        templateId={TPL}
        canCreate
        factsAvailable={false}
        block={mintBlock(
          { size: null, hasTx: false },
          { published: true, missing: ["brand", "photo"] },
        )}
        onCreated={vi.fn()}
      />,
    );
    const notice = screen.getByTestId("mint-block");
    expect(notice).toHaveAttribute("data-kind", "incomplete");
    expect(
      within(notice).getByText(
        "The published version of this template is missing: Brand and a photo.",
      ),
    ).toBeInTheDocument();
    type(/quantity/i, "20");
    expect(createButton()).toBeDisabled();
  });

  it("shows the API's own sentence when it refuses a batch this screen let through", async () => {
    stubFetch([
      [
        /\/api\/catalog-proxy\/batches$/,
        () =>
          json(
            {
              error: "TEMPLATE_NOT_PUBLISHED",
              message:
                "Publish the template first. Items can only be minted from a published template.",
            },
            409,
          ),
      ],
    ]);
    const onCreated = vi.fn();
    render(<StepCreate templateId={TPL} canCreate factsAvailable={false} onCreated={onCreated} />);
    type(/quantity/i, "20");
    fireEvent.click(createButton());

    expect(
      await screen.findByText(
        "Publish the template first. Items can only be minted from a published template.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("TEMPLATE_NOT_PUBLISHED")).not.toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });
});

// ── 4. A failed mint shows its reason ────────────────────────────────────────

describe("batch step 2: why a mint failed, and when it cannot start", () => {
  const TO = "0x8aE1E82C00145d5e08b8E63DF35cA455F0aabe23";
  const FAILURE: BatchFailure = {
    code: "RELAYER_OUT_OF_FUNDS",
    message:
      "The TAG IT wallet that mints has run out of funds for network fees, so nothing was minted. " +
      "Contact TAG IT support, then retry.",
    at: "2026-11-18T10:00:00.000Z",
  };

  function renderStep(props: Partial<Parameters<typeof StepMint>[0]> = {}) {
    const onRefresh = vi.fn();
    render(
      <StepMint
        batch={makeBatch()}
        progress={{ expected: 5, minted: 0, tokens: [] }}
        role="admin"
        canExecute
        onRefresh={onRefresh}
        {...props}
      />,
    );
    return { onRefresh };
  }
  const mintButton = (name: RegExp = /mint batch/i) => screen.getByRole("button", { name });

  it("shows the reason the API recorded, word for word", () => {
    renderStep({ batch: makeBatch({ state: "mint_failed" }), failure: FAILURE });

    const box = screen.getByTestId("mint-failure");
    expect(box).toHaveAttribute("data-code", "RELAYER_OUT_OF_FUNDS");
    expect(box).toHaveTextContent(FAILURE.message);
    // The old one-size-fits-all line is gone when there is a reason.
    expect(box).not.toHaveTextContent(/last mint attempt failed/i);
    expect(mintButton(/retry mint/i)).toBeInTheDocument();
  });

  it("falls back to a plain line when no reason was recorded", () => {
    renderStep({ batch: makeBatch({ state: "mint_failed" }), failure: null });
    const box = screen.getByTestId("mint-failure");
    expect(box).toHaveAttribute("data-code", "unknown");
    expect(box).toHaveTextContent(
      "The last mint attempt failed. You can retry: the retry looks for the earlier transaction before it sends anything.",
    );
  });

  it("shows no failure on a batch that has not failed, even if one is passed", () => {
    renderStep({ batch: makeBatch({ state: "validated" }), failure: FAILURE });
    expect(screen.queryByTestId("mint-failure")).not.toBeInTheDocument();
  });

  it("a batch whose template is not published: says so and offers no mint", () => {
    const fetchMock = stubFetch([]);
    renderStep({
      block: mintBlock({ size: 5, hasTx: false }, { published: false, missing: [] }),
    });

    const notice = screen.getByTestId("mint-block");
    expect(within(notice).getByText("Publish the template first.")).toBeInTheDocument();
    expect(within(notice).getByRole("link", { name: /open the template/i })).toHaveAttribute(
      "href",
      `/catalog/${TPL}`,
    );

    type(/mint recipient/i, TO);
    expect(mintButton()).toBeDisabled();
    fireEvent.click(mintButton());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a stored batch over the limit: says so and offers no mint", () => {
    renderStep({
      batch: makeBatch({ size: 180 }),
      block: mintBlock({ size: 180, hasTx: false }, { published: true, missing: [] }),
    });
    const notice = screen.getByTestId("mint-block");
    expect(notice).toHaveAttribute("data-kind", "too_large");
    expect(within(notice).getByText("This batch has 180 items.")).toBeInTheDocument();
    expect(within(notice).getByText(BATCH_SIZE_ADVICE)).toBeInTheDocument();
    // Nothing to fix in the template, so no link there.
    expect(within(notice).queryByRole("link")).not.toBeInTheDocument();
    type(/mint recipient/i, TO);
    expect(mintButton()).toBeDisabled();
  });

  it("mints when nothing blocks", async () => {
    const fetchMock = stubFetch([
      [/\/batches\/bat_01XYZ\/execute$/, () => json({ ok: true, status: "minting" }, 202)],
    ]);
    const { onRefresh } = renderStep();
    type(/mint recipient/i, TO);
    fireEvent.click(mintButton());
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String((callsTo(fetchMock, /execute$/)[0]![1] as RequestInit).body))).toEqual(
      {
        to: TO,
      },
    );
  });

  it("shows the API's sentence when it refuses a mint, never its code", async () => {
    stubFetch([
      [
        /\/execute$/,
        () =>
          json(
            {
              error: "TEMPLATE_INCOMPLETE",
              message:
                "The published version of this template is missing: a photo. " +
                "Add what is missing, publish the template again, then mint.",
              details: { missing: ["photo"] },
            },
            409,
          ),
      ],
    ]);
    const { onRefresh } = renderStep();
    type(/mint recipient/i, TO);
    fireEvent.click(mintButton());

    expect(
      await screen.findByText(
        "The published version of this template is missing: a photo. Add what is missing, publish the template again, then mint.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("TEMPLATE_INCOMPLETE")).not.toBeInTheDocument();
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

// ── The wizard puts the pieces together ──────────────────────────────────────

describe("batch wizard: reads the template and the batch, and applies the rules", () => {
  const templateRoute = (template: TemplateDto, versions: TemplateVersionDto[]) =>
    [
      /\/api\/catalog-proxy\/templates\/tpl_01ABC$/,
      () => json({ ok: true, template, versions }),
    ] as [RegExp, () => Response];
  const NO_BATCHES: [RegExp, () => Response] = [
    /\/api\/catalog-proxy\/batches\?/,
    () => json({ ok: true, batches: [] }),
  ];

  it("a draft that was never published: step 1 is blocked", async () => {
    stubFetch([NO_BATCHES, templateRoute(makeTemplate(), [])]);
    render(<BatchWizard templateId={TPL} role="admin" initialBatchId={null} />);

    const notice = await screen.findByTestId("mint-block");
    expect(notice).toHaveAttribute("data-kind", "not_published");
    type(/quantity/i, "5");
    expect(screen.getByRole("button", { name: /validate & create batch/i })).toBeDisabled();
  });

  it("a published, complete template: step 1 is open", async () => {
    const template = makeTemplate({ status: "published", version: 1 });
    stubFetch([NO_BATCHES, templateRoute(template, [versionOf(template)])]);
    render(<BatchWizard templateId={TPL} role="admin" initialBatchId={null} />);

    await screen.findByText("Renewal Cream");
    expect(screen.queryByTestId("mint-block")).not.toBeInTheDocument();
    type(/quantity/i, "5");
    expect(screen.getByRole("button", { name: /validate & create batch/i })).toBeEnabled();
  });

  it("fixed in the editor but not published again: still blocked, by the published version", async () => {
    const published = makeTemplate({ status: "published", version: 1, attributes: null });
    const working = makeTemplate({ status: "published", version: 1 }); // photo added since
    stubFetch([NO_BATCHES, templateRoute(working, [versionOf(published)])]);
    render(<BatchWizard templateId={TPL} role="admin" initialBatchId={null} />);

    const notice = await screen.findByTestId("mint-block");
    expect(notice).toHaveAttribute("data-kind", "incomplete");
    expect(
      within(notice).getByText("The published version of this template is missing: A photo."),
    ).toBeInTheDocument();
  });

  it("a failed batch shows the reason that came with its status", async () => {
    const template = makeTemplate({ status: "published", version: 1 });
    stubFetch([
      NO_BATCHES,
      templateRoute(template, [versionOf(template)]),
      [
        /\/api\/catalog-proxy\/batches\/bat_01XYZ$/,
        () =>
          json({
            ok: true,
            batch: makeBatch({ state: "mint_failed" }),
            progress: { expected: 5, minted: 0, tokens: [] },
            failure: {
              code: "MINT_REFUSED",
              message:
                "The registry refused the mint, so nothing was minted. Retry once. If it fails again, contact TAG IT support.",
              at: "2026-11-18T10:00:00.000Z",
            },
          }),
      ],
    ]);
    render(<BatchWizard templateId={TPL} role="admin" initialBatchId={BAT} />);

    const box = await screen.findByTestId("mint-failure");
    expect(box).toHaveAttribute("data-code", "MINT_REFUSED");
    expect(box).toHaveTextContent("The registry refused the mint, so nothing was minted.");
    // The template is fine, so the retry is offered.
    expect(screen.queryByTestId("mint-block")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry mint/i })).toBeInTheDocument();
  });

  it("a failed batch from an API that sends no reason still loads", async () => {
    const template = makeTemplate({ status: "published", version: 1 });
    stubFetch([
      NO_BATCHES,
      templateRoute(template, [versionOf(template)]),
      [
        /\/api\/catalog-proxy\/batches\/bat_01XYZ$/,
        () =>
          json({
            ok: true,
            batch: makeBatch({ state: "mint_failed" }),
            progress: { expected: 5, minted: 0, tokens: [] },
          }),
      ],
    ]);
    render(<BatchWizard templateId={TPL} role="admin" initialBatchId={BAT} />);
    expect(await screen.findByTestId("mint-failure")).toHaveAttribute("data-code", "unknown");
  });

  it("a waiting batch on a never-published template: step 2 is blocked", async () => {
    stubFetch([
      NO_BATCHES,
      templateRoute(makeTemplate(), []),
      [
        /\/api\/catalog-proxy\/batches\/bat_01XYZ$/,
        () =>
          json({
            ok: true,
            batch: makeBatch(),
            progress: { expected: 5, minted: 0, tokens: [] },
            failure: null,
          }),
      ],
    ]);
    render(<BatchWizard templateId={TPL} role="admin" initialBatchId={BAT} />);

    const notice = await screen.findByTestId("mint-block");
    expect(notice).toHaveAttribute("data-kind", "not_published");
    expect(screen.getByRole("button", { name: /mint batch/i })).toBeDisabled();
  });

  it("a failed batch with a transaction on record is never blocked", async () => {
    // Its mint may already have landed. The retry has to be allowed to finish it.
    stubFetch([
      NO_BATCHES,
      templateRoute(makeTemplate(), []),
      [
        /\/api\/catalog-proxy\/batches\/bat_01XYZ$/,
        () =>
          json({
            ok: true,
            batch: makeBatch({ state: "mint_failed", txHash: `0x${"ab".repeat(32)}` }),
            progress: { expected: 5, minted: 0, tokens: [] },
            failure: null,
          }),
      ],
    ]);
    render(<BatchWizard templateId={TPL} role="admin" initialBatchId={BAT} />);

    await screen.findByTestId("mint-failure");
    expect(screen.queryByTestId("mint-block")).not.toBeInTheDocument();
  });
});

// ── 5. Activate & list for the bound part of a batch ─────────────────────────

describe("Activate & list: the bound part of a batch", () => {
  const TOKENS: Array<{
    tokenId: string;
    lifecycle: string;
    tagUid: string | null;
    serial: string;
    chainState?: string | null;
  }> = [
    { tokenId: "71", lifecycle: "bound", tagUid: "04AA", serial: "SN-1" },
    { tokenId: "72", lifecycle: "anchored", tagUid: "04AB", serial: "SN-2" },
    { tokenId: "73", lifecycle: "minted", tagUid: null, serial: "SN-3" },
    { tokenId: "74", lifecycle: "minted", tagUid: null, serial: "SN-4" },
    { tokenId: "75", lifecycle: "minted", tagUid: null, serial: "SN-5" },
  ];
  const TEMPLATE_ROUTE: [RegExp, () => Response] = [
    /\/api\/catalog-proxy\/templates\/tpl_01ABC$/,
    () => json({ ok: true, template: makeTemplate({ priceUsdc6: "24000000" }), versions: [] }),
  ];

  it("the panel sends only the bound tokens and says the rest still waits", async () => {
    const fetchMock = stubFetch([
      TEMPLATE_ROUTE,
      [
        /\/binding\/activate$/,
        () =>
          json({
            ok: true,
            activated: ["71", "72"],
            alreadyActive: [],
            skipped: [],
            listed: ["71", "72"],
            alreadyListed: [],
            listErrors: [],
          }),
      ],
    ]);
    const onDone = vi.fn();
    render(
      <ActivateListPanel
        templateId={TPL}
        tokens={TOKENS}
        writable
        pendingCount={3}
        onDone={onDone}
      />,
    );

    expect(screen.getByText("2 bound")).toBeInTheDocument();
    expect(screen.getByTestId("activate-partial")).toHaveTextContent(
      "3 items still wait for a tag. This button only touches the bound ones; use it again after binding the rest.",
    );
    // The template's price arrives as the default.
    await waitFor(() => expect(screen.getByLabelText(/list price/i)).toHaveValue("24"));

    // Two clicks: arm, then confirm.
    fireEvent.click(screen.getByRole("button", { name: /activate & list 2/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm: activate 2/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const sent = callsTo(fetchMock, /\/binding\/activate$/);
    expect(sent).toHaveLength(1);
    expect(JSON.parse(String((sent[0]![1] as RequestInit).body))).toEqual({
      tokenIds: ["71", "72"],
      priceUsdc: "24",
    });
    expect(await screen.findByText("Done")).toBeInTheDocument();
  });

  it("says nothing about waiting items when the batch is fully bound", () => {
    stubFetch([TEMPLATE_ROUTE]);
    render(<ActivateListPanel templateId={TPL} tokens={TOKENS.slice(0, 2)} writable />);
    expect(screen.queryByTestId("activate-partial")).not.toBeInTheDocument();
  });

  it("one item waiting reads in the singular", () => {
    stubFetch([TEMPLATE_ROUTE]);
    render(<ActivateListPanel templateId={TPL} tokens={TOKENS} writable pendingCount={1} />);
    expect(screen.getByTestId("activate-partial")).toHaveTextContent(
      "1 item still waits for a tag.",
    );
  });

  describe("at the binding station", () => {
    const statusRoute = (tokens: typeof TOKENS): [RegExp, () => Response] => [
      /\/api\/catalog-proxy\/batches\/bat_01XYZ$/,
      () =>
        json({
          ok: true,
          batch: makeBatch({ state: "minted", size: tokens.length }),
          progress: { expected: tokens.length, minted: tokens.length, tokens },
        }),
    ];
    const renderStation = () =>
      render(
        <BindingStation
          batchId={BAT}
          role="admin"
          templateId={TPL}
          exceptionsTab={<div>exceptions</div>}
        />,
      );

    it("part of the batch bound: one line offers it, and opening it shows the panel", async () => {
      stubFetch([statusRoute(TOKENS), TEMPLATE_ROUTE]);
      renderStation();

      const offer = await screen.findByTestId("activate-offer");
      expect(offer).toHaveAttribute("data-kind", "waiting");
      expect(offer).toHaveTextContent(
        "2 bound items can go on sale now, before the rest of the batch is bound.",
      );
      // Binding stays the main work: the next item to bind is still on screen.
      expect(screen.getByText(/3 to go/)).toBeInTheDocument();
      // The full panel is not open until asked for.
      expect(screen.queryByLabelText(/list price/i)).not.toBeInTheDocument();

      fireEvent.click(within(offer).getByRole("button", { name: /activate & list/i }));

      expect(await screen.findByLabelText(/list price/i)).toBeInTheDocument();
      expect(screen.getByText("2 bound")).toBeInTheDocument();
      expect(screen.getByTestId("activate-partial")).toHaveTextContent("3 items still wait");
      expect(screen.queryByTestId("activate-offer")).not.toBeInTheDocument();
    });

    it("bound items that are already activated are not announced as waiting, but the panel stays within reach", async () => {
      // After a reload: both bound items are activated. One of them may have
      // been activated without a price, and this panel is the station's only
      // way to list it. So the line is quieter, and it still opens the panel.
      stubFetch([
        statusRoute(
          TOKENS.map((t) => (t.lifecycle === "minted" ? t : { ...t, chainState: "ACTIVATED" })),
        ),
        TEMPLATE_ROUTE,
      ]);
      renderStation();

      const offer = await screen.findByTestId("activate-offer");
      expect(offer).toHaveAttribute("data-kind", "activated");
      expect(offer).toHaveTextContent(
        "2 bound items are already activated. If one has no price yet, you can list it here.",
      );
      expect(offer).not.toHaveTextContent("can go on sale now");
      expect(screen.queryByLabelText(/list price/i)).not.toBeInTheDocument();

      fireEvent.click(within(offer).getByRole("button", { name: /activate & list/i }));

      expect(await screen.findByLabelText(/list price/i)).toBeInTheDocument();
      expect(screen.getByText("2 bound")).toBeInTheDocument();
      expect(screen.queryByTestId("activate-offer")).not.toBeInTheDocument();
    });

    it("one activated item reads in the singular", async () => {
      stubFetch([
        statusRoute([
          { ...TOKENS[0]!, chainState: "ACTIVATED" },
          { ...TOKENS[1]!, lifecycle: "minted", tagUid: null },
          ...TOKENS.slice(2),
        ]),
        TEMPLATE_ROUTE,
      ]);
      renderStation();
      expect(await screen.findByTestId("activate-offer")).toHaveTextContent(
        "1 bound item is already activated. If it has no price yet, you can list it here.",
      );
    });

    it("bound items that are sold leave nothing to offer", async () => {
      stubFetch([
        statusRoute(
          TOKENS.map((t) => (t.lifecycle === "minted" ? t : { ...t, chainState: "CLAIMED" })),
        ),
        TEMPLATE_ROUTE,
      ]);
      renderStation();
      await screen.findByText(/3 to go/);
      expect(screen.queryByTestId("activate-offer")).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/list price/i)).not.toBeInTheDocument();
    });

    it("counts only what still waits: one activated, one bound → one offered", async () => {
      stubFetch([
        statusRoute([
          { ...TOKENS[0]!, chainState: "ACTIVATED" },
          { ...TOKENS[1]!, chainState: "BOUND" },
          ...TOKENS.slice(2),
        ]),
        TEMPLATE_ROUTE,
      ]);
      renderStation();
      const offer = await screen.findByTestId("activate-offer");
      // Something waits, so the line speaks up, whatever else is activated.
      expect(offer).toHaveAttribute("data-kind", "waiting");
      expect(offer).toHaveTextContent(
        "1 bound item can go on sale now, before the rest of the batch is bound.",
      );
    });

    it("nothing bound yet: no offer", async () => {
      stubFetch([
        statusRoute(TOKENS.map((t) => ({ ...t, lifecycle: "minted", tagUid: null }))),
        TEMPLATE_ROUTE,
      ]);
      renderStation();
      await screen.findByText(/5 to go/);
      expect(screen.queryByTestId("activate-offer")).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/list price/i)).not.toBeInTheDocument();
    });

    it("the whole batch bound: the panel is there at once, as before", async () => {
      stubFetch([
        statusRoute(TOKENS.map((t) => ({ ...t, lifecycle: "bound", tagUid: "04AA" }))),
        TEMPLATE_ROUTE,
      ]);
      renderStation();
      expect(await screen.findByLabelText(/list price/i)).toBeInTheDocument();
      expect(screen.getByText("5 bound")).toBeInTheDocument();
      expect(screen.queryByTestId("activate-offer")).not.toBeInTheDocument();
      expect(screen.queryByTestId("activate-partial")).not.toBeInTheDocument();
    });
  });
});
