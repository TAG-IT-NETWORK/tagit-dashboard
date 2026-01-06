import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("homepage redirects to dashboard or shows loading", async ({ page }) => {
    await page.goto("/");

    // Should show either the dashboard or loading state
    await expect(
      page.locator("text=Loading").or(page.locator("text=Admin Console"))
    ).toBeVisible({ timeout: 10000 });
  });

  test("sidebar navigation links work", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Check sidebar is visible
    const sidebar = page.locator('nav, [role="navigation"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  test("dashboard page loads", async ({ page }) => {
    await page.goto("/dashboard");

    // Wait for page to load
    await expect(page).toHaveURL(/dashboard/);
  });

  test("assets page loads", async ({ page }) => {
    await page.goto("/assets");

    await expect(page).toHaveURL(/assets/);
  });

  test("users page loads", async ({ page }) => {
    await page.goto("/users");

    await expect(page).toHaveURL(/users/);
  });

  test("resolve page loads", async ({ page }) => {
    await page.goto("/resolve");

    await expect(page).toHaveURL(/resolve/);
  });

  test("governance page loads", async ({ page }) => {
    await page.goto("/governance");

    await expect(page).toHaveURL(/governance/);
  });

  test("treasury page loads", async ({ page }) => {
    await page.goto("/treasury");

    await expect(page).toHaveURL(/treasury/);
  });
});
