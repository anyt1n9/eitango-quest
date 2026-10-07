/**
 * 単語ID → [例文, 和訳, 誤答]。例文の答えの位置は [_____]。
 *
 * 誤答（3語）は省略できる。省略すると今の誤答のまま。
 * 誤答に同じ意味の語が入っていて、どんな文を書いても2つ目の正解になってしまうとき
 * （because of の誤答に on account of がある、など）にだけ差し替える。
 */
export type SentenceRewrites = Record<
  string,
  [sentence: string, translation: string, distractors?: [string, string, string]]
>;
