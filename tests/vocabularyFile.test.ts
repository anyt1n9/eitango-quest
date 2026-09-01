import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  VOCABULARY_FILE,
  findVocabularyArray,
  parseVocabulary,
  replaceVocabulary
} from "../scripts/vocabularyFile";

/**
 * `src/data/vocabulary.ts` を書き換えるスクリプトが使う、配列の境界の見つけ方の検査。
 *
 * この境界を単純な部分文字列検索（`indexOf("[{")` / `indexOf("}];")`）で
 * 探していたスクリプトがあり、例文や訳の中に同じ並びが現れると
 * 範囲を取り違えて 3.1MB の収録データを壊す恐れがあった。
 * 壊れ方が「JSON の解析に失敗する」だけとは限らない（誤った範囲を丸ごと
 * 書き戻す）ので、境界の判定そのものをここで固定する。
 */

/** 検査用の最小限の vocabulary.ts。`words` をそのまま埋め込む */
function fakeSource(words: unknown[]): string {
  return [
    'import { Word } from "../types";',
    "",
    `const rawVocabulary: any[] = ${JSON.stringify(words)};`,
    "",
    "export const initialVocabulary: Word[] = rawVocabulary as Word[];",
    ""
  ].join("\n");
}

describe("単語配列の境界", () => {
  it("素直なデータを読める", () => {
    const words = [{ id: "j1", word: "beautiful", translation: "美しい" }];
    expect(parseVocabulary(fakeSource(words))).toEqual(words);
  });

  it("例文の中に配列の始まりと同じ並びがあっても取り違えない", () => {
    // 穴埋め記号や引用のある例文には `[` が入る。
    // マーカーより前（import 文の直後のコメントなど）に "[{" があると、
    // 単純な部分文字列検索はそちらを配列の先頭と見なす
    const words = [{ id: "j1", word: "list", translation: "一覧", sentence: "The [_____] is here." }];
    const source = fakeSource(words).replace(
      'import { Word } from "../types";',
      'import { Word } from "../types";\n// 形の例: [{"id":"x"}];'
    );
    expect(source.indexOf("[{")).toBeLessThan(source.indexOf("const rawVocabulary"));
    expect(parseVocabulary(source)).toEqual(words);
  });

  it("訳の中に配列の終わりと同じ並びがあっても取り違えない", () => {
    const words = [
      { id: "j1", word: "brace", translation: "かっこ（}];のような記号）" },
      { id: "j2", word: "second", translation: "2番目の" }
    ];
    const source = fakeSource(words);
    expect(parseVocabulary(source)).toEqual(words);
    // 単純な検索だと1語目の途中で切れる
    expect(source.indexOf("}];")).toBeLessThan(source.indexOf('"j2"'));
  });

  it("配列だけを差し替え、前後の行はそのまま残す", () => {
    const source = fakeSource([{ id: "j1", word: "old", translation: "古い" }]);
    const replaced = replaceVocabulary(source, [{ id: "j1", word: "new", translation: "新しい" }]);
    expect(parseVocabulary(replaced)).toEqual([{ id: "j1", word: "new", translation: "新しい" }]);
    expect(replaced.startsWith('import { Word } from "../types";')).toBe(true);
    expect(replaced.trimEnd().endsWith("export const initialVocabulary: Word[] = rawVocabulary as Word[];")).toBe(true);
  });

  it("マーカーが無ければ見つけられない", () => {
    expect(findVocabularyArray("const other: any[] = [{}];")).toBeNull();
    expect(() => parseVocabulary("const other: any[] = [{}];")).toThrow();
  });

  it("実物の vocabulary.ts を読める", () => {
    const source = fs.readFileSync(VOCABULARY_FILE, "utf8");
    const words = parseVocabulary(source);
    expect(Array.isArray(words)).toBe(true);
    expect(words.length).toBeGreaterThan(7000);
    expect(words.every(w => typeof w.word === "string" && w.word.length > 0)).toBe(true);
    // 書き戻しても中身が変わらない（差し替えの往復で壊れない）
    expect(parseVocabulary(replaceVocabulary(source, words))).toHaveLength(words.length);
  });

  it("VOCABULARY_FILE は収録データを指している", () => {
    expect(VOCABULARY_FILE).toBe(path.join(process.cwd(), "src/data/vocabulary.ts"));
    expect(fs.existsSync(VOCABULARY_FILE)).toBe(true);
  });
});
