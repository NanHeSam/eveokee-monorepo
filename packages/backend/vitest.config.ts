import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "convex/**/*.test.{ts,tsx}",
      "convex/**/__tests__/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["convex/_generated/**", "node_modules/**"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
