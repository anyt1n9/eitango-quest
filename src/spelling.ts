/**
 * 綴り入力クイズの判定ロジック。
 *
 * 画面（SpellingQuiz.tsx）から切り離してあるのは、テストから
 * React や motion を読み込まずに検証できるようにするため。
 */

/** 綴りの一致判定。大文字小文字・前後の空白・複数スペース・アポストロフィの種類の違いは許容する */
export function isSpellingCorrect(input: string, answer: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[’]/g, "'");
  return norm(input) === norm(answer);
}

/** 入力と正解を1文字ずつ比べ、どこまで合っているかを返す（間違い箇所の可視化用） */
export function diffChars(input: string, answer: string): { ch: string; ok: boolean }[] {
  const a = input.trim();
  return a.split("").map((ch, i) => ({
    ch,
    ok: (answer[i] || "").toLowerCase() === ch.toLowerCase()
  }));
}
