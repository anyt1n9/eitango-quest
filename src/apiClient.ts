/**
 * こちらのサーバー（/api/*）の応答を JSON として読む。
 *
 * サーバー自身のエラーは日本語の文を JSON（`{ error }`）で返すが、
 * それ以外の経路では HTML が返ってくることがある。
 *   - ホスティングの手前のプロキシが返す 502 / 504
 *   - 本文が上限を超えたときなど、Express が既定で返すエラー
 * そのまま `response.json()` を呼ぶと `SyntaxError: Unexpected token '<'` が投げられ、
 * 呼び出し側の `catch` がその英文を画面にそのまま出していた。
 * 読めなかったときは、ステータスを添えた日本語の文に置き換える。
 */
export async function readJsonResponse(res: Response): Promise<any> {
  const data = await res.json().catch(() => undefined);
  if (data !== null && typeof data === "object") return data;
  if (!res.ok) {
    throw new Error(`サーバーとの通信に失敗しました（${res.status}）。時間をおいて再度お試しください。`);
  }
  throw new Error("サーバーの応答を読み取れませんでした。時間をおいて再度お試しください。");
}
