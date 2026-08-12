import { Word } from "./types";

/**
 * 出題形式。
 *
 * 復習（今日の復習・苦手単語の復習）はどちらも四択に固定されていたため、
 * 文穴埋めや綴りで覚えた語も四択でしか出し直せなかった。
 * 覚えたときと違う形式でしか復習できないと、
 * 「選択肢から選べるが自分では書けない」状態が残ってしまう。
 * 形式を値として持ち、復習でも選べるようにする。
 */
export type QuizFormat = "word" | "sentence" | "listening" | "spelling" | "reverse";

export const QUIZ_FORMATS: { key: QuizFormat; label: string; description: string }[] = [
  { key: "word", label: "四択", description: "英単語を見て意味を選ぶ" },
  { key: "sentence", label: "文穴埋め", description: "例文の空所に入る語を選ぶ" },
  { key: "listening", label: "リスニング", description: "音声を聞いて意味を選ぶ" },
  { key: "spelling", label: "綴り", description: "意味を見て綴りを書く" },
  { key: "reverse", label: "日→英", description: "日本語を見て英単語を選ぶ" }
];

export const QUIZ_FORMAT_LABELS: Record<QuizFormat, string> =
  Object.fromEntries(QUIZ_FORMATS.map(f => [f.key, f.label])) as Record<QuizFormat, string>;

/**
 * 綴りを問える見出しかどうか。
 * 記号や数字を含む見出し（イディオム・文法パターン）は書き取りにならない。
 */
export function canSpell(word: Word): boolean {
  const w = String(word.word || "").trim();
  return w.length >= 2 && /^[a-zA-Z][a-zA-Z'\- ]*$/.test(w);
}

/** 例文の穴埋めができるかどうか。例文と、英語の選択肢が要る */
export function canFillSentence(word: Word): boolean {
  return Boolean(String(word.sentence || "").trim())
    && Array.isArray(word.sentenceOptions) && word.sentenceOptions.length >= 2;
}

/** 日→英ができるかどうか。英単語の選択肢が要る */
export function canAnswerInEnglish(word: Word): boolean {
  return Array.isArray(word.sentenceOptions) && word.sentenceOptions.length >= 2;
}

/** 意味の四択ができるかどうか。日本語の選択肢が要る */
export function canChooseMeaning(word: Word): boolean {
  return Array.isArray(word.options) && word.options.length >= 2;
}

/**
 * その形式で出題できる語だけを取り出す。
 *
 * 復習は対象の語があらかじめ決まっているので、
 * 形式に合わない語が混ざると出題できずにセッションが空になる。
 * どの形式で何語出せるかを先に数えておき、画面で選べないようにするために使う。
 */
export interface FormatOptions {
  /**
   * 読み上げが使えるか。使えない端末ではリスニングは綴りを隠したまま
   * 手がかりが何も無い四択になるため、1語も出せないものとして扱う。
   * 既定は true（判定できない環境で塞いでしまわないように）。
   */
  speech?: boolean;
}

export function wordsForFormat(words: Word[], format: QuizFormat, options: FormatOptions = {}): Word[] {
  switch (format) {
    case "spelling": return words.filter(canSpell);
    case "sentence": return words.filter(canFillSentence);
    case "reverse": return words.filter(canAnswerInEnglish);
    case "listening":
      return options.speech === false ? [] : words.filter(canChooseMeaning);
    case "word": return words.filter(canChooseMeaning);
  }
}

/** 形式ごとに何語出せるかを数える（選べない形式を画面で無効にするため） */
export function countByFormat(words: Word[], options: FormatOptions = {}): Record<QuizFormat, number> {
  const out = {} as Record<QuizFormat, number>;
  for (const f of QUIZ_FORMATS) out[f.key] = wordsForFormat(words, f.key, options).length;
  return out;
}
