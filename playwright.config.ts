import { defineConfig, devices } from "@playwright/test";

/**
 * 画面の通し確認。
 *
 * 型検査・単体テスト・描画テストをすべて通しても、
 * 「画面をつないで操作したときだけ壊れる」不具合は残る。
 * 実際に、復習の2問目に1問目の判定が出たまま問題がすり替わる不具合が
 * この層でしか見つからなかった（呼び出し側が毎レンダーで配列を作り直していた）。
 *
 * これまでは手元で Playwright を回して確かめていたが、
 * 手で回す確認は回さなくなったときに黙って抜ける。
 *
 * 本番と同じ構成で確かめるため、`vite preview` ではなく
 * ビルド済みのサーバー（dist/server.cjs）を立てる。
 * preview は静的ファイルしか返さず API が無いので、
 * サーバー側の応答が絡む画面を確かめられない。
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  // CI では失敗を1回だけやり直す（外部要因の揺れと本当の不具合を分けるため）
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://localhost:4180",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // NODE_ENV は渡さない。利用者が `npm start` で動かすのと同じ条件にする。
    // ここで NODE_ENV=production を足していたため、
    // 「NODE_ENV が無いとビルド済みではなく開発用サーバーが動く」不具合を
    // 通し確認がすり抜けていた
    command: "node dist/server.cjs",
    url: "http://localhost:4180",
    env: { PORT: "4180" },
    timeout: 60_000,
    reuseExistingServer: !process.env.CI
  }
});
