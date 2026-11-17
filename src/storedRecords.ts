import type { RankingUser } from "./types";

// 起動時に読むので、ここでは型以外を import しない（storedWords.ts と同じ）

/** 学習カレンダー用の日別の記録（日付 → 解答数・正解数） */
export type DailyLog = Record<string, { count: number; correct: number }>;

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * 保存されていたランキング（quest_ranking_score）から、使える形の人だけを残す。
 *
 * 読み込み（readStoredArray）は「配列であること」しか見ず、バックアップの復元（isBackupPayload）も
 * 値が文字列かしか見ないので、`[null, {...}]` のような値がそのまま入りうる（復元・手での編集）。
 * そのまま使っていたときは、日付が変わった起動でライバルの成長（growRivals）が `null.isMe` で投げ、
 * 成長した日付を残す前に落ちるので、読み直しても同じ所で落ち続けてアプリに入れなくなった（#151）。
 */
export function sanitizeRanking(raw: unknown): RankingUser[] {
  if (!Array.isArray(raw)) return [];
  const out: RankingUser[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const u = v as Partial<Record<keyof RankingUser, unknown>>;
    if (typeof u.id !== "string" || !isFiniteNumber(u.score)) continue;
    out.push({
      id: u.id,
      name: typeof u.name === "string" ? u.name : "",
      score: u.score,
      avatar: typeof u.avatar === "string" ? u.avatar : "",
      ...(u.isMe === true ? { isMe: true } : {})
    });
  }
  return out;
}

/**
 * 保存されていた学習ログ（quest_daily_log）から、使える形の日だけを残す。
 *
 * 日の値が null や数でない count のままだと、「記録」の学習カレンダーが描くときに投げ、
 * 「記録」は URL を持つので読み直しても同じ画面で落ち続けた（#152。バックアップの復元・手での編集で入りうる）。
 */
export function sanitizeDailyLog(raw: unknown): DailyLog {
  const log: DailyLog = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return log;
  for (const [date, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const e = v as { count?: unknown; correct?: unknown };
    if (!isFiniteNumber(e.count)) continue;
    log[date] = { count: e.count, correct: isFiniteNumber(e.correct) ? e.correct : 0 };
  }
  return log;
}
