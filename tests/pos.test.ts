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

  it("前置詞で始まる句は other", () => {
    // "She looked in addition when she heard the news." のような非文を防ぐ
    for (const [w, t] of [["in fact", "実際には"], ["for example", "例えば"],
                          ["according to", "によると"], ["at last", "ついに，やっと"],
                          ["no longer", "もはや～でない"], ["such as", "のような"]]) {
      expect(inferPartOfSpeech(w, t)).toBe("other");
    }
  });

  it("前置詞で終わる句は other（目的語が無いと使えないため）", () => {
    // "I think his idea is quite capable of." のように目的語の欠けた例文を防ぐ
    for (const [w, t] of [["capable of", "ができる，可能で"], ["relevant to", "に関連した"],
                          ["plenty of", "たくさんの"], ["guilty of", "罪を犯して"],
                          ["result in", "結果として"], ["rather than", "よりむしろ"],
                          ["ought to", "すべきである"], ["hundreds of", "何百もの"]]) {
      expect(inferPartOfSpeech(w, t)).toBe("other");
    }
  });

  it("句動詞は前置詞で終わっても動詞のまま", () => {
    for (const [w, t] of [["give up", "をあきらめる"], ["look after", "の世話をする"],
                          ["take off", "を脱ぐ"], ["get up", "起きる"], ["do well", "うまくやる"]]) {
      expect(inferPartOfSpeech(w, t)).toBe("verb");
    }
  });

  it("2語の句でも訳語の示す品詞を補助辞書で上書きしない", () => {
    // 先頭が動詞の2語句を救済する規則が訳語の判定より先に走ると、
    // "catch up"（追いつくこと＝名詞）まで動詞にしてしまう。
    // 判定の優先順位は「訳語 > 補助辞書」でなければならない
    // catch up は前置詞で終わるため最終的に other になるが、動詞にはならない
    expect(inferPartOfSpeech("catch up", "追いつくこと")).not.toBe("verb");
    expect(inferPartOfSpeech("show room", "展示室")).toBe("noun");
    expect(inferPartOfSpeech("cover letter", "添え状")).toBe("noun");
    expect(inferPartOfSpeech("answer sheet", "解答用紙")).toBe("noun");
  });

  it("代名詞句は other", () => {
    expect(inferPartOfSpeech("each other", "お互い")).toBe("other");
    expect(inferPartOfSpeech("the other", "もう一方の")).toBe("other");
    expect(inferPartOfSpeech("one another", "お互いに")).toBe("other");
  });

  it("複合名詞は名詞のまま", () => {
    for (const [w, t] of [["living room", "リビングルーム"], ["bank account", "銀行口座"],
                          ["fossil fuel", "化石燃料"], ["high school", "高校"]]) {
      expect(inferPartOfSpeech(w, t)).toBe("noun");
    }
  });

  it("Object.prototype のメンバー名でも品詞の文字列を返す", () => {
    // 補助辞書をただのオブジェクトで持つと HINT["constructor"] が
    // Object.prototype.constructor（関数）を拾い、品詞として関数が返っていた。
    // 利用者がCSV・PDF・AIで追加しうる見出し語なので、必ず文字列で返す
    for (const w of ["constructor", "valueOf", "hasOwnProperty", "prototype", "__proto__"]) {
      const r = inferPartOfSpeech(w, "");
      expect(typeof r).toBe("string");
      expect(Object.keys(POS_LABELS)).toContain(r);
    }
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
