import { describe, it, expect } from "vitest";
import { initialVocabulary as vocabulary } from "../src/data/vocabulary";
import { wordSenses } from "../src/data/senses";
import { wordUsage } from "../src/data/wordUsage";
import { wordSynonyms } from "../src/data/synonyms";
import { senseQuiz } from "../src/data/senseQuiz";
import { passages } from "../src/data/passages";
import { grammarTopics } from "../src/data/grammar";
import {
  REMOVED_HEADWORDS,
  OFFENSIVE_EN,
  OFFENSIVE_JA,
  cleanSenseMeaning,
  isOffensiveEntry
} from "../src/offensiveTerms";

/**
 * 露骨な性的表現・罵倒語・差別語を、教材のどこにも出さない。
 *
 * 単語データ・語義・語法は辞書（EJDict / WordNet）から機械的に作っているため、
 * 辞書の俗語や差別語がそのまま画面に出ていた（辞書のいちばん最初の語 a のコロケーションに
 * "son of a bitch"、suck の語義に「フェラチオをする」、mad に「気違いの」）。
 * 生成し直したり単語を足したりすると、型検査もビルドも通ったまま戻ってくるので、
 * 決まり（src/offensiveTerms.ts）ですべてのデータを検査する。
 */

/** 値の中の文字列をすべて取り出す（長文・文法・語義分別のような入れ子のデータ用） */
function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach(v => allStrings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach(v => allStrings(v, out));
  return out;
}

function offending(texts: string[]): string[] {
  return texts.filter(t => OFFENSIVE_EN.test(t) || OFFENSIVE_JA.test(t));
}

describe("見出し語", () => {
  it("外した語は収録されていない", () => {
    const words = new Set(vocabulary.map(w => w.word.toLowerCase()));
    expect(Object.keys(REMOVED_HEADWORDS).filter(w => words.has(w))).toEqual([]);
  });

  it("見出し・訳・例文・和訳・四択の選択肢に出さない", () => {
    const bad: string[] = [];
    for (const w of vocabulary) {
      const texts = [w.word, w.translation, w.sentence, w.sentenceTranslation, ...(w.options || []), ...(w.sentenceOptions || [])];
      for (const t of offending(texts.filter(Boolean) as string[])) bad.push(`${w.word}: ${t}`);
    }
    expect(bad).toEqual([]);
  });

  it("外した語を誤答にも使っていない（訳も綴りも残さない）", () => {
    // 見出しから消しても、他の語の四択に誤答として訳が残っていると画面に出続ける
    const removed = new Set(Object.keys(REMOVED_HEADWORDS));
    const bad = vocabulary
      .filter(w => (w.sentenceOptions || []).some(o => removed.has(o.toLowerCase())))
      .map(w => w.word);
    expect(bad).toEqual([]);
  });
});

describe("辞書から作ったデータ", () => {
  it("語義と、その用例に出さない", () => {
    const bad: string[] = [];
    for (const [id, list] of Object.entries(wordSenses)) {
      for (const s of list) {
        for (const t of offending([s.meaning, s.usage || ""].filter(Boolean))) bad.push(`${id}: ${t}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("コロケーションと語族に出さない", () => {
    const bad: string[] = [];
    for (const [id, u] of Object.entries(wordUsage)) {
      for (const c of u.collocations || []) if (isOffensiveEntry(c.phrase, c.meaning)) bad.push(`${id}: ${c.phrase}「${c.meaning}」`);
      for (const f of u.family || []) if (isOffensiveEntry(f.word, f.meaning)) bad.push(`${id}: ${f.word}「${f.meaning}」`);
    }
    expect(bad).toEqual([]);
  });

  it("消した語を参照している語義・語法・類義語が無い", () => {
    const ids = new Set(vocabulary.map(w => w.id));
    const stale = [
      ...Object.keys(wordSenses).filter(id => !ids.has(id)).map(id => `語義 ${id}`),
      ...Object.keys(wordUsage).filter(id => !ids.has(id)).map(id => `語法 ${id}`),
      ...Object.entries(wordSynonyms).flatMap(([id, e]) =>
        [id, ...e.same, ...e.distractors].filter(x => !ids.has(x)).map(x => `類義語 ${id} → ${x}`))
    ];
    expect(stale).toEqual([]);
  });
});

describe("書き下ろしのデータ", () => {
  it("長文・文法・語義分別クイズに出さない", () => {
    const bad = offending([
      ...allStrings(passages),
      ...allStrings(grammarTopics),
      ...allStrings(senseQuiz)
    ]);
    expect(bad).toEqual([]);
  });
});

describe("語義の整え方（cleanSenseMeaning）", () => {
  it("不適切な断片だけを落とし、残りの意味は残す", () => {
    expect(cleanSenseMeaning("気が狂った,気違いの")).toBe("気が狂った");
    expect(cleanSenseMeaning("吸うこと,吸収・フェラチオをする")).toBe("吸うこと,吸収");
    expect(cleanSenseMeaning("(知的・精神的に対して)動物的な;肉欲的な")).toBe("(知的・精神的に対して)動物的な");
  });

  it("何も残らなければ語義ごと落とす", () => {
    expect(cleanSenseMeaning("色欲,肉欲")).toBeNull();
    expect(cleanSenseMeaning("〈女性〉に暴行を加える、強姦する")).toBeNull();
  });

  it("差別的な言い回しは意味を残して言い換える", () => {
    expect(cleanSenseMeaning("びっこを引く")).toBe("足を引きずる");
    expect(cleanSenseMeaning("〈人・動物〉をかたわにする")).toBe("〈人・動物〉の手足を不自由にする");
  });

  it("熟語の一部として現れる無害な語には当たらない", () => {
    // 当たると「理性的な」「不具合」のような普通の語義まで消えてしまう
    for (const ok of ["(人が)理性的な,分別のある", "虫、（プログラムの）不具合", "ビールス,ろ過性病原体", "衰えきった、女性的な"]) {
      expect(cleanSenseMeaning(ok)).toBe(ok);
    }
    for (const ok of ["Tom and Dick were both heroes", "cocktail party", "dumbfounded", "secondary sex characteristic", "scrape"]) {
      expect(OFFENSIVE_EN.test(ok), ok).toBe(false);
    }
  });
});
