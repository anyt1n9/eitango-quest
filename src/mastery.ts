import { SrsState } from "./srs";

/**
 * 「習得済み」の判定。
 *
 * 以前は `correctCount > 0`、つまり一度でも正解すれば習得済みとしていた。
 * 四択なので当てずっぽうでも25%当たり、習得数が実力より大きく出ていた。
 *
 * ここでは間隔反復(SRS)のボックスを基準にする。ボックスは正解で+1、
 * 不正解で-1されるため、ボックス2以上は「正解が不正解より2回多い」状態にあたる。
 * 1回の偶然の正解では到達できず、間違えれば下がるので実態に追従する。
 *
 * SRS導入前に解答した分など、SRSデータが無い単語については
 * 従来の解答履歴を使い、正解2回以上を習得済みとみなす（移行時に
 * 習得数が突然0にならないようにするため）。
 */
export const MASTERY_BOX = 2;

export type SolvedHistory = Record<string, { correctCount: number; attemptCount: number }>;

export function isMastered(
  wordId: string,
  solvedHistory: SolvedHistory,
  srsData: Record<string, SrsState>
): boolean {
  const srs = srsData[wordId];
  if (srs) return srs.box >= MASTERY_BOX;
  const h = solvedHistory[wordId];
  return !!h && h.correctCount >= 2;
}

/**
 * 覚えかけ＝あと1回正解すると習得済みに入る語（間隔反復のボックス1）。
 *
 * 習得済みは「正解が不正解より2回多い」なので、はじめて解いた日にいくつ正解しても
 * 「覚えた」は0語のまま動かない。そこだけを見せていたため、9問正解したあとも
 * ホームが「覚えた0語・習熟度0%」のままで、記録が保存されていないように見えた。
 * 初めて1回正解した語のほか、習得済みから1回間違えて下がった語もここに入る
 * （どちらも、あと1回の正解で習得済みに戻る）。画面の説明もその意味で書く。
 */
export function isLearning(
  wordId: string,
  solvedHistory: SolvedHistory,
  srsData: Record<string, SrsState>
): boolean {
  const srs = srsData[wordId];
  if (srs) return srs.box >= 1 && srs.box < MASTERY_BOX;
  const h = solvedHistory[wordId];
  return !!h && h.correctCount === 1;
}

/** 習得済みの単語数を数える */
export function countMastered(
  wordIds: string[],
  solvedHistory: SolvedHistory,
  srsData: Record<string, SrsState>
): number {
  let n = 0;
  for (const id of wordIds) if (isMastered(id, solvedHistory, srsData)) n++;
  return n;
}
