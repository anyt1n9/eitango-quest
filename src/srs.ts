/**
 * 間隔反復(SRS / Spaced Repetition System)の最小実装。
 * Leitner 方式（ボックス）をベースに、忘却曲線に沿って「次に復習すべき日」を算出する。
 * 日付は YYYY-MM-DD の文字列で扱う（端末ローカル日付ベース）。文字列比較で前後判定が可能。
 */

export interface SrsState {
  box: number;        // 習熟ボックス(0=学習中 〜 大きいほど定着)
  dueDate: string;    // 次に復習すべき日 (YYYY-MM-DD)
  lastReview: string; // 最後に解答した日 (YYYY-MM-DD)
  reps: number;       // 解答回数
  lapses: number;     // 間違えた回数
}

// 各ボックスの「次の復習までの日数」。正解でボックスが上がるほど間隔が伸びる。
const INTERVAL_DAYS = [1, 1, 2, 4, 7, 14, 30, 60];
const MAX_BOX = INTERVAL_DAYS.length - 1;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 端末のローカル日付を YYYY-MM-DD 文字列で返す */
export function todayStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 基準日に days 日を加えた日付の YYYY-MM-DD を返す */
function addDays(base: string, days: number): string {
  const d = new Date(base + "T00:00:00");
  return todayStr(new Date(d.getTime() + days * DAY_MS));
}

/** 解答結果から次の SRS 状態を計算する */
export function nextSrsState(
  prev: SrsState | undefined,
  isCorrect: boolean,
  today: string = todayStr()
): SrsState {
  const prevBox = prev ? prev.box : 0;
  const newBox = isCorrect ? Math.min(prevBox + 1, MAX_BOX) : Math.max(prevBox - 1, 0);
  const interval = INTERVAL_DAYS[newBox];
  return {
    box: newBox,
    dueDate: addDays(today, interval),
    lastReview: today,
    reps: (prev ? prev.reps : 0) + 1,
    lapses: (prev ? prev.lapses : 0) + (isCorrect ? 0 : 1),
  };
}

/** その単語が今日復習対象か（期日が今日以前か） */
export function isDue(state: SrsState, today: string = todayStr()): boolean {
  return state.dueDate <= today;
}

/** SRS データから、今日復習すべき単語IDの一覧を返す */
export function getDueWordIds(
  srs: Record<string, SrsState>,
  today: string = todayStr()
): string[] {
  return Object.keys(srs).filter((id) => isDue(srs[id], today));
}
