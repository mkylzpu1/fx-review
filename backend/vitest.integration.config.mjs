import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    globals: true,
    // インテグレーションテストはDBが必要なため直列実行
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30000,
  },
});
