import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests for the pure verify-app libs (revalidate guard, media loader,
// JSON-LD, anchor verdict). Node environment — no DOM, no network, no chain.
export default defineConfig({
  // Match Next's SWC output: JSX compiles against react/jsx-runtime, so a
  // component under test never needs `React` in scope (esbuild's default here
  // is the classic React.createElement transform, which would make rendering
  // price-block.tsx throw "React is not defined").
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // The `server-only` poison-pill is a build-time guard for Next bundles;
      // in vitest it must resolve to an empty module.
      "server-only": path.resolve(__dirname, "./test/server-only-stub.ts"),
    },
  },
});
