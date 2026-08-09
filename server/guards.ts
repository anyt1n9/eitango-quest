/**
 * サーバー側の入力検証・流量制御。
 *
 * これらは「壊れても画面には何も出ないが、AIの利用料に直結する」種類のロジックなので、
 * 画面や外部通信から切り離してテストできる形にしてある。
 * 時刻は `now` で差し替えられるようにし、待たずに時間経過を再現する。
 */

// ── 入力バリデーション ─────────────────────────────────
// AIプロンプトへ埋め込まれる文字列に上限を設けることで、
// 1リクエストでの大量トークン消費(コスト攻撃)とプロンプト汚染を防ぐ。

export const MAX_WORD_LEN = 64;      // 英単語・フレーズ
export const MAX_MEANING_LEN = 200;  // 日本語訳・意味

/** 制御文字を含まない、上限以内の非空文字列であることを検証する */
export const isValidShortText = (value: unknown, maxLen: number): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= maxLen &&
  !/[\u0000-\u001F\u007F]/.test(value);

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** SVGのid属性に埋め込める形へ落とす */
export const safeSvgIdSegment = (value: string): string => {
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  return safe || "word";
};

// ── レート制限（IP単位・スライディングウィンドウ）─────────
// 公開エンドポイントの「ただ乗り」による Gemini 利用枠の浪費を防ぐ。
// 依存追加なしのメモリ内実装。プロセス再起動でリセットされるが、
// 悪用の連続大量アクセスを弾く目的には十分。

export interface RateLimitResult {
  allowed: boolean;
  /** 拒否したとき、何秒後に再試行できるか */
  retryAfterSec: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
  /** 期限切れの記録を捨てる（メモリ肥大を防ぐ） */
  sweep(): void;
  /** 保持しているキーの数（テストと監視用） */
  size(): number;
}

export function createRateLimiter(opts: {
  windowMs: number;
  max: number;
  now?: () => number;
}): RateLimiter {
  const { windowMs, max, now = Date.now } = opts;
  const buckets = new Map<string, number[]>();

  const recent = (key: string, t: number) =>
    (buckets.get(key) || []).filter(ts => t - ts < windowMs);

  return {
    check(key: string): RateLimitResult {
      const t = now();
      const timestamps = recent(key, t);
      if (timestamps.length >= max) {
        // 最も古い記録が窓から出るまで待てば1回ぶん空く
        const retryAfterSec = Math.max(1, Math.ceil((windowMs - (t - timestamps[0])) / 1000));
        // 期限切れを落とした状態で保存し直す（拒否中も窓は進む）
        buckets.set(key, timestamps);
        return { allowed: false, retryAfterSec };
      }
      timestamps.push(t);
      buckets.set(key, timestamps);
      return { allowed: true, retryAfterSec: 0 };
    },

    sweep() {
      const t = now();
      for (const [key, timestamps] of buckets) {
        const left = timestamps.filter(ts => t - ts < windowMs);
        if (left.length === 0) buckets.delete(key);
        else buckets.set(key, left);
      }
    },

    size() {
      return buckets.size;
    }
  };
}

// ── サーバー全体の呼び出し予算 ───────────────────────────
// IP単位のレート制限は多数のIPに分散した攻撃(プロキシ/ボットネット)には
// 効かないため、全体の呼び出し回数にも上限を設けてAPI課金の暴走を防ぐ。

export class BudgetExceededError extends Error {}

export interface Budget {
  /** 1回ぶん消費する。上限を超えていれば BudgetExceededError を投げる */
  consume(): void;
  /** 現在の窓で消費済みの回数 */
  used(): number;
}

export function createBudget(opts: {
  windowMs: number;
  limit: number;
  now?: () => number;
}): Budget {
  const { windowMs, limit, now = Date.now } = opts;
  let count = 0;
  let windowStart = now();

  return {
    consume() {
      const t = now();
      if (t - windowStart >= windowMs) {
        windowStart = t;
        count = 0;
      }
      if (count >= limit) {
        throw new BudgetExceededError(
          `Gemini hourly budget exceeded (${limit} calls/hour). Falling back to local responses.`
        );
      }
      count++;
    },

    used() {
      const t = now();
      return t - windowStart >= windowMs ? 0 : count;
    }
  };
}
