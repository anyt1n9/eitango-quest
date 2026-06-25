/**
 * 英単語の発音記号(IPA)を取得するユーティリティ。
 * 無料・APIキー不要の dictionaryapi.dev を利用し、結果は localStorage にキャッシュする。
 * （見つからなかった単語は null をキャッシュして無駄な再取得を防ぐ。通信エラー時はキャッシュしない＝オフライン後に再試行可能。）
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

/** 単語の発音記号(例: "/ɪɡˈzæmpəl/")を返す。なければ null。 */
export async function getPhonetic(rawWord: string): Promise<string | null> {
  const word = (rawWord || "").trim().toLowerCase();
  if (!word || /[^a-z'\- ]/.test(word)) return null; // 英単語以外はスキップ

  const cache = loadCache();
  if (word in cache) return cache[word];

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (!res.ok) {
      cache[word] = null; // 見つからない単語は null を記録
      saveCache();
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
  }
}
