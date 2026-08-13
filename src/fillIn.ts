/**
 * 例文を穴埋めの形にする。
 *
 * 出題画面（例文穴埋め・綴り）は例文を手がかりとして見せるので、
 * 本文に答えの綴りが残っていると問題として成立しない。
 *
 * 以前は「穴の記号が入っていればそのまま使う」としていた。
 * AI・CSV・PDF から取り込んだ単語は、答えを含む例文の末尾に
 * 穴を足した形で保存される（src/importWords.ts）ため、
 *   The garden is very beautiful in spring. [_____]
 * のように、穴はあるのに答えも見えている例文ができていた。
 * 収録済みの7,725語はすべて答えの位置に穴が開いているので影響は無いが、
 * 自分で単語を足した人にだけ答えの見える問題が出ることになる。
 */

export const HOLE = "[_____]";

const FALLBACK = "I want to study [_____] today.";

/** 正規表現に使えるようエスケープする */
function escape(word: string): string {
  return word.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * 例文から答えを取り除き、その場所を穴にする。
 * 答えが本文に無ければ末尾に穴を足す。
 */
export function toFillInSentence(sentence: unknown, word: string): string {
  if (typeof sentence !== "string" || sentence.trim() === "") return FALLBACK;
  const re = new RegExp(`\\b${escape(word)}\\b`, "gi");
  const holed = re.test(sentence) ? sentence.replace(re, HOLE) : sentence;
  return holed.includes(HOLE) ? holed : `${holed} ${HOLE}`;
}

/** 穴を表示用の記号に置き換える（複数あってもすべて） */
export function showHoles(sentence: string, mark = "＿＿＿"): string {
  return sentence.split(HOLE).join(mark);
}
