import { describe, it, expect } from "vitest";
import { toFillInSentence, showHoles, HOLE } from "../src/fillIn";
import { normalizeImportedWord } from "../src/importWords";
import { initialVocabulary } from "../src/data/vocabulary";
import { canSpell } from "../src/quizFormats";

/**
 * 例文の穴あけ。
 *
 * 出題画面（例文穴埋め・綴り）は例文を手がかりとして見せるので、
 * 本文に答えの綴りが残っていると問題として成立しない。
 *
 * 以前は「穴の記号が入っていればそのまま使う」としていたため、
 * 取り込んだ単語（AI・CSV・PDF）の
 *   The garden is very beautiful in spring. [_____]
 * のような例文で、穴はあるのに答えも見えていた。
 */

describe("例文を穴埋めにする", () => {
  it("答えのある位置を穴にする", () => {
    expect(toFillInSentence("The garden is very beautiful in spring.", "beautiful"))
      .toBe("The garden is very [_____] in spring.");
  });

  it("大文字小文字が違っても穴にする", () => {
    expect(toFillInSentence("Beautiful gardens are rare.", "beautiful"))
      .toBe("[_____] gardens are rare.");
  });

  it("すでに穴がある例文でも、残った答えを伏せる", () => {
    // 取り込んだ単語はこの形で保存されていた
    expect(toFillInSentence("The garden is very beautiful in spring. [_____]", "beautiful"))
      .toBe("The garden is very [_____] in spring. [_____]");
  });

  it("答えが2回出てくるなら2回とも伏せる", () => {
    expect(toFillInSentence("A beautiful and beautiful day.", "beautiful"))
      .toBe("A [_____] and [_____] day.");
  });

  it("答えが本文に無ければ末尾に穴を足す", () => {
    expect(toFillInSentence("I go to school every day.", "beautiful"))
      .toBe("I go to school every day. [_____]");
  });

  it("語の一部には反応しない", () => {
    // beautifully を伏せると文が壊れる
    expect(toFillInSentence("She sang beautifully today.", "beautiful"))
      .toBe("She sang beautifully today. [_____]");
  });

  it("正規表現の記号を含む見出しでも壊れない", () => {
    expect(() => toFillInSentence("How many books do you have?", "how many ~?")).not.toThrow();
  });

  it("例文が無ければ、穴のある文で代える", () => {
    expect(toFillInSentence("", "beautiful")).toContain(HOLE);
    expect(toFillInSentence(undefined, "beautiful")).toContain(HOLE);
  });

  it("穴は表示用の記号にまとめて置き換わる", () => {
    expect(showHoles("A [_____] and [_____] day.")).toBe("A ＿＿＿ and ＿＿＿ day.");
  });
});

describe("取り込んだ単語", () => {
  it("答えの残った例文を保存しない", () => {
    const w = normalizeImportedWord(
      {
        word: "beautiful",
        translation: "美しい",
        level: "junior",
        sentence: "The garden is very beautiful in spring."
      },
      "csv",
      0,
      []
    );
    expect(w).not.toBeNull();
    expect(w!.sentence).not.toMatch(/\bbeautiful\b/i);
    expect(w!.sentence).toContain(HOLE);
  });
});

describe("収録データ", () => {
  it("綴りで出す語の例文に、答えがそのまま出ていない", () => {
    // 綴りクイズは例文を手がかりに添えるので、本文に答えがあると答えが分かる
    const leaks = initialVocabulary
      .filter(canSpell)
      .filter(w => {
        const esc = w.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        return new RegExp(`\\b${esc}\\b`, "i").test(String(w.sentence));
      })
      .map(w => `${w.word} | ${w.sentence}`);
    expect(leaks.slice(0, 10)).toEqual([]);
  });
});
