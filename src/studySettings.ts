import { Level, Word } from "./types";
import { readStoredString, writeStored } from "./storage";
import { isMastered, SolvedHistory } from "./mastery";
import { SrsState } from "./srs";
import { LEVEL_ORDER } from "./levelLabels";

/**
 * 「今日」と「教材」の画面が共有する学習の設定（レベルと1回の問題数）。
 *
 * どちらの画面からもクイズを始められるので、片方で選んだものがもう片方にも
 * 効かないと「中級1を選んだのに教材から始めたら初級だった」ことになる。
 * 保存先を1つにして、両方がここを通して読み書きする。
 */

/** 1回のクイズで出す問題数の選択肢 */
export const QUESTION_COUNTS = [
  { count: 10, label: "10問", minutes: "約1分" },
  { count: 50, label: "50問", minutes: "約5分" },
  { count: 100, label: "100問", minutes: "約10分" }
] as const;

export function readQuestionCount(): number {
  const v = Number(readStoredString("quest_question_count"));
  return QUESTION_COUNTS.some(c => c.count === v) ? v : 10;
}

export function saveQuestionCount(count: number) {
  writeStored("quest_question_count", String(count));
}

/**
 * どのレベルで学んでいるか。
 * 覚えておかないと、中学以外で学習している人はアプリを開くたびに選び直すことになる。
 */
export function readStudyLevel(): Level {
  const saved = readStoredString("quest_selected_level");
  return LEVEL_ORDER.includes(saved as Level) ? (saved as Level) : "junior";
}

export function saveStudyLevel(level: Level) {
  writeStored("quest_selected_level", level);
}

/** レベルごとの語数と習熟度 */
export function levelCounts(
  vocabulary: Word[],
  level: Level,
  solvedHistory: SolvedHistory,
  srsData: Record<string, SrsState>
) {
  const levelWords = vocabulary.filter(w => w.level === level);
  const total = levelWords.length;
  const completed = levelWords.filter(w => solvedHistory[w.id] && solvedHistory[w.id].attemptCount > 0).length;
  // 習得済み＝間隔反復のボックス2以上（1回の偶然の正解では到達しない）
  const correct = levelWords.filter(w => isMastered(w.id, solvedHistory, srsData)).length;
  const masterRate = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { total, completed, correct, masterRate };
}
