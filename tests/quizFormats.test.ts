import { describe, it, expect } from "vitest";
import {
  QUIZ_FORMATS,
  QUIZ_FORMAT_LABELS,
  QuizFormat,
  canSpell,
  canFillSentence,
  canAnswerInEnglish,
  canChooseMeaning,
  wordsForFormat,
  countByFormat
} from "../src/quizFormats";
import { initialVocabulary } from "../src/data/vocabulary";
import { makeWord } from "./fixtures";

/**
 * 出題形式。
 *
 * 復習（今日の復習・苦手単語の復習）はどちらも四択に固定されていて、
 * 綴りや文穴埋めで覚えた語も四択でしか出し直せなかった。
 * 形式を選べるようにしたが、形式によっては出題できない語がある。
 * 出せない語を混ぜるとセッションが空になって学習が止まるため、
 * ここでその絞り込みを固定する。
 */

const FORMATS: QuizFormat[] = ["word", "sentence", "listening", "spelling", "reverse"];

describe("形式の一覧", () => {
  it("5つの形式すべてにラベルと説明がある", () => {
    expect(QUIZ_FORMATS).toHaveLength(5);
    for (const f of QUIZ_FORMATS) {
      expect(f.label, f.key).toBeTruthy();
      expect(f.description, f.key).toBeTruthy();
    }
  });

  it("ラベルの逆引きが一覧と一致する", () => {
    for (const f of QUIZ_FORMATS) expect(QUIZ_FORMAT_LABELS[f.key]).toBe(f.label);
  });

  it("キーが重複していない", () => {
    expect(new Set(QUIZ_FORMATS.map(f => f.key)).size).toBe(QUIZ_FORMATS.length);
  });
});

describe("綴りで出せる語", () => {
  it("英字だけの語は出せる", () => {
    expect(canSpell(makeWord({ word: "beautiful" }))).toBe(true);
    expect(canSpell(makeWord({ word: "well-known" }))).toBe(true);
    expect(canSpell(makeWord({ word: "look forward to" }))).toBe(true);
  });

  it("記号や数字を含む見出しは出せない", () => {
    // 文法パターンの見出しは書き取りにならない
    expect(canSpell(makeWord({ word: "Mr." }))).toBe(false);
    expect(canSpell(makeWord({ word: "No.1" }))).toBe(false);
    expect(canSpell(makeWord({ word: "how many ~?" }))).toBe(false);
  });

  it("1文字の語は出せない", () => {
    expect(canSpell(makeWord({ word: "a" }))).toBe(false);
  });

  it("空の見出しでも落ちない", () => {
    expect(canSpell(makeWord({ word: "" }))).toBe(false);
  });
});

describe("文穴埋めで出せる語", () => {
  it("例文と英語の選択肢があれば出せる", () => {
    expect(canFillSentence(makeWord())).toBe(true);
  });

  it("例文が無ければ出せない", () => {
    expect(canFillSentence(makeWord({ sentence: "" }))).toBe(false);
    expect(canFillSentence(makeWord({ sentence: "   " }))).toBe(false);
  });

  it("英語の選択肢が足りなければ出せない", () => {
    expect(canFillSentence(makeWord({ sentenceOptions: [] }))).toBe(false);
    expect(canFillSentence(makeWord({ sentenceOptions: ["beautiful"] }))).toBe(false);
  });
});

describe("日→英・四択で出せる語", () => {
  it("日→英は英語の選択肢が要る", () => {
    expect(canAnswerInEnglish(makeWord())).toBe(true);
    expect(canAnswerInEnglish(makeWord({ sentenceOptions: [] }))).toBe(false);
  });

  it("四択は日本語の選択肢が要る", () => {
    expect(canChooseMeaning(makeWord())).toBe(true);
    expect(canChooseMeaning(makeWord({ options: [] }))).toBe(false);
  });
});

describe("wordsForFormat", () => {
  const words = [
    makeWord({ id: "ok", word: "beautiful" }),
    makeWord({ id: "idiom", word: "how many ~?" }),           // 綴りで出せない
    makeWord({ id: "nosentence", word: "quiet", sentence: "" }), // 文穴埋めで出せない
    makeWord({ id: "noopts", word: "silent", options: [], sentenceOptions: [] })
  ];

  it("形式ごとに出せる語だけを残す", () => {
    expect(wordsForFormat(words, "spelling").map(w => w.id)).toEqual(["ok", "nosentence", "noopts"]);
    expect(wordsForFormat(words, "sentence").map(w => w.id)).toEqual(["ok", "idiom"]);
    expect(wordsForFormat(words, "reverse").map(w => w.id)).toEqual(["ok", "idiom", "nosentence"]);
    expect(wordsForFormat(words, "word").map(w => w.id)).toEqual(["ok", "idiom", "nosentence"]);
  });

  it("四択とリスニングは同じ条件（どちらも日本語の選択肢を使う）", () => {
    expect(wordsForFormat(words, "listening")).toEqual(wordsForFormat(words, "word"));
  });

  it("空の配列でも落ちない", () => {
    for (const f of FORMATS) expect(wordsForFormat([], f)).toEqual([]);
  });

  it("元の配列を書き換えない", () => {
    const before = words.map(w => w.id);
    wordsForFormat(words, "spelling");
    expect(words.map(w => w.id)).toEqual(before);
  });
});

describe("countByFormat", () => {
  it("形式ごとの語数を返す", () => {
    const counts = countByFormat([
      makeWord({ id: "a", word: "beautiful" }),
      makeWord({ id: "b", word: "how many ~?" })
    ]);
    expect(counts.spelling).toBe(1);
    expect(counts.word).toBe(2);
  });

  it("すべての形式の数を返す（画面で無効化を判断するため）", () => {
    const counts = countByFormat([]);
    for (const f of FORMATS) expect(counts[f], f).toBe(0);
  });
});

describe("収録データでの出題可能数", () => {
  it("どの形式でも十分な数の語を出せる", () => {
    const counts = countByFormat(initialVocabulary);
    for (const f of FORMATS) {
      expect(counts[f], f).toBeGreaterThan(initialVocabulary.length * 0.9);
    }
  });

  it("綴りで出せない見出しが少しはある（絞り込みが効いていることの確認）", () => {
    // イディオムや文法パターンの見出しは書き取りにできない。
    // ここが0になっていたら、絞り込みが素通りしている
    const notSpellable = initialVocabulary.filter(w => !canSpell(w));
    expect(notSpellable.length).toBeGreaterThan(0);
  });
});
