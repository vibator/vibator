import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      reportOnFailure: true,
      include: ["src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "src/schema.ts",
        "src/catalog.ts",
        "src/cli.ts",
      ],
    },
  },
});
