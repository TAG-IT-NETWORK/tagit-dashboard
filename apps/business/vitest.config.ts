import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    server: {
      deps: {
        // next-auth ships ESM that imports "next/server" without an extension;
        // let Vite process it instead of Node's resolver.
        inline: ["next-auth", "@auth/core"],
      },
    },
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
