import { describe, it, expect } from "vitest";
import { initialVocabulary } from "../src/data/vocabulary";
import { PartOfSpeech } from "../src/types";
import { senses } from "./helpers";

/**
 * 収録データ(7,700語超)そのものの検査。
 *
 * ロジックのテストと違い、こちらは「生成スクリプトを回した結果、
 * 学習者の目に触れる問題が壊れていないか」を見る。
 * 実際に見つかった不具合は型検査もビルドも通り抜けており、
 * 検出できるのはこの層だけだった。
 */

const V = initialVocabulary;
const LEVELS = ["junior", "senior", "senior2", "senior3", "advanced"];
const POS: PartOfSpeech[] = ["verb", "noun", "adjective", "adverb", "other"];

/** 失敗時に「何件・どの語か」が分かるように、違反した語を列挙して比較する */
const violations = (fn: (w: typeof V[number]) => boolean, label: (w: typeof V[number]) => string) =>
  V.filter(fn).map(label).slice(0, 20);

describe("収録データの基本", () => {
  it("語数が十分にある", () => {
    expect(V.length).toBeGreaterThan(7000);
  });

  it("全レベルに単語がある", () => {
    for (const level of LEVELS) {
      expect(V.filter(w => w.level === level).length).toBeGreaterThan(500);
    }
  });

  it("id が重複していない", () => {
    const seen = new Set<string>();
    const dup: string[] = [];
    for (const w of V) {
      if (seen.has(w.id)) dup.push(w.id);
      seen.add(w.id);
    }
    expect(dup).toEqual([]);
  });

  it("見出し語が重複していない", () => {
    const seen = new Set<string>();
    const dup: string[] = [];
    for (const w of V) {
      const k = w.word.trim().toLowerCase();
      if (seen.has(k)) dup.push(k);
      seen.add(k);
    }
    expect(dup).toEqual([]);
  });

  it("level が定義済みの値", () => {
    expect(violations(w => !LEVELS.includes(w.level), w => `${w.id}:${w.level}`)).toEqual([]);
  });

  it("pos が全語に付いていて、値も定義済み", () => {
    expect(violations(w => !w.pos || !POS.includes(w.pos), w => `${w.id}:${w.pos}`)).toEqual([]);
  });
});

describe("見出し語と訳語", () => {
  it("見出し語が空でない", () => {
    expect(violations(w => !w.word || !w.word.trim(), w => w.id)).toEqual([]);
  });

  it("見出し語に英語として成立しない文字が混ざっていない", () => {
    // `false（先頭にバッククォート）のような生成過程の混入を検出する
    expect(violations(
      w => !/^[A-Za-z][A-Za-z.' -]*$/.test(w.word),
      w => `${w.id}:${w.word}`
    )).toEqual([]);
  });

  it("実在しない綴りが残っていない", () => {
    // 英単語リスト(370,105語)と突き合わせて見つかった綴り。
    // 生成スクリプトの再実行で復活していないことを確かめる
    const KNOWN_BAD = ["occation", "abberation", "condiscent", "definit", "diminut",
      "disparateize", "distantical", "distribut", "disturbingal", "dogmaticism",
      "ebullienceal", "enervateal", "coindex", "implicat", "validatement", "`false"];
    expect(violations(
      w => KNOWN_BAD.includes(w.word.toLowerCase()),
      w => w.word
    )).toEqual([]);
  });

  it("訳語が空でなく日本語である", () => {
    expect(violations(
      w => !w.translation.trim() || !/[ぁ-んァ-ヶ一-鿿ー]/.test(w.translation),
      w => `${w.id}:${w.translation}`
    )).toEqual([]);
  });
});

describe("例文", () => {
  it("穴埋め記号がちょうど1つある", () => {
    expect(violations(
      w => (w.sentence.match(/\[_____\]/g) || []).length !== 1,
      w => `${w.id}:${w.sentence}`
    )).toEqual([]);
  });

  it("例文に答えの単語が露出していない", () => {
    // "The museum has a large collection of the [_____]." を museum に割り当てると
    // 問題文を読むだけで答えが分かってしまう
    expect(violations(
      w => new RegExp(`\\b${w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
        .test(w.sentence.replace("[_____]", " ")),
      w => `${w.id}:${w.word} / ${w.sentence}`
    )).toEqual([]);
  });

  it("例文が大文字で始まり終止符で終わる", () => {
    expect(violations(w => !/^[A-Z"'[]/.test(w.sentence), w => `${w.id}:${w.sentence}`)).toEqual([]);
    expect(violations(w => !/[.!?]["']?$/.test(w.sentence), w => `${w.id}:${w.sentence}`)).toEqual([]);
  });

  it("例文に非ASCII文字が混ざっていない", () => {
    // 編集中に紛れ込んだキリル文字やダッシュを検出する
    expect(violations(w => /[^\x20-\x7e]/.test(w.sentence), w => `${w.id}:${w.sentence}`)).toEqual([]);
  });

  it("例文の訳が空でなく日本語である", () => {
    expect(violations(
      w => !w.sentenceTranslation.trim() || !/[ぁ-んァ-ヶ一-鿿]/.test(w.sentenceTranslation),
      w => w.id
    )).toEqual([]);
  });

  it("前置詞句の見出しに形容詞・名詞用の文枠が当たっていない", () => {
    // "in addition" を形容詞と誤判定した結果、
    // "She looked in addition when she heard the news." のような非文が作られていた
    const PHRASE = /^(in|on|at|by|for|with|of|to|from|as|such|no|not|according|due|thanks|instead)\s/i;
    expect(violations(
      w => PHRASE.test(w.word) && w.pos !== "other" && w.pos !== "verb",
      w => `${w.id}:${w.word}(${w.pos}) / ${w.sentence}`
    )).toEqual([]);
  });
});

describe("四択（訳語を選ぶ問題）", () => {
  it("選択肢がちょうど4つある", () => {
    expect(violations(w => w.options.length !== 4, w => `${w.id}:${w.options.length}`)).toEqual([]);
  });

  it("正解が選択肢に含まれる", () => {
    expect(violations(w => !w.options.includes(w.translation), w => w.id)).toEqual([]);
  });

  it("選択肢が重複していない・空でない", () => {
    expect(violations(w => new Set(w.options).size !== w.options.length, w => w.id)).toEqual([]);
    expect(violations(w => w.options.some(o => !o || !o.trim()), w => w.id)).toEqual([]);
  });

  it("誤答の語義が正解と重ならない（正解が2つある問題を作らない）", () => {
    // 誤答の紛らわしさを上げた際に191問がこの状態になった。
    // 例: class の正解「授業」に対する誤答「授業、レッスン、教訓」
    expect(violations(
      w => {
        const correct = new Set(senses(w.translation));
        return w.options.some(o => o !== w.translation && senses(o).some(s => correct.has(s)));
      },
      w => `${w.id}:${w.word} 正解「${w.translation}」`
    )).toEqual([]);
  });

  it("誤答が正解と同じ品詞である（品詞での消去法を封じる）", () => {
    // 同じ訳語を持つ語が複数ある場合があるため、
    // 「その訳語を持つ語のうち1つでも同じ品詞なら可」とする
    const posOfTranslation = new Map<string, Set<PartOfSpeech>>();
    for (const w of V) {
      if (!posOfTranslation.has(w.translation)) posOfTranslation.set(w.translation, new Set());
      posOfTranslation.get(w.translation)!.add(w.pos!);
    }
    expect(violations(
      w => w.options.some(o => {
        const set = posOfTranslation.get(o);
        return !!set && !set.has(w.pos!);
      }),
      w => `${w.id}:${w.word}(${w.pos}) ${w.options.join(" / ")}`
    )).toEqual([]);
  });
});

describe("四択（例文の空所に入る英単語を選ぶ問題）", () => {
  it("選択肢がちょうど4つある", () => {
    expect(violations(w => w.sentenceOptions.length !== 4, w => `${w.id}:${w.sentenceOptions.length}`)).toEqual([]);
  });

  it("正解が選択肢に含まれる", () => {
    expect(violations(w => !w.sentenceOptions.includes(w.word), w => w.id)).toEqual([]);
  });

  it("選択肢が重複していない・空でない", () => {
    expect(violations(w => new Set(w.sentenceOptions).size !== w.sentenceOptions.length, w => w.id)).toEqual([]);
    expect(violations(w => w.sentenceOptions.some(o => !o || !o.trim()), w => w.id)).toEqual([]);
  });

  it("選択肢に非ASCII文字が混ざっていない", () => {
    expect(violations(
      w => /[^\x20-\x7e]/.test(w.sentenceOptions.join("")),
      w => `${w.id}:${w.sentenceOptions.join(" / ")}`
    )).toEqual([]);
  });

  it("誤答が正解と同じ品詞である", () => {
    // 例文穴埋めは、以前は23%の問題で「正解と同じ品詞の選択肢が1つだけ」だった
    const posOfWord = new Map<string, Set<PartOfSpeech>>();
    for (const w of V) {
      if (!posOfWord.has(w.word)) posOfWord.set(w.word, new Set());
      posOfWord.get(w.word)!.add(w.pos!);
    }
    expect(violations(
      w => w.sentenceOptions.some(o => {
        const set = posOfWord.get(o);
        return !!set && !set.has(w.pos!);
      }),
      w => `${w.id}:${w.word}(${w.pos}) ${w.sentenceOptions.join(" / ")}`
    )).toEqual([]);
  });
});
