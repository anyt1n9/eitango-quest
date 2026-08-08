import { Word } from "./types";
import { SrsState, isDue, todayStr } from "./srs";
import { shuffle } from "./shuffle";

/**
 * 出題する単語の選び方。
 *
 * 以前はレベル内の全語から完全にランダムに抽出していた。そのため既に覚えた語を
 * 何度も引き直す一方、未出題の語に体系的に到達する保証がなかった。
 * 10問クイズで全語に1回触れるまでの期待回数は、初級(1,062語)で約800回、
 * 上級(2,467語)では約2,000回に達する。
 *
 * ここでは次の優先順位で配分する。
 *   1. 復習期日を過ぎた語（間隔反復の期日が今日以前）… 定着のために最優先
 *   2. まだ一度も解いていない語 … 語彙を広げるため
 *   3. それ以外（解答済みで期日前の語）… 残りを埋める
 *
 * 1だけで埋めると新しい語にいつまでも進めないため、割合で上限を設ける。
 */
const DUE_RATIO = 0.6;

export interface SelectionInput {
  pool: Word[];
  count: number;
  solvedHistory: Record<string, { correctCount: number; attemptCount: number }>;
  srsData: Record<string, SrsState>;
  today?: string;
}

export function selectQuizWords({
  pool,
  count,
  solvedHistory,
  srsData,
  today = todayStr()
}: SelectionInput): Word[] {
  if (count <= 0 || pool.length === 0) return [];

  const due: Word[] = [];
  const unseen: Word[] = [];
  const rest: Word[] = [];
  for (const w of pool) {
    const srs = srsData[w.id];
    if (srs && isDue(srs, today)) due.push(w);
    else if (!solvedHistory[w.id]) unseen.push(w);
    else rest.push(w);
  }

  // 各層をあらかじめシャッフルしておき、前から順に取り出す（重複して選ばないため）
  const shuffledDue = shuffle(due);
  const shuffledUnseen = shuffle(unseen);
  const shuffledRest = shuffle(rest);

  const picked: Word[] = [];
  let dueTaken = 0;
  const take = (tier: Word[], from: number, n: number) => {
    const slice = tier.slice(from, from + Math.max(0, n));
    picked.push(...slice);
    return slice.length;
  };

  // 期日超過に上限付きで枠を配分し、残りを未習 → 期日超過の残り → その他 で埋める
  dueTaken += take(shuffledDue, 0, Math.min(shuffledDue.length, Math.ceil(count * DUE_RATIO)));
  take(shuffledUnseen, 0, count - picked.length);
  dueTaken += take(shuffledDue, dueTaken, count - picked.length);
  take(shuffledRest, 0, count - picked.length);

  return shuffle(picked);
}
