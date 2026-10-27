import { describe, it, expect } from "vitest";
import { readJsonResponse } from "../src/apiClient";

/**
 * サーバーの応答を JSON として読む（issue #108）。
 *
 * ホスティングのプロキシが返す 502 / 504 や Express 既定のエラーは HTML で返る。
 * そのまま response.json() を呼ぶと「Unexpected token '<'」が投げられ、
 * その英文が画面にそのまま出ていた。
 */

const html = (status: number) =>
  new Response("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
    status,
    headers: { "Content-Type": "text/html" }
  });
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("readJsonResponse", () => {
  it("JSON ならそのまま返す", async () => {
    await expect(readJsonResponse(json(200, { word: "lay" }))).resolves.toEqual({ word: "lay" });
  });

  it("サーバーが JSON で返したエラーは、呼び出し側が error を読めるようにそのまま返す", async () => {
    await expect(readJsonResponse(json(503, { error: "AIを呼び出せませんでした。" })))
      .resolves.toEqual({ error: "AIを呼び出せませんでした。" });
  });

  it("HTML のエラーは、ステータスを添えた日本語の文にする（英文の SyntaxError を出さない）", async () => {
    const err = await readJsonResponse(html(502)).catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("サーバーとの通信に失敗しました（502）。時間をおいて再度お試しください。");
    expect(err.message).not.toMatch(/Unexpected token/);
  });

  it("200 でも JSON でなければ、読み取れなかったと伝える", async () => {
    const err = await readJsonResponse(html(200)).catch(e => e);
    expect(err.message).toBe("サーバーの応答を読み取れませんでした。時間をおいて再度お試しください。");
  });

  it("JSON の null は応答として扱わない（呼び出し側が null.error で落ちない）", async () => {
    const err = await readJsonResponse(json(200, null)).catch(e => e);
    expect(err).toBeInstanceOf(Error);
  });
});
