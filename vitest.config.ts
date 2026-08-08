import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // 7,744語の突き合わせを行うデータテストがあるため既定より長めにとる
    testTimeout: 30000
  }
});
