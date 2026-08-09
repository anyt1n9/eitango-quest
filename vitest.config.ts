import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * テストは2種類ある。
 *
 * - node : 副作用の無いモジュールと収録データ、サーバーのHTTP層（tests/*.test.ts）
 * - dom  : 画面の描画（tests/*.test.tsx）。jsdom と React のJSX変換が要る
 *
 * 環境が違うので分けている。どちらも `npm test` で一緒に走る。
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: ["tests/**/*.test.ts"],
          environment: "node",
          // 7,744語の突き合わせを行うデータテストがあるため既定より長めにとる
          testTimeout: 30000
        }
      },
      {
        plugins: [react()],
        test: {
          name: "dom",
          include: ["tests/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["tests/setupDom.ts"],
          testTimeout: 30000
        }
      }
    ]
  }
});
