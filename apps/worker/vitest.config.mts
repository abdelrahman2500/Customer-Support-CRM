import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts", "test/**/*.e2e-spec.ts"],
    environment: "node",
    globals: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
