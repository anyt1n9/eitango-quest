import { describe, it, expect } from "vitest";
import { initialVocabulary } from "../src/data/vocabulary";
import { senseQuiz } from "../src/data/senseQuiz";
import { translationsOverlap } from "../scripts/bake_synonyms";
import { conjugate, regularPast } from "../src/verbForms";
import { parseSenseExample } from "../src/senseQuiz";

/**
 * 語義分別クイズのデータ（src/data/senseQuiz.ts）の検査。
 *
 * データは書き下ろしで、出典で正しさを担保できない（文法ガイドと同じ）。
 * そのぶん「設問として成り立つ形か」をここで全件確かめる。
 *   - 先頭の語義が教材の訳と同じ意味か（間隔反復に記録するのはこの語義だけなので）
 *   - 同じ語の語義どうしで訳が重なっていないか（重なると正解が2つになる）
 *   - 例文に対象の語が1つだけ印付きで入っているか、それがその語の形か
 * 例文がその語義でしか読めないかは、1項目ずつ読んで確かめるほかない。
 */

const V = initialVocabulary;
const findWord = (word: string) => V.filter(w => w.word.toLowerCase() === word.toLowerCase());

/** その語として認めるつづり（複数形・三単現・過去形・過去分詞・ing形） */
function formsOf(word: string): Set<string> {
  const w = word.toLowerCase();
  const v = conjugate(w);
  // 不規則動詞の表は英米で一般的な方だけを持つ（lean → leant）ので、規則変化の形も認める
  const forms = new Set([w, w + "s", w + "es", v.past, v.participle, v.ing, regularPast(w)]);
  if (w.endsWith("y")) forms.add(w.slice(0, -1) + "ies");
  if (w.endsWith("f")) forms.add(w.slice(0, -1) + "ves");
  return forms;
}

describe("語義分別クイズのデータ", () => {
  it("十分な数がある（各レベルで10語以上、全体で150語以上）", () => {
    const perLevel: Record<string, number> = {};
    for (const item of senseQuiz) {
      const level = findWord(item.word)[0]?.level;
      if (level) perLevel[level] = (perLevel[level] || 0) + 1;
    }
    for (const level of ["junior", "senior", "senior2", "senior3", "advanced"]) {
      expect(perLevel[level] ?? 0, level).toBeGreaterThanOrEqual(10);
    }
    expect(senseQuiz.length).toBeGreaterThanOrEqual(150);
  });

  it("どの語も収録語で、1語につき1項目", () => {
    const missing = senseQuiz.filter(item => findWord(item.word).length === 0).map(i => i.word);
    expect(missing).toEqual([]);
    const words = senseQuiz.map(i => i.word.toLowerCase());
    expect(words.filter((w, i) => words.indexOf(w) !== i)).toEqual([]);
  });

  it("語義は2〜3つ", () => {
    const bad = senseQuiz.filter(i => i.senses.length < 2 || i.senses.length > 3).map(i => i.word);
    expect(bad).toEqual([]);
  });

  it("先頭の語義は、教材が教えている訳と同じ意味", () => {
    const bad = senseQuiz
      .filter(item => !findWord(item.word).some(w => translationsOverlap(w.translation, item.senses[0].meaning)))
      .map(item => `${item.word}: 「${item.senses[0].meaning}」/ 教材「${findWord(item.word).map(w => w.translation).join(" | ")}」`);
    expect(bad).toEqual([]);
  });

  it("同じ語の語義どうしで訳が重ならない（正解が2つにならない）", () => {
    const bad: string[] = [];
    for (const item of senseQuiz) {
      for (let i = 0; i < item.senses.length; i++) {
        for (let j = i + 1; j < item.senses.length; j++) {
          if (translationsOverlap(item.senses[i].meaning, item.senses[j].meaning)) {
            bad.push(`${item.word}: 「${item.senses[i].meaning}」と「${item.senses[j].meaning}」`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("例文には対象の語が1つだけ印付きで入っていて、その語の形になっている", () => {
    const bad: string[] = [];
    for (const item of senseQuiz) {
      const forms = formsOf(item.word);
      for (const sense of item.senses) {
        const parsed = parseSenseExample(sense.example);
        if (!parsed) { bad.push(`${item.word}: 印が1つでない「${sense.example}」`); continue; }
        if (!forms.has(parsed.target.toLowerCase())) {
          bad.push(`${item.word}: 「${parsed.target}」は ${item.word} の形ではない`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("例文は英語だけ、和訳は日本語で、どちらも空でない", () => {
    const bad: string[] = [];
    for (const item of senseQuiz) {
      for (const sense of item.senses) {
        if (!/^[\x20-\x7e]+$/.test(sense.example)) bad.push(`${item.word}: 例文に英語以外の文字`);
        if (!/[぀-ヿ一-鿿]/.test(sense.translation)) bad.push(`${item.word}: 和訳が日本語でない`);
        if (/[{}]/.test(sense.translation)) bad.push(`${item.word}: 和訳に印が残っている`);
        if (!sense.meaning.trim()) bad.push(`${item.word}: 訳が空`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("同じ例文を2つの語義で使い回していない", () => {
    const examples = senseQuiz.flatMap(i => i.senses.map(s => s.example));
    expect(examples.filter((e, i) => examples.indexOf(e) !== i)).toEqual([]);
  });
});
