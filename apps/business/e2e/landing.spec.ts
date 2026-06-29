import { test, expect } from "@playwright/test";

/**
 * P1 — public marketing/explainer landing (pro.tagit.network).
 * Verifies the non-wallet-gated funnel a disconnected visitor sees:
 * hero → 7-state lifecycle → features → pricing teaser → request-access form.
 */

const LIFECYCLE_STATES = [
  "None",
  "Minted",
  "Bound",
  "Activated",
  "Claimed",
  "Flagged",
  "Recycled",
];

test.describe("P1 landing", () => {
  test("renders the full explainer funnel for disconnected visitors", async ({ page }) => {
    await page.goto("/");

    // Hero
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Verified by the chain");
    await expect(page.getByText("Free verification · Built on Base")).toBeVisible();

    // How it works — the 7-state lifecycle
    await expect(page.getByRole("heading", { name: "One lifecycle, end to end" })).toBeVisible();
    for (const state of LIFECYCLE_STATES) {
      await expect(page.getByText(state, { exact: true }).first()).toBeVisible();
    }

    // Features
    await expect(
      page.getByRole("heading", { name: "Everything to run verified commerce" }),
    ).toBeVisible();
    await expect(page.getByText("Autonomous agents")).toBeVisible();
    await expect(page.getByText("Recovery (AIRP)")).toBeVisible();

    // Pricing teaser — crypto-native + free-first-5
    await expect(page.getByRole("heading", { name: /Verification is free/i })).toBeVisible();
    await expect(page.getByText(/First 5 businesses: free early-access seat/i)).toBeVisible();
    await expect(page.getByText("Pay-as-you-go · USDC")).toBeVisible();

    // Conversion CTA is reachable without a wallet
    await expect(page.getByRole("button", { name: "Connect Wallet" }).first()).toBeVisible();
  });

  test("request-access form validates and reaches the success state", async ({ page }) => {
    // Make the success path deterministic — don't hit real tagit-services.
    await page.route("**/api/demo-request", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, id: "lead_test_1" }),
      }),
    );

    await page.goto("/");

    const form = page.locator("#get-started");
    const submit = form.getByRole("button", { name: "Request a demo" });

    await expect(submit).toBeDisabled();

    await form.getByRole("textbox", { name: "Your name" }).fill("Jane Doe");
    await form.getByRole("textbox", { name: "Work email" }).fill("jane@acme.com");
    await form.getByRole("textbox", { name: "Company" }).fill("Acme Goods Inc.");

    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByText("You're on the list")).toBeVisible();
  });

  test("request-access form surfaces an error when the proxy fails", async ({ page }) => {
    // Simulate the dashboard proxy reporting that tagit-services is unreachable.
    await page.route("**/api/demo-request", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "upstream_unavailable" }),
      }),
    );

    await page.goto("/");

    const form = page.locator("#get-started");
    const submit = form.getByRole("button", { name: "Request a demo" });

    await form.getByRole("textbox", { name: "Your name" }).fill("Jane Doe");
    await form.getByRole("textbox", { name: "Work email" }).fill("jane@acme.com");
    await form.getByRole("textbox", { name: "Company" }).fill("Acme Goods Inc.");

    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(form.getByRole("alert")).toBeVisible();
    await expect(form.getByText(/something went wrong/i)).toBeVisible();
    // The form stays put so the user can retry.
    await expect(submit).toBeVisible();
    await expect(page.getByText("You're on the list")).toHaveCount(0);
  });

  test("collapses the desktop nav on mobile widths", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The in-header nav links are hidden below the md breakpoint.
    await expect(page.locator("nav").getByText("How it works")).toBeHidden();
  });
});
