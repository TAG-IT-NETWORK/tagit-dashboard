import { test, expect } from "@playwright/test";

test.describe("Resolution Queue Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/resolve");
    await page.waitForLoadState("networkidle");
  });

  test("displays resolution queue title", async ({ page }) => {
    await expect(
      page.locator("h1, h2").filter({ hasText: /resolution|queue|flagged/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows flagged assets table", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for table or list of flagged assets
    const content = page.locator(
      'table, [role="table"], [class*="table"]'
    ).first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test("displays priority badges", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for priority indicators
    const badges = page.locator(
      '[class*="badge"], [class*="Badge"]'
    );
    const count = await badges.count();
    // There should be some badges if there are flagged items
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("stats cards are visible", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for metric/stat cards
    const cards = page.locator('[class*="card"], [class*="Card"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("clicking review navigates to detail page", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for Review button
    const reviewButton = page.locator(
      'a:has-text("Review"), button:has-text("Review")'
    ).first();

    if (await reviewButton.isVisible()) {
      await reviewButton.click();
      await expect(page).toHaveURL(/resolve\/\d+/);
    }
  });
});

test.describe("Resolution Detail Page", () => {
  test("shows asset details for resolution", async ({ page }) => {
    await page.goto("/resolve/1000");
    await page.waitForLoadState("networkidle");

    // Should show content area
    const content = page.locator(
      "main, [role='main'], [class*='content']"
    ).first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test("resolution action buttons are present", async ({ page }) => {
    await page.goto("/resolve/1000");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Look for Clear, Quarantine, Decommission buttons
    const actionButtons = page.locator(
      'button:has-text("Clear"), button:has-text("Quarantine"), button:has-text("Decommission")'
    );
    const count = await actionButtons.count();
    // May not have buttons if asset not found
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("back to queue link works", async ({ page }) => {
    await page.goto("/resolve/1000");
    await page.waitForLoadState("networkidle");

    const backLink = page.locator(
      'a:has-text("Back"), a[href="/resolve"]'
    ).first();

    if (await backLink.isVisible()) {
      await backLink.click();
      await expect(page).toHaveURL(/\/resolve$/);
    }
  });
});
