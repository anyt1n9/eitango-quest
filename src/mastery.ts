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
