import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      // Render pages without a connected wallet so E2E can exercise them.
      NEXT_PUBLIC_E2E: "true",
      // META-T32 auth: bypass the session gate as a signed-in admin — the
      // seam is CI/dev-only (dead in production builds, see lib/e2e-auth.ts).
      // Without it every page 307s to /api/auth/signin, which 500s with no
      // real AUTH_SECRET, and the readiness probe (which follows redirects)
      // times out after 120s — the post-T32 E2E failure mode.
      E2E_AUTH_BYPASS: "true",
      // Dummy secret so the NextAuth wrapper itself stops throwing
      // MissingSecret on every request. Not a credential.
      AUTH_SECRET: "e2e-only-dummy-secret-not-a-credential",
    },
  },
});
