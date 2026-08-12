/**
 * 英単語の発音記号(IPA)を取得するユーティリティ。
 * 無料・APIキー不要の dictionaryapi.dev を利用し、結果は localStorage にキャッシュする。
 * （見つからなかった単語は null をキャッシュして無駄な再取得を防ぐ。通信エラー時はキャッシュしない＝オフライン後に再試行可能。）
 *
 * 辞書一覧では1ページに50語が同時に描画されるため、無制限に並列リクエストすると
 * 外部APIのレート制限(429)に即座に到達してしまう。同時実行数を絞ったキューと、
 * 同一単語の重複リクエスト排除(in-flight共有)を備える。
 *
 * 通信エラーをキャッシュしないのは「オフラインから戻ったら取り直せるように」だが、
 * それだけだと歯止めが無い。外部に出られない環境では単語を描画するたびに
 * 失敗し続け、コンソールがエラーで埋まる（実測：辞書を開くだけで8件）。
 * 失敗が続いたら一定時間だけ休むようにして、回復したら自然に再開する。
 */

import { writeStored } from "./storage";

const LS_KEY = "quest_phonetics_cache";

let memCache: Record<string, string | null> | null = null;

function loadCache(): Record<string, string | null> {
  if (!memCache) {
    // プロトタイプ継承のないオブジェクトを使う。通常の {} だと "constructor" や
    // "valueOf" のような単語（ユーザーがAI追加・CSVで登録しうる実在の英単語）で
    // `word in cache` が常に true になり、Object.prototype のメソッドが
    // 発音記号として返ってしまう。
    memCache = Object.create(null);
    try {
      const parsed = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.assign(memCache as object, parsed);
      }
    } catch {
      // 破損データは無視して空のキャッシュから始める
    }
  }
  return memCache as Record<string, string | null>;
}

function saveCache() {
  // 容量超過などは writeStored 側で握る（キャッシュなので保存できなくても支障はない）
  writeStored(LS_KEY, memCache);
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

// —— 連続失敗時の休止（バックオフ） ——
/** これだけ続けて失敗したら休む */
const FAILURE_LIMIT = 3;
/** 休む長さ。失敗が続くほど延ばす（30秒 → 5分が上限） */
const PAUSE_MS = 30_000;
const MAX_PAUSE_MS = 5 * 60_000;

let consecutiveFailures = 0;
let pausedUntil = 0;

/** 現在時刻。テストから差し替えられるようにしておく */
let clock: () => number = () => Date.now();

/** 休止中かどうか。休止が明けていれば解除する */
function isPaused(): boolean {
  if (pausedUntil === 0) return false;
  if (clock() >= pausedUntil) {
    // 明けたら1回だけ試させる。成功すれば失敗の数え上げも消える
    pausedUntil = 0;
    return false;
  }
  return true;
}

function noteFailure() {
  consecutiveFailures++;
  if (consecutiveFailures >= FAILURE_LIMIT) {
    // 失敗が続くほど休みを延ばす（30秒・60秒・120秒…上限5分）
    const factor = 2 ** (consecutiveFailures - FAILURE_LIMIT);
    pausedUntil = clock() + Math.min(PAUSE_MS * factor, MAX_PAUSE_MS);
  }
}

function noteSuccess() {
  consecutiveFailures = 0;
  pausedUntil = 0;
}

/** テスト用。時計を差し替え、失敗の数え上げを初期化する */
export function __setPhoneticsClock(fn: (() => number) | null): void {
  clock = fn ?? (() => Date.now());
  consecutiveFailures = 0;
  pausedUntil = 0;
  memCache = null;
}

/** 単語の発音記号(例: "/ɪɡˈzæmpəl/")を返す。なければ null。 */
export async function getPhonetic(rawWord: string): Promise<string | null> {
  const word = (rawWord || "").trim().toLowerCase();
  if (!word || /[^a-z'\- ]/.test(word)) return null; // 英単語以外はスキップ

  const cache = loadCache();
  if (word in cache) return cache[word];

  // 通信が続けて失敗しているあいだは、外に出ずに諦める。
  // キャッシュはしないので、休みが明ければまた取りに行く
  if (isPaused()) return null;

  const existing = inflight.get(word);
  if (existing) return existing;

  const task = (async (): Promise<string | null> => {
    await acquireSlot();
    try {
      // 順番待ちのあいだに休止に入っていることがある。
      // 辞書の一覧は50語を一度に描くので、最初の失敗が返るより先に
      // 50件が並んでしまう。ここで見ないと歯止めが効かない
      if (isPaused()) return null;
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
      );
      if (res.status === 404) {
        // 辞書に存在しない単語のみ null を永続キャッシュする。
        // 応答が返ってきている以上、通信そのものは生きている
        noteSuccess();
        cache[word] = null;
        saveCache();
        return null;
      }
      if (!res.ok) {
        // 429(レート制限)や5xxは一時的な失敗なのでキャッシュせず、後で再試行可能にする。
        // 続くようなら休む（叩き続けると制限が解けない）
        noteFailure();
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
      noteSuccess();
      cache[word] = ipa;
      saveCache();
      return ipa;
    } catch {
      // 通信エラー(オフライン等)はキャッシュしない。
      // ただし数え上げはするので、繋がらない環境で叩き続けることはない
      noteFailure();
      return null;
    } finally {
      releaseSlot();
      inflight.delete(word);
    }
  })();

  inflight.set(word, task);
  return task;
}
