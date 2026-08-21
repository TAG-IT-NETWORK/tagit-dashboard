import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.tsx"],
    globals: true,
    server: {
      deps: {
        // next-auth ships ESM that imports "next/server" (extensionless);
        // Node's resolver rejects that outside a bundler, so let Vite
        // process these packages instead (META-T32).
        inline: ["next-auth", "@auth/core"],
      },
    },
    include: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "test/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/e2e/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tagit/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@tagit/contracts": path.resolve(__dirname, "../../packages/contracts/src"),
      "@tagit/auth": path.resolve(__dirname, "../../packages/auth/src"),
      "@tagit/config": path.resolve(__dirname, "../../packages/config/src"),
    },
  },
});
