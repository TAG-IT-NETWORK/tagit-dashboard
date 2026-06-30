import { test, expect } from "@playwright/test";

/**
 * P1 — dedicated /pricing page (crypto-native: verification free, USDC usage, first-5 free).
 * (Runs once the Playwright runner is wired into CI without perturbing the runtime tree.)
 */

test.describe("P1 pricing", () => {
  test("renders tiers, comparison, free-5, and FAQ", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "Simple, honest pricing" })).toBeVisible();
    for (const tier of ["Verify", "Build", "Scale"]) {
      await expect(page.getByText(tier, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText(/First 5 businesses: free Build seat/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Compare plans" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Frequently asked" })).toBeVisible();
  });

  test("landing nav links to the pricing page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation").getByText("Pricing").click();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole("heading", { name: "Simple, honest pricing" })).toBeVisible();
  });
});
