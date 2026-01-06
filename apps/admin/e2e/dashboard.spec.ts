import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("displays page title", async ({ page }) => {
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });
  });

  test("displays metric cards", async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(2000);

    // Check that some metric-like elements are present
    const cards = page.locator('[class*="card"], [class*="Card"]');
    const cardCount = await cards.count();

    // Should have at least some cards
    expect(cardCount).toBeGreaterThan(0);
  });

  test("header is visible", async ({ page }) => {
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
  });

  test("sidebar is visible", async ({ page }) => {
    // Look for sidebar navigation
    const sidebar = page.locator(
      'aside, nav, [class*="sidebar"], [class*="Sidebar"]'
    ).first();
    await expect(sidebar).toBeVisible();
  });

  test("admin console title is shown in header", async ({ page }) => {
    await expect(page.locator("text=Admin Console")).toBeVisible();
  });
});
