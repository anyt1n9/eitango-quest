/**
 * `src/data/vocabulary.ts` の単語配列を読み書きするための共通処理。
 *
 * このファイルは 3.1MB の1行データで、各スクリプトが
 * 「配列の始まりと終わりを探して JSON として読み、書き戻す」ことをしている。
 * 探し方を各所で書くと、`fix_pos.ts` のように単純な部分文字列検索
 * （`indexOf("[{")` / `indexOf("}];")`）で済ませたものが混ざる。
 * 例文や訳の中にたまたま同じ並びが現れると境界を取り違え、
 * JSON の解析に失敗するか、悪くすると誤った範囲を丸ごと書き戻して
 * 収録データを壊す。
 *
 * 境界は必ず「宣言のマーカーを起点に、文字列の中を数えない括弧の深さ」で決める。
 */
import fs from "fs";
import path from "path";

const MARKER = "const rawVocabulary: any[] = ";

export const VOCABULARY_FILE = path.join(process.cwd(), "src/data/vocabulary.ts");

/** 単語配列の範囲。`end` は `]` の次（slice の終端として使える） */
export type ArrayRange = { start: number; end: number };

/**
 * 単語配列の範囲を返す。見つからなければ null。
 *
 * 文字列リテラルの中の `[` `]` は数えない（例文に括弧が入っていても崩れない）。
 */
export function findVocabularyArray(source: string): ArrayRange | null {
  const marker = source.indexOf(MARKER);
  if (marker < 0) return null;
  const start = source.indexOf("[", marker + MARKER.length);
  if (start < 0) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (esc) { esc = false; continue; }
    if (inStr) {
      if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return { start, end: i + 1 };
    }
  }
  return null;
}

/** 単語配列を読む。範囲が見つからなければ例外 */
export function parseVocabulary(source: string): any[] {
  const range = findVocabularyArray(source);
  if (!range) throw new Error("vocabulary.ts の単語配列を見つけられませんでした");
  return JSON.parse(source.slice(range.start, range.end));
}

/** 単語配列だけを差し替えた中身を返す（前後の import や export はそのまま） */
export function replaceVocabulary(source: string, words: any[]): string {
  const range = findVocabularyArray(source);
  if (!range) throw new Error("vocabulary.ts の単語配列を見つけられませんでした");
  return source.slice(0, range.start) + JSON.stringify(words) + source.slice(range.end);
}

/** ファイルから単語配列を読む */
export function readVocabularyFile(file: string = VOCABULARY_FILE): { source: string; words: any[] } {
  const source = fs.readFileSync(file, "utf8");
  return { source, words: parseVocabulary(source) };
}

/** 単語配列を書き戻す */
export function writeVocabularyFile(source: string, words: any[], file: string = VOCABULARY_FILE): void {
  fs.writeFileSync(file, replaceVocabulary(source, words), "utf8");
}
