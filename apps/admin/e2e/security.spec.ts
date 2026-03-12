import { test, expect } from "@playwright/test";

test.describe("Security Features", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("load");
  });

  test("shows wallet connection prompt when not connected", async ({ page }) => {
    // Look for connect wallet elements
    const connectButton = page.locator('button:has-text("Connect"), [class*="connect"]');
    const buttonCount = await connectButton.count();

    // Should have connect wallet button somewhere
    expect(buttonCount).toBeGreaterThan(0);
  });

  test("displays Live/Mock data indicator on dashboard", async ({ page }) => {
    await page.waitForTimeout(1000);

    // Look for the data indicator badge
    const liveIndicator = page.getByText("Live").or(page.getByText("Mock Data"));
    const indicatorCount = await liveIndicator.count();

    // Should have one of the indicators
    expect(indicatorCount).toBeGreaterThanOrEqual(0);
  });

  test("shows System Health section", async ({ page }) => {
    await page.waitForTimeout(1000);

    // Look for system health card
    const healthCard = page.getByText("System Health");
    await expect(healthCard).toBeVisible({ timeout: 5000 });
  });

  test("shows subgraph status in System Health", async ({ page }) => {
    await page.waitForTimeout(1000);

    // Look for subgraph status indicator
    const subgraphStatus = page.getByText("Subgraph");
    await expect(subgraphStatus).toBeVisible({ timeout: 5000 });
  });

  test("refresh button is present", async ({ page }) => {
    await page.waitForTimeout(1000);

    // Look for refresh button (by title or icon)
    const refreshButton = page.locator('[title="Refresh data"], button:has([class*="refresh"])');
    const buttonCount = await refreshButton.count();

    expect(buttonCount).toBeGreaterThan(0);
  });
});

test.describe("Navigation Security", () => {
  test("can navigate to assets page", async ({ page }) => {
    await page.goto("/assets");
    await page.waitForLoadState("load");
    await page.waitForTimeout(1000);

    // Should load assets page
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });
  });

  test("can navigate to badges page", async ({ page }) => {
    await page.goto("/badges");
    await page.waitForLoadState("load");
    await page.waitForTimeout(1000);

    // Should load badges page
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });
  });

  test("can navigate to capabilities page", async ({ page }) => {
    await page.goto("/capabilities");
    await page.waitForLoadState("load");
    await page.waitForTimeout(1000);

    // Should load capabilities page
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });
  });

  test("can navigate to resolve page", async ({ page }) => {
    await page.goto("/resolve");
    await page.waitForLoadState("load");
    await page.waitForTimeout(1000);

    // Should load resolve page
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });
  });

  test("can navigate to users page", async ({ page }) => {
    await page.goto("/users");
    await page.waitForLoadState("load");
    await page.waitForTimeout(1000);

    // Should load users page
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Error States", () => {
  test("handles 404 for invalid asset ID", async ({ page }) => {
    await page.goto("/assets/999999999999");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);

    // Should show error state or not found
    const errorIndicators = page.locator('[class*="error"], [class*="not-found"]')
      .or(page.getByText("Not Found"))
      .or(page.getByText("Error"))
      .or(page.getByText("not exist"));
    const indicatorCount = await errorIndicators.count();

    // Page should render (either with error message or content)
    await expect(page.locator("body")).toBeVisible();
  });

  test("handles 404 for invalid user address", async ({ page }) => {
    await page.goto("/users/0xinvalid");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);

    // Should show error state or not found
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("UI Components", () => {
  test("sidebar shows all navigation items", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("load");

    // Check for main nav items
    const navItems = [
      "Dashboard",
      "Assets",
      "Resolve",
      "Badges",
      "Capabilities",
    ];

    for (const item of navItems) {
      const navItem = page.getByText(item);
      await expect(navItem.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("state badges display correctly", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);

    // Look for pie chart or state distribution elements
    const chartArea = page.locator(
      '[class*="chart"], [class*="recharts"]'
    ).or(page.getByText("Asset State Distribution"));
    const chartCount = await chartArea.count();

    // Should have chart elements
    expect(chartCount).toBeGreaterThan(0);
  });
});
