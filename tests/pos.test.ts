import { describe, it, expect } from "vitest";
import { inferPartOfSpeech, getWordPos, getWordPosLabel, POS_LABELS } from "../src/pos";
import { PartOfSpeech } from "../src/types";

/**
 * 品詞推定は「四択の誤答を同じ品詞から選ぶ」土台になっている。
 * ここが崩れると、品詞での消去法が復活して問題が易しくなりすぎる。
 */

/** 手作業でラベル付けした語（チューニングには未使用） */
const LABELLED: [word: string, translation: string, pos: PartOfSpeech][] = [
  // 名詞
  ["library", "図書館", "noun"],
  ["museum", "博物館", "noun"],
  ["information", "情報", "noun"],
  ["happiness", "幸福", "noun"],
  ["ability", "能力", "noun"],
  ["achievement", "業績、達成", "noun"],
  ["scenery", "風景、眺め", "noun"],
  ["zoologist", "動物学者", "noun"],
  ["zoology", "動物学", "noun"],
  ["dogmatism", "独断主義、教条主義", "noun"],
  ["validation", "検証、有効性の確認", "noun"],
  ["spring", "春", "noun"],
  ["butterfly", "チョウ", "noun"],
  ["family", "家族", "noun"],
  // 動詞
  ["decide", "決める、決定する", "verb"],
  ["understand", "理解する", "verb"],
  ["improve", "改善する", "verb"],
  ["realize", "気づく、悟る", "verb"],
  ["establish", "設立する", "verb"],
  ["consider", "熟考する、考慮する", "verb"],
  ["borrow", "借りる", "verb"],
  ["multiply", "掛ける、増やす", "verb"],
  ["run", "走る", "verb"],
  // 形容詞
  ["beautiful", "美しい、きれいな", "adjective"],
  ["expensive", "高価な", "adjective"],
  ["necessary", "必要な", "adjective"],
  ["quick", "速い", "adjective"],
  ["reluctant", "気が進まない", "adjective"],
  ["useful", "役に立つ", "adjective"],
  ["light", "軽い", "adjective"],
  ["friendly", "親しみやすい、友好的な", "adjective"],
  ["daily", "毎日の", "adjective"],
  ["chilly", "肌寒い", "adjective"],
  ["disturbing", "不穏な、動揺させる", "adjective"],
  ["condescending", "見下すような、恩着せがましい", "adjective"],
  ["diminutive", "ごく小さい、小型の", "adjective"],
  ["enervated", "気力を奪われた、衰弱した", "adjective"],
  // 副詞
  ["quickly", "すばやく、速く", "adverb"],
  ["carefully", "注意深く", "adverb"],
  ["quietly", "静かに", "adverb"],
  ["suddenly", "突然", "adverb"],
  ["hardly", "ほとんど〜ない", "adverb"],
  ["always", "いつも", "adverb"],
  ["nevertheless", "それにもかかわらず", "adverb"],
  ["however", "しかしながら", "adverb"],
  // その他（機能語）
  ["although", "〜だけれども", "other"],
  ["between", "〜の間に", "other"],
  ["whom", "誰を", "other"],
  ["someone", "誰か", "other"],
];

describe("inferPartOfSpeech", () => {
  it.each(LABELLED)("%s (%s) → %s", (word, translation, pos) => {
    expect(inferPartOfSpeech(word, translation)).toBe(pos);
  });

  it("ラベル付き語全体の正解率が100%", () => {
    const wrong = LABELLED.filter(([w, t, p]) => inferPartOfSpeech(w, t) !== p);
    expect(wrong.map(([w]) => w)).toEqual([]);
  });

  it("-ly で終わっても副詞でない語を副詞にしない", () => {
    for (const [w, t] of [["family", "家族"], ["butterfly", "チョウ"], ["chilly", "肌寒い"],
                          ["multiply", "掛ける"], ["friendly", "友好的な"], ["reply", "返事"]]) {
      expect(inferPartOfSpeech(w, t)).not.toBe("adverb");
    }
  });

  it("同じ綴りでも収録している語義に従う（多品詞語）", () => {
    // 訳語を機械辞書より優先しているため、アプリが教えている意味と品詞が一致する
    expect(inferPartOfSpeech("spring", "春")).toBe("noun");
    expect(inferPartOfSpeech("spring", "跳ぶ、跳ねる")).toBe("verb");
    expect(inferPartOfSpeech("light", "軽い")).toBe("adjective");
    expect(inferPartOfSpeech("light", "光")).toBe("noun");
  });

  it("熟語・文法パターンの見出しは other", () => {
    expect(inferPartOfSpeech("between A and B", "AとBの間に")).toBe("other");
    expect(inferPartOfSpeech("as soon as possible", "できるだけ早く")).toBe("other");
  });

  it("訳語が空でも必ず有効な品詞を返す", () => {
    for (const w of ["", "xyzzy", "nation", "beautify", "hopeless"]) {
      expect(Object.keys(POS_LABELS)).toContain(inferPartOfSpeech(w, ""));
    }
  });
});

describe("getWordPos", () => {
  it("明示された pos を優先する", () => {
    expect(getWordPos({ word: "spring", translation: "春", pos: "verb" })).toBe("verb");
  });

  it("pos が無ければ推定にフォールバックする（ユーザー追加語）", () => {
    expect(getWordPos({ word: "library", translation: "図書館" })).toBe("noun");
  });

  it("不正な pos が入っていても推定に落とす", () => {
    expect(getWordPos({ word: "library", translation: "図書館", pos: "NOUN" as any })).toBe("noun");
  });

  it("日本語ラベルを返す", () => {
    expect(getWordPosLabel({ word: "library", translation: "図書館" })).toBe("名詞");
    expect(getWordPosLabel({ word: "run", translation: "走る" })).toBe("動詞");
  });
});
