/**
 * 英単語の発音記号(IPA)を取得するユーティリティ。
 * 無料・APIキー不要の dictionaryapi.dev を利用し、結果は localStorage にキャッシュする。
 * （見つからなかった単語は null をキャッシュして無駄な再取得を防ぐ。通信エラー時はキャッシュしない＝オフライン後に再試行可能。）
 *
 * 辞書一覧では1ページに50語が同時に描画されるため、無制限に並列リクエストすると
 * 外部APIのレート制限(429)に即座に到達してしまう。同時実行数を絞ったキューと、
 * 同一単語の重複リクエスト排除(in-flight共有)を備える。
 */

const LS_KEY = "quest_phonetics_cache";

let memCache: Record<string, string | null> | null = null;

function loadCache(): Record<string, string | null> {
  if (!memCache) {
    try {
      memCache = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    } catch {
      memCache = {};
    }
  }
  return memCache as Record<string, string | null>;
}

function saveCache() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(memCache));
  } catch {
    // 容量超過などは無視
  }
}

// —— 同時実行リミッター（最大4並列、残りは順番待ち） ——
const MAX_CONCURRENT = 4;
let activeCount = 0;
const waitQueue: (() => void)[] = [];

function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeCount++;
      resolve();
    });
  });
}

function releaseSlot() {
  activeCount--;
  const next = waitQueue.shift();
  if (next) next();
}

// 同一単語への同時リクエストを1本にまとめる
const inflight = new Map<string, Promise<string | null>>();

/** 単語の発音記号(例: "/ɪɡˈzæmpəl/")を返す。なければ null。 */
export async function getPhonetic(rawWord: string): Promise<string | null> {
  const word = (rawWord || "").trim().toLowerCase();
  if (!word || /[^a-z'\- ]/.test(word)) return null; // 英単語以外はスキップ

  const cache = loadCache();
  if (word in cache) return cache[word];

  const existing = inflight.get(word);
  if (existing) return existing;

  const task = (async (): Promise<string | null> => {
    await acquireSlot();
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
      );
      if (res.status === 404) {
        // 辞書に存在しない単語のみ null を永続キャッシュする
        cache[word] = null;
        saveCache();
        return null;
      }
      if (!res.ok) {
        // 429(レート制限)や5xxは一時的な失敗なのでキャッシュせず、後で再試行可能にする
        return null;
      }
      const data = await res.json();
      let ipa: string | null = null;
      if (Array.isArray(data)) {
        for (const entry of data) {
          if (entry && typeof entry.phonetic === "string" && entry.phonetic) {
            ipa = entry.phonetic;
            break;
          }
          if (entry && Array.isArray(entry.phonetics)) {
            const p = entry.phonetics.find((x: any) => x && x.text);
            if (p) {
              ipa = p.text;
              break;
            }
          }
        }
      }
      cache[word] = ipa;
      saveCache();
      return ipa;
    } catch {
      // 通信エラー(オフライン等)はキャッシュしない
      return null;
    } finally {
      releaseSlot();
      inflight.delete(word);
    }
  })();

  inflight.set(word, task);
  return task;
}
