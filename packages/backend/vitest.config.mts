import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    globals: true,
    include: [
      "convex/**/*.test.{ts,tsx}",
      "__tests__/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["convex/_generated/**", "node_modules/**"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
    // Required for convex-test to work properly
    server: {
      deps: {
        inline: ["convex-test"],
      },
    },
  },
});
