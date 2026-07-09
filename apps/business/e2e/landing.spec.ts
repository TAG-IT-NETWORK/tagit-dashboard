import { test, expect } from "@playwright/test";

/**
 * P1 — public marketing/explainer landing (pro.tagit.network).
 * Verifies the non-wallet-gated funnel a disconnected visitor sees:
 * hero → 4-step journey → features → pricing (free banner + 2 tiers) → request-access form.
 */

const JOURNEY_STEPS = ["Register the product", "Attach the smart tag", "Approve it for sale"];

test.describe("P1 landing", () => {
  test("renders the full explainer funnel for disconnected visitors", async ({ page }) => {
    await page.goto("/");

    // Hero — plain-English value prop, demo-first CTA
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Prove your products are real",
    );
    await expect(page.getByText(/Free verification for your customers/)).toBeVisible();

    // How it works — actor-grouped journey, no raw contract states
    await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
    for (const step of JOURNEY_STEPS) {
      await expect(page.getByRole("heading", { name: step })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: /Tap to verify/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Protected for life" })).toBeVisible();

    // Features
    await expect(
      page.getByRole("heading", { name: "Everything you need to sell verified goods" }),
    ).toBeVisible();
    await expect(page.getByText("AI assistants for your inventory")).toBeVisible();
    await expect(page.getByText("Lost or stolen? Recoverable.")).toBeVisible();

    // Pricing — free banner + two purchasable tiers with distinct CTAs
    await expect(page.getByRole("heading", { name: /Verification is free/i })).toBeVisible();
    await expect(page.getByText(/First 5 businesses: free early-access seat/i)).toBeVisible();
    await expect(page.getByText(/no app, no account, no wallet/i)).toBeVisible();
    await expect(page.getByText("Pay as you go")).toBeVisible();
    await expect(page.getByRole("link", { name: "Talk to sales" })).toBeVisible();

    // Conversion CTAs are reachable without a wallet
    await expect(page.getByRole("link", { name: "Request a demo" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Launch app" }).first()).toBeVisible();
  });

  test("request-access form validates and reaches the success state", async ({ page }) => {
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

  test("collapses the desktop nav on mobile widths", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The in-header nav links are hidden below the md breakpoint.
    await expect(page.locator("nav").getByText("How it works")).toBeHidden();
  });
});
