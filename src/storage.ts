/**
 * localStorage から JSON を読み出す共通ユーティリティ。
 *
 * これまで各ステートの初期化では JSON.parse を try/catch で囲むだけで、
 * パース結果が期待した型かどうかを検証していなかった。
 * そのため localStorage に配列以外の JSON（例: `{}` や `5`）が入っていると、
 * パース自体は成功したあとの `[...customList]` や `.filter()` で
 * TypeError が投げられ、アプリ起動時に画面が真っ白になっていた。
 * 破損データはバックアップの復元・手動編集・古い形式の残骸などで発生しうる。
 *
 * ここでは型が合わない場合も fallback に落とすことで、
 * 「壊れたデータがあっても初期値で起動できる」状態を保証する。
 */

/** 配列として保存された値を読み出す。配列でなければ fallback を返す */
export function readStoredArray<T>(key: string, fallback: T[] = []): T[] {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch (e) {
    return fallback;
  }
}

/** オブジェクト(辞書)として保存された値を読み出す。オブジェクトでなければ fallback を返す */
export function readStoredObject<T extends object>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as T;
    }
    return fallback;
  } catch (e) {
    return fallback;
  }
}
