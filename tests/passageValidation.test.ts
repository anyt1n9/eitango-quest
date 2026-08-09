import { describe, it, expect } from "vitest";
import { sanitizePassage, sanitizePassages } from "../src/passageValidation";
import { passages } from "../src/data/passages";

/**
 * localStorage に保存された長文が壊れていても画面が落ちないことを確かめる。
 * 読み出し側（readStoredArray）は「配列であること」しか見ていないため、
 * 要素の形はここで担保する。
 */

const valid = {
  id: "aip_x1",
  level: "senior",
  title: "The Lighthouse",
  englishParagraphs: ["The lighthouse stood alone.", "Nobody had visited it for years."],
  japaneseParagraphs: ["灯台はひとりで立っていた。", "何年も誰も訪れていなかった。"],
  vocabularyHighlight: [{ word: "lighthouse", translation: "灯台" }],
  description: "静かな灯台の話",
  pointReward: 150,
  questions: [{ question: "灯台はどうなっていましたか。", options: ["孤立していた", "壊れていた"], correctIndex: 0 }]
};

describe("sanitizePassage", () => {
  it("正しい長文はそのまま通す", () => {
    const p = sanitizePassage(valid)!;
    expect(p.id).toBe("aip_x1");
    expect(p.level).toBe("senior");
    expect(p.englishParagraphs).toHaveLength(2);
    expect(p.questions).toHaveLength(1);
  });

  it("英文が無いものは長文として成立しないので捨てる", () => {
    expect(sanitizePassage({ ...valid, englishParagraphs: [] })).toBeNull();
    expect(sanitizePassage({ ...valid, englishParagraphs: "文字列" })).toBeNull();
    expect(sanitizePassage({ ...valid, englishParagraphs: ["", "  "] })).toBeNull();
  });

  it("オブジェクトでない値を捨てる", () => {
    for (const v of [null, undefined, 42, "text", true, []]) {
      expect(sanitizePassage(v)).toBeNull();
    }
  });

  it("和訳が足りなければ空文字で補い、段落の対応を保つ", () => {
    // 段落数がずれると本文と訳の対応が崩れる
    const p = sanitizePassage({ ...valid, japaneseParagraphs: ["最初の段落だけ"] })!;
    expect(p.japaneseParagraphs).toHaveLength(p.englishParagraphs.length);
    expect(p.japaneseParagraphs[1]).toBe("");
  });

  it("和訳の途中が空でも、以降の段落の対応がずれない", () => {
    // 空要素を取り除くと後続が前へ詰まるため、独立にフィルタすると対応が崩れる
    const p = sanitizePassage({
      ...valid,
      englishParagraphs: ["EN1", "EN2", "EN3"],
      japaneseParagraphs: ["和訳1", "", "和訳3"]
    })!;
    expect(p.englishParagraphs).toEqual(["EN1", "EN2", "EN3"]);
    expect(p.japaneseParagraphs).toEqual(["和訳1", "", "和訳3"]);
  });

  it("英文の途中が空でも、残った段落の訳が正しく対応する", () => {
    const p = sanitizePassage({
      ...valid,
      englishParagraphs: ["EN1", "", "EN3"],
      japaneseParagraphs: ["和訳1", "和訳2", "和訳3"]
    })!;
    expect(p.englishParagraphs).toEqual(["EN1", "EN3"]);
    // EN3 に対応するのは 和訳3（和訳2 ではない）
    expect(p.japaneseParagraphs).toEqual(["和訳1", "和訳3"]);
  });

  it("和訳が文字列でない要素は空文字にする", () => {
    const p = sanitizePassage({
      ...valid,
      englishParagraphs: ["EN1", "EN2"],
      japaneseParagraphs: ["和訳1", 42]
    })!;
    expect(p.japaneseParagraphs).toEqual(["和訳1", ""]);
  });

  it("和訳が丸ごと欠けていても落ちない", () => {
    const p = sanitizePassage({ ...valid, japaneseParagraphs: undefined })!;
    expect(p.japaneseParagraphs).toEqual(["", ""]);
  });

  it("id が欠けていれば割り当てる（読了管理が壊れるため）", () => {
    const p = sanitizePassage({ ...valid, id: undefined }, 3)!;
    expect(typeof p.id).toBe("string");
    expect(p.id).not.toBe("");
  });

  it("level が不正なら初級に落とす", () => {
    expect(sanitizePassage({ ...valid, level: "SENIOR" })!.level).toBe("junior");
    expect(sanitizePassage({ ...valid, level: undefined })!.level).toBe("junior");
  });

  it("獲得ポイントが数値でなければ既定値にする", () => {
    expect(sanitizePassage({ ...valid, pointReward: "150" })!.pointReward).toBe(100);
    expect(sanitizePassage({ ...valid, pointReward: -5 })!.pointReward).toBe(100);
    expect(sanitizePassage({ ...valid, pointReward: NaN })!.pointReward).toBe(100);
  });

  it("タイトルが欠けていても既定のタイトルで開ける", () => {
    expect(sanitizePassage({ ...valid, title: "" })!.title).toBe("無題の長文");
    expect(sanitizePassage({ ...valid, title: 42 })!.title).toBe("無題の長文");
  });

  it("ハイライト語の壊れた要素を取り除く", () => {
    const p = sanitizePassage({
      ...valid,
      vocabularyHighlight: [
        { word: "lighthouse", translation: "灯台" },
        { word: "", translation: "空の見出し" },
        { translation: "word が無い" },
        null,
        "文字列",
        { word: "alone" } // translation が無い
      ]
    })!;
    expect(p.vocabularyHighlight).toEqual([{ word: "lighthouse", translation: "灯台" }]);
  });

  it("ハイライト語が配列でなくても空配列にする", () => {
    expect(sanitizePassage({ ...valid, vocabularyHighlight: "灯台" })!.vocabularyHighlight).toEqual([]);
  });

  it("設問の正解位置が範囲外のものを捨てる", () => {
    const p = sanitizePassage({
      ...valid,
      questions: [
        { question: "正しい設問", options: ["A", "B"], correctIndex: 1 },
        { question: "範囲外", options: ["A", "B"], correctIndex: 5 },
        { question: "負の値", options: ["A", "B"], correctIndex: -1 },
        { question: "小数", options: ["A", "B"], correctIndex: 0.5 },
        { question: "選択肢が1つ", options: ["A"], correctIndex: 0 },
        { question: "", options: ["A", "B"], correctIndex: 0 },
        null
      ]
    })!;
    expect(p.questions).toHaveLength(1);
    expect(p.questions![0].question).toBe("正しい設問");
  });

  it("空の選択肢を取り除いても正解が同じ文言を指し続ける", () => {
    // 空要素を落とすと位置が前へ詰まるため、correctIndex を数字のまま持ち回ると
    // 別の選択肢が正解になってしまう
    const p = sanitizePassage({
      ...valid,
      questions: [{ question: "設問", options: ["", "正解", "誤り"], correctIndex: 1 }]
    })!;
    expect(p.questions).toHaveLength(1);
    const q = p.questions![0];
    expect(q.options).toEqual(["正解", "誤り"]);
    expect(q.options[q.correctIndex]).toBe("正解");
  });

  it("空の選択肢が複数あってもずれない", () => {
    const p = sanitizePassage({
      ...valid,
      questions: [{ question: "設問", options: ["", "A", "", "本当の正解", "B"], correctIndex: 3 }]
    })!;
    const q = p.questions![0];
    expect(q.options[q.correctIndex]).toBe("本当の正解");
  });

  it("正解そのものが空文字なら設問ごと捨てる", () => {
    // 答えを復元できないため、間違った正解を提示するより出題しない方がよい
    const p = sanitizePassage({
      ...valid,
      questions: [{ question: "設問", options: ["", "A", "B"], correctIndex: 0 }]
    })!;
    expect(p.questions).toEqual([]);
  });

  it("収録済みの設問は正解の文言が変わらない", () => {
    for (const original of passages) {
      const p = sanitizePassage(original)!;
      original.questions!.forEach((q, i) => {
        expect(p.questions![i].options[p.questions![i].correctIndex])
          .toBe(q.options[q.correctIndex]);
      });
    }
  });

  it("設問が配列でなくても空配列にする", () => {
    expect(sanitizePassage({ ...valid, questions: "設問" })!.questions).toEqual([]);
  });
});

describe("sanitizePassages", () => {
  it("配列でなければ空配列", () => {
    for (const v of [null, undefined, {}, "text", 5]) {
      expect(sanitizePassages(v)).toEqual([]);
    }
  });

  it("壊れた要素だけを取り除き、直せるものは残す", () => {
    const list = [valid, null, { ...valid, id: "aip_x2", title: "" }, { englishParagraphs: [] }];
    const out = sanitizePassages(list);
    expect(out).toHaveLength(2);
    expect(out[1].title).toBe("無題の長文");
  });

  it("id の重複を解消する（読了状態が別の長文に伝染するため）", () => {
    const out = sanitizePassages([valid, { ...valid }]);
    expect(out).toHaveLength(2);
    expect(out[0].id).not.toBe(out[1].id);
  });

  it("収録済みの長文はすべてそのまま通る", () => {
    const out = sanitizePassages(passages);
    expect(out).toHaveLength(passages.length);
    out.forEach((p, i) => {
      expect(p.id).toBe(passages[i].id);
      expect(p.title).toBe(passages[i].title);
      expect(p.englishParagraphs).toEqual(passages[i].englishParagraphs);
      expect(p.questions).toHaveLength(passages[i].questions!.length);
    });
  });

  it("何が入っていても例外を投げない", () => {
    const junk = [undefined, 0, "", [], {}, { englishParagraphs: [null, 1, {}] }, NaN];
    expect(() => sanitizePassages(junk)).not.toThrow();
    expect(sanitizePassages(junk)).toEqual([]);
  });
});
