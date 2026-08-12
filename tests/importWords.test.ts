import { describe, it, expect } from "vitest";
import { parseCSV, buildDistractors, normalizeImportedWord } from "../src/importWords";
import { makeWord } from "./fixtures";
import { Word } from "../src/types";

/**
 * 外から入ってきた単語の取り込み。
 *
 * CSV・PDF・AI生成のいずれも、こちらの決めた形で来るとは限らない。
 * そのまま保存すると、型検査もビルドも通り抜けたうえで
 *   - level が不正 → その語がどのレベルのクイズにも一度も出ない
 *   - options が配列でない → 選択肢0個の問題ができ、そこから先へ進めない
 * という状態になる。エラーは出ないので気づけない。
 *
 * 画面の中に書かれていてテストから触れなかったので、切り出して固定する。
 */

const POOL: Word[] = [
  makeWord({ id: "p1", word: "beautiful", translation: "美しい", level: "junior", pos: "adjective" }),
  makeWord({ id: "p2", word: "quiet", translation: "静かな", level: "junior", pos: "adjective" }),
  makeWord({ id: "p3", word: "small", translation: "小さい", level: "junior", pos: "adjective" }),
  makeWord({ id: "p4", word: "large", translation: "大きい", level: "junior", pos: "adjective" }),
  makeWord({ id: "p5", word: "run", translation: "走る", level: "junior", pos: "verb" }),
  makeWord({ id: "p6", word: "walk", translation: "歩く", level: "junior", pos: "verb" })
];

describe("CSVの読み取り", () => {
  it("行と列に分ける", () => {
    expect(parseCSV("a,b\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("引用符の中のカンマを区切りにしない", () => {
    // 訳語に読点が入るのはふつうのこと（「美しい、きれいな」）
    expect(parseCSV('beautiful,"美しい,きれいな"')).toEqual([["beautiful", "美しい,きれいな"]]);
  });

  it("引用符の中の改行を行の切れ目にしない", () => {
    expect(parseCSV('a,"one\ntwo"')).toEqual([["a", "one\ntwo"]]);
  });

  it("二重の引用符を1つに戻す", () => {
    expect(parseCSV('a,"say ""hi"""')).toEqual([["a", 'say "hi"']]);
  });

  it("Windows の改行を扱える", () => {
    expect(parseCSV("a,b\r\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("空行を落とす", () => {
    expect(parseCSV("a,b\n\n\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("空の入力でも落ちない", () => {
    expect(parseCSV("")).toEqual([]);
  });
});

describe("誤選択肢を集める", () => {
  const target = { word: "big", translation: "大きな", level: "junior" as const, pos: "adjective" as const };

  it("正解そのものは混ぜない", () => {
    const d = buildDistractors(target, POOL, "translation", 3);
    expect(d).not.toContain("大きな");
  });

  it("求めた数を超えない", () => {
    expect(buildDistractors(target, POOL, "translation", 2).length).toBeLessThanOrEqual(2);
  });

  it("候補が足りなければ、取れた分だけ返す", () => {
    // 正解で埋めると「選択肢に正解が2つ」になってしまう
    const d = buildDistractors(target, [POOL[0]], "translation", 3);
    expect(d.length).toBeLessThanOrEqual(1);
    expect(new Set(d).size).toBe(d.length);
  });

  it("英単語の側も選べる", () => {
    const d = buildDistractors(target, POOL, "word", 3);
    expect(d.every(x => /^[a-z]+$/.test(x))).toBe(true);
  });
});

describe("取り込んだ単語を整える", () => {
  it("単語か訳が欠けていれば取り込まない", () => {
    expect(normalizeImportedWord({ word: "", translation: "意味" }, "csv", 0, POOL)).toBeNull();
    expect(normalizeImportedWord({ word: "word", translation: "  " }, "csv", 0, POOL)).toBeNull();
    expect(normalizeImportedWord(null, "csv", 0, POOL)).toBeNull();
  });

  it("不正なレベルを既定値に直す", () => {
    // "SENIOR" のままだと w.level === level にどれも一致せず、
    // どのレベルのクイズにも出てこない語ができてしまう
    const w = normalizeImportedWord({ word: "test", translation: "試験", level: "SENIOR" }, "csv", 0, POOL);
    expect(w!.level).toBe("senior");
  });

  it("正しいレベルはそのまま使う", () => {
    const w = normalizeImportedWord({ word: "test", translation: "試験", level: "advanced" }, "csv", 0, POOL);
    expect(w!.level).toBe("advanced");
  });

  it("選択肢が壊れていても4択を作る", () => {
    const w = normalizeImportedWord(
      { word: "test", translation: "試験", options: "not-an-array" }, "csv", 0, POOL
    );
    expect(w!.options.length).toBeGreaterThanOrEqual(2);
    expect(w!.options).toContain("試験");
  });

  it("選択肢に正解が必ず入る", () => {
    const w = normalizeImportedWord(
      { word: "test", translation: "試験", options: ["ア", "イ", "ウ", "エ"] }, "csv", 0, POOL
    );
    expect(w!.options).toContain("試験");
  });

  it("英語の選択肢にも見出し語が必ず入る", () => {
    const w = normalizeImportedWord(
      { word: "test", translation: "試験", sentenceOptions: ["a", "b", "c", "d"] }, "csv", 0, POOL
    );
    expect(w!.sentenceOptions).toContain("test");
  });

  it("例文が無ければ枠を用意する", () => {
    const w = normalizeImportedWord({ word: "test", translation: "試験" }, "csv", 0, POOL);
    expect(w!.sentence).toContain("[_____]");
    expect(w!.sentenceTranslation).toBeTruthy();
  });

  it("穴の無い例文には穴を足す", () => {
    const w = normalizeImportedWord(
      { word: "test", translation: "試験", sentence: "This is a test." }, "csv", 0, POOL
    );
    expect(w!.sentence).toContain("[_____]");
  });

  it("品詞が無ければ推測する", () => {
    const w = normalizeImportedWord({ word: "quickly", translation: "すばやく" }, "csv", 0, POOL);
    expect(["verb", "noun", "adjective", "adverb", "other"]).toContain(w!.pos);
  });

  it("知らない品詞名は使わない", () => {
    const w = normalizeImportedWord(
      { word: "test", translation: "試験", pos: "gerund" }, "csv", 0, POOL
    );
    expect(w!.pos).not.toBe("gerund");
  });

  it("IDが無ければ接頭辞を付けて作る", () => {
    const w = normalizeImportedWord({ word: "test", translation: "試験" }, "pdf", 3, POOL);
    expect(w!.id.startsWith("pdf_")).toBe(true);
  });

  it("IDがあればそのまま使う", () => {
    const w = normalizeImportedWord({ id: "keep_me", word: "test", translation: "試験" }, "csv", 0, POOL);
    expect(w!.id).toBe("keep_me");
  });

  it("前後の空白を落とす", () => {
    const w = normalizeImportedWord({ word: "  test  ", translation: "  試験 " }, "csv", 0, POOL);
    expect(w!.word).toBe("test");
    expect(w!.translation).toBe("試験");
  });
});
