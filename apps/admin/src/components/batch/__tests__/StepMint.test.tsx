import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StepMint } from "../step-mint";
import type { BatchDto } from "@/lib/catalog/batch-types";

/** TAP-T17: the mint step asks for an address only when the product has no brand. */

const ADDR = "0x8aE1E82C00145d5e08b8E63DF35cA455F0aabe23";
const batch = {
  id: "bat_01TESTBATCH000000000000000",
  templateId: "tpl_01TESTTEMPLATE0000000000000",
  size: 3,
  state: "validated",
  txHash: null,
  facts: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as unknown as BatchDto;

let fetchMock: ReturnType<typeof vi.fn>;
const onRefresh = vi.fn();
const onRecheck = vi.fn();
const show = (brandId: string | null | undefined) =>
  render(
    <StepMint
      batch={batch}
      progress={null}
      role="operator"
      canExecute
      onRefresh={onRefresh}
      onRecheck={onRecheck}
      brandId={brandId}
    />,
  );
const sentBody = () =>
  JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));

beforeEach(() => {
  onRefresh.mockClear();
  onRecheck.mockClear();
  localStorage.clear();
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 202 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StepMint: who receives the batch", () => {
  it("for a brand's product: no address field, says where the items go, and mints with no address", async () => {
    show("aura-skin");
    expect(screen.queryByLabelText(/Mint recipient/)).toBeNull();
    // No field of any kind to type an address into.
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByTestId("mint-to-brand")).toHaveTextContent("aura-skin");
    expect(screen.getByTestId("mint-to-brand")).toHaveTextContent("Brands page");

    const button = screen.getByRole("button", { name: /Mint batch/ });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]![0]).toBe(`/api/catalog-proxy/batches/${batch.id}/execute`);
    expect(sentBody()).toEqual({});
    // Nothing is remembered as "the address" from a brand's batch.
    expect(localStorage.getItem("tagit.admin.batch.mintTo")).toBeNull();
  });

  it("for a brand's product: an address remembered from an earlier batch is not sent", async () => {
    localStorage.setItem("tagit.admin.batch.mintTo", ADDR);
    show("aura-skin");
    await userEvent.click(screen.getByRole("button", { name: /Mint batch/ }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect(sentBody()).toEqual({});
    // And the brand's batch does not overwrite what was remembered.
    expect(localStorage.getItem("tagit.admin.batch.mintTo")).toBe(ADDR);
  });

  it("for a product with no brand: asks for an address and sends it", async () => {
    show(null);
    expect(screen.queryByTestId("mint-to-brand")).toBeNull();
    const button = screen.getByRole("button", { name: /Mint batch/ });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Mint recipient/), ADDR);
    expect(button).toBeEnabled();
    await userEvent.click(button);
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect(sentBody()).toEqual({ to: ADDR });
  });

  it("shows the sentence tagit-services wrote when the brand has no mint wallet", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "BRAND_MINT_WALLET_MISSING",
          message: "This brand has no mint wallet yet. Set it on the Brands page, then mint again.",
        }),
        { status: 409 },
      ),
    );
    show("aura-skin");
    await userEvent.click(screen.getByRole("button", { name: /Mint batch/ }));
    expect(await screen.findByText(/This brand has no mint wallet yet/)).toBeInTheDocument();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("while the product has not been read: no address field, no minting, and a way to check again", async () => {
    // An address remembered from an earlier batch must not make this mintable.
    localStorage.setItem("tagit.admin.batch.mintTo", ADDR);
    show(undefined);
    expect(screen.getByTestId("mint-to-unknown")).toHaveTextContent("brand is not known");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByTestId("mint-to-brand")).toBeNull();
    const button = screen.getByRole("button", { name: /Mint batch/ });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(onRecheck).toHaveBeenCalledTimes(1);
  });

  it("with no brand given at all it is not known, never 'no brand'", () => {
    render(
      <StepMint batch={batch} progress={null} role="operator" canExecute onRefresh={onRefresh} />,
    );
    expect(screen.getByTestId("mint-to-unknown")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mint batch/ })).toBeDisabled();
  });
});
