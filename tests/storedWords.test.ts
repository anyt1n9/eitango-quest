import { describe, it, expect } from "vitest";
import { sanitizeStoredWords } from "../src/storedWords";

/**
 * 保存されていた追加単語（quest_vocab_custom）の検査。
 * 綴りは辞書の検索や重複の確認で無条件に使うので、欠けた要素が1件あると画面ごと落ちる。
 */
const GOOD = {
  id: "ai_1", word: "zebra", translation: "シマウマ", level: "junior",
  options: ["シマウマ", "馬", "牛", "羊"], sentence: "I saw a [_____].", sentenceTranslation: "シマウマを見た。",
  sentenceOptions: ["zebra", "horse", "cow", "sheep"], pos: "noun"
};

describe("追加した単語の検査（sanitizeStoredWords）", () => {
  it("形の正しい語はそのまま残す", () => {
    expect(sanitizeStoredWords([GOOD])).toEqual([GOOD]);
  });

  it("要素が null・文字列、ID・綴り・訳の無いものは捨てる", () => {
    const out = sanitizeStoredWords([
      null, "zebra", 42,
      { ...GOOD, id: "" }, { ...GOOD, id: 1 },
      { ...GOOD, id: "a", word: "  " }, { ...GOOD, id: "b", word: undefined },
      { ...GOOD, id: "c", translation: "" },
      { ...GOOD, id: "ok" }
    ]);
    expect(out.map(w => w.id)).toEqual(["ok"]);
  });

  it("選択肢・例文の欠けは空で補い、不正なレベル・品詞は直す", () => {
    const [w] = sanitizeStoredWords([{ id: "x", word: "zebra", translation: "シマウマ", level: "SENIOR", pos: "animal", options: ["シマウマ", 3, null] }]);
    expect(w).toEqual({
      id: "x", word: "zebra", translation: "シマウマ", level: "senior",
      options: ["シマウマ"], sentence: "", sentenceTranslation: "", sentenceOptions: []
    });
  });

  it("収録語や前の要素と同じ ID は捨てる", () => {
    const out = sanitizeStoredWords([{ ...GOOD, id: "j1" }, GOOD, { ...GOOD, word: "other" }], new Set(["j1"]));
    expect(out.map(w => w.word)).toEqual(["zebra"]);
  });
});
