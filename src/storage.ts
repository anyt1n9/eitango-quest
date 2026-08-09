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

/**
 * ダークモードで開くべきかを判定する。
 *
 * 保存された設定があればそれに従い、無ければ端末（OS・ブラウザ）の設定に合わせる。
 * 以前は保存値が "dark" かどうかだけを見ていたため、
 * OSをダークにしている利用者でも初回は必ずライトで開いていた。
 */
export function prefersDarkTheme(key = "quest_theme"): boolean {
  try {
    const saved = localStorage.getItem(key);
    if (saved === "dark") return true;
    if (saved === "light") return false;
  } catch {
    // localStorage が使えない環境では端末の設定だけで決める
  }
  try {
    return !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/**
 * 保存に失敗したときのハンドラ。
 * 画面側で「保存できませんでした」と伝えたい場合に差し替える。
 */
let onWriteError: ((key: string, error: unknown) => void) | null = null;

export function setStorageErrorHandler(fn: ((key: string, error: unknown) => void) | null): void {
  onWriteError = fn;
}

/**
 * localStorage へ書き込む。失敗しても例外を投げない。
 *
 * 書き込みは読み出しと違い、これまで20箇所中19箇所が無防備だった。
 * localStorage は容量に上限（多くのブラウザで5MB前後）があり、
 * 全語を学習し終えた状態で quest_srs が約674KB、quest_solved_history が約349KB、
 * これに取り込み単語・AI生成の長文・日記が積み上がる。
 * 上限に達すると setItem が QuotaExceededError を投げ、
 * これが useEffect の中で起きるためエラー画面に落ちていた。
 * Safari のプライベートモードなど、書き込み自体が禁じられる環境もある。
 *
 * 保存できなくてもアプリは動き続けるべきなので、ここで握って false を返す。
 *
 * @returns 保存できたかどうか
 */
export function writeStored(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    return true;
  } catch (e) {
    // 開発時に気づけるようログには残す（本番でも握りつぶすだけにはしない）
    console.warn(`localStorage への保存に失敗しました: ${key}`, e);
    if (onWriteError) {
      try {
        onWriteError(key, e);
      } catch {
        // ハンドラ自身の失敗でアプリを壊さない
      }
    }
    return false;
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
