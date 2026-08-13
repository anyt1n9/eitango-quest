import { describe, it, expect, afterEach } from "vitest";
import { isDevServer } from "../server";

/**
 * 開発サーバーと本番サーバーの取り違え。
 *
 * 判定は `NODE_ENV !== "production"` で行っていたが、
 * `npm start`（node dist/server.cjs）は NODE_ENV を設定しない。
 * そのため本番のつもりで起動しても開発用の Vite ミドルウェアが動き、
 *   - dist/index.html ではなく開発用のHTMLが返る（@react-refresh 入り）
 *   - /sw.js と /manifest.webmanifest にも index.html が返るので
 *     サービスワーカーが登録されず、オフラインで開けない
 *   - 実行時には要らないはずの vite（devDependency）が必要になる
 *     （--omit=dev で入れた本番環境では起動に失敗する）
 * という状態だった。実測で「サービスワーカー: なし」になっていた。
 *
 * 起動のしかたそのものは自動で確かめにくいので、判定だけを固定する。
 * 「サービスワーカーが登録されること」は e2e が本物のブラウザで見る。
 */

const originalArgv = process.argv[1];
const originalEnv = process.env.NODE_ENV;

function withArgv(path: string, env?: string) {
  process.argv[1] = path;
  if (env === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = env;
  return isDevServer();
}

afterEach(() => {
  process.argv[1] = originalArgv;
  if (originalEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv;
});

describe("開発サーバーかどうかの判定", () => {
  it("npm start（ビルド済みを NODE_ENV 無しで実行）は本番として扱う", () => {
    expect(withArgv("/app/dist/server.cjs")).toBe(false);
  });

  it("npm run dev（TypeScript のまま実行）は開発として扱う", () => {
    expect(withArgv("/app/server.ts")).toBe(true);
  });

  it("NODE_ENV=production ならビルド前でも本番として扱う", () => {
    expect(withArgv("/app/server.ts", "production")).toBe(false);
  });

  it("NODE_ENV=development ならビルド後でも開発として扱う", () => {
    expect(withArgv("/app/dist/server.cjs", "development")).toBe(true);
  });

  it("実行ファイルが分からないときは本番として扱う（安全側に倒す）", () => {
    // 開発用ミドルウェアを本番で動かす方が損害が大きい
    process.argv[1] = "";
    delete process.env.NODE_ENV;
    expect(isDevServer()).toBe(false);
  });
});
