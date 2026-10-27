import { Level, PartOfSpeech, Word } from "./types";

// 起動時に読むので、ここでは型以外を import しない（取り込みの処理 importWords.ts は
// 不適切語の一覧などを抱えていて重く、画面を開いたときに遅れて読む）
const LEVELS: Level[] = ["junior", "senior", "senior2", "senior3", "advanced"];
const POS: PartOfSpeech[] = ["verb", "noun", "adjective", "adverb", "other"];

/**
 * 保存されていた追加単語（quest_vocab_custom）から、使える形のものだけを残す。
 *
 * 読み込み（readStoredArray）は「配列であること」しか見ないので、`null` や綴りの無い要素が
 * そのまま単語帳に入りうる（手で直したファイル・古い版の残骸）。綴りは辞書の検索や重複の確認で
 * `w.word.toLowerCase()` のように無条件に使うので、1件でも欠けていると描画中に例外になり、
 * 読み直しても同じ記録を読むので先へ進めなくなる（復習の記録の sanitizeSrs と同じ理由）。
 *
 * 綴り・訳・ID が無いものは捨て、選択肢や例文が欠けていれば空で補う
 * （出題は src/quizFormats.ts が「その形式で問える語」に絞るので、空でも問題は出ない）。
 * 収録語や前の要素と同じ ID のものも捨てる（同じ ID が2語あると、どちらの記録か区別できない）。
 */
export function sanitizeStoredWords(raw: unknown[], takenIds: Set<string> = new Set()): Word[] {
  return splitStoredWords(raw, takenIds).words;
}

/**
 * sanitizeStoredWords と同じ検査で、使える語（words）と捨てた要素（rejected）に分ける。
 * 捨てた要素は次の保存で quest_vocab_custom から消えるので、呼び出し側が別のキーに控える
 * （綴りだけ残っていて訳の欠けた語などを、黙って失わないため）。
 */
export function splitStoredWords(
  raw: unknown[],
  takenIds: Set<string> = new Set()
): { words: Word[]; rejected: unknown[] } {
  const seen = new Set(takenIds);
  const out: Word[] = [];
  const rejected: unknown[] = [];
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  for (const item of raw) {
    if (item === null || item === undefined) continue; // 控えても中身が無い
    const w = (typeof item === "object" ? item : {}) as Partial<Word>;
    if (
      typeof item !== "object" ||
      typeof w.id !== "string" || w.id === "" || seen.has(w.id) ||
      typeof w.word !== "string" || w.word.trim() === "" ||
      typeof w.translation !== "string" || w.translation.trim() === ""
    ) {
      rejected.push(item);
      continue;
    }
    seen.add(w.id);
    out.push({
      id: w.id,
      word: w.word,
      translation: w.translation,
      level: LEVELS.includes(w.level as Level) ? (w.level as Level) : "senior",
      options: strings(w.options),
      sentence: typeof w.sentence === "string" ? w.sentence : "",
      sentenceTranslation: typeof w.sentenceTranslation === "string" ? w.sentenceTranslation : "",
      sentenceOptions: strings(w.sentenceOptions),
      ...(POS.includes(w.pos as PartOfSpeech) ? { pos: w.pos } : {})
    });
  }
  return { words: out, rejected };
}
