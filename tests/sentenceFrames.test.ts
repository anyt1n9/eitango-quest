import { describe, it, expect } from "vitest";
import {
  Frame, NOUN, VERB_TRANS, VERB_INTRANS, ADJ_QUALITY, ADJ_ATTR, ADJ_STATE, ADV, OTHER,
  adjectivePoolKey, insertForm
} from "../scripts/rewrite_template_sentences";

/**
 * 例文の文枠そのものの検査。
 *
 * 収録データの検査（vocabulary.data.test.ts）は結果を見るが、こちらは材料を見る。
 * 枠を1つ足したときの綴りミスや穴埋め記号の抜けは、ここで止める。
 */

const POOLS: [name: string, frames: Frame[]][] = [
  ["NOUN", NOUN],
  ["VERB_TRANS", VERB_TRANS],
  ["VERB_INTRANS", VERB_INTRANS],
  ["ADJ_QUALITY", ADJ_QUALITY],
  ["ADJ_ATTR", ADJ_ATTR],
  ["ADJ_STATE", ADJ_STATE],
  ["ADV", ADV],
  ["OTHER", OTHER],
];

const ALL = POOLS.flatMap(([, f]) => f);

describe("文枠の形", () => {
  it.each(POOLS)("%s の英文に穴埋め記号がちょうど1つある", (_name, frames) => {
    expect(frames.filter(f => (f.en.match(/\[_____\]/g) || []).length !== 1).map(f => f.en)).toEqual([]);
  });

  it.each(POOLS)("%s の和文に差し込み位置 {} がちょうど1つある", (_name, frames) => {
    expect(frames.filter(f => (f.ja.match(/\{\}/g) || []).length !== 1).map(f => f.ja)).toEqual([]);
  });

  it("英文が大文字で始まり終止符で終わる", () => {
    expect(ALL.filter(f => !/^[A-Z]/.test(f.en) || !/[.!?]$/.test(f.en)).map(f => f.en)).toEqual([]);
  });

  it("英文がASCIIだけでできている", () => {
    // 編集中に紛れ込む全角ダッシュやキリル文字を止める
    expect(ALL.filter(f => /[^\x20-\x7e]/.test(f.en)).map(f => f.en)).toEqual([]);
  });

  it("和文が日本語で書かれている", () => {
    expect(ALL.filter(f => !/[ぁ-んァ-ヶ一-鿿]/.test(f.ja)).map(f => f.ja)).toEqual([]);
  });

  it("同じ英文の枠が重複していない", () => {
    const seen = new Set<string>();
    const dup: string[] = [];
    for (const f of ALL) {
      if (seen.has(f.en)) dup.push(f.en);
      seen.add(f.en);
    }
    expect(dup).toEqual([]);
  });

  it("不定冠詞 a/an の直後に穴埋めを置かない", () => {
    // "a important plan" のように a/an を誤る枠を作らないための決まり。
    // 冠詞が必要な位置では the / this / his などを使う
    expect(ALL.filter(f => /\ba \[_____\]|\ban \[_____\]/.test(f.en)).map(f => f.en)).toEqual([]);
  });
});

describe("形容詞の文枠の用法", () => {
  it("連体専用プールの枠は穴埋めの直後に名詞が来る", () => {
    // 「電気の」のような関係形容詞は述語に置けないため、必ず修飾語として使う
    expect(ADJ_ATTR.filter(f => !/\[_____\] [a-z]/.test(f.en)).map(f => f.en)).toEqual([]);
  });

  it("連体専用プールの枠はすべて attr 形で差し込む", () => {
    // pred 形にすると「電気」歴史 のように「の」が落ちてしまう
    expect(ADJ_ATTR.filter(f => f.form !== "attr").map(f => f.en)).toEqual([]);
  });

  it("状態プールの枠は述語で使う", () => {
    expect(ADJ_STATE.filter(f => f.form === "attr").map(f => f.en)).toEqual([]);
  });

  it("述語で使う和文は「です」「でした」など体言に接続できる形で終わる", () => {
    // 「重要な」から「な」を落とした形を差し込むため、
    // 「〜ものでした」「〜なります」のように連体形を要求する語尾は使えない
    const pred = [...ADJ_QUALITY, ...ADJ_STATE].filter(f => f.form !== "attr");
    expect(pred.filter(f => /」(ものでした|ものです|なります|なりました|ことで|ように見え)/.test(f.ja))
      .map(f => f.ja)).toEqual([]);
  });
});

describe("adjectivePoolKey", () => {
  it("「〜の」で終わる訳語は連体専用プールへ送る", () => {
    expect(adjectivePoolKey("electric", "電気の")).toBe("adjAttr");
    expect(adjectivePoolKey("medical", "医学の")).toBe("adjAttr");
    expect(adjectivePoolKey("mental", "精神の，心の")).toBe("adjAttr");
  });

  it("「〜た」「〜して」で終わる訳語は状態プールへ送る", () => {
    expect(adjectivePoolKey("tired", "疲れた")).toBe("adjState");
    expect(adjectivePoolKey("isolated", "孤立した、隔離された")).toBe("adjState");
    expect(adjectivePoolKey("confident", "確信して")).toBe("adjState");
  });

  it("「〜な」「〜い」で終わる訳語は一般の性質プールへ送る", () => {
    expect(adjectivePoolKey("important", "重要な、大切な")).toBe("adjQuality");
    expect(adjectivePoolKey("beautiful", "美しい、きれいな")).toBe("adjQuality");
  });

  it("冠詞を伴えない限定詞はその他のプールへ送る", () => {
    // "the several system" のような非文を作らないため
    for (const w of ["several", "some", "each", "another", "various", "every"]) {
      expect(adjectivePoolKey(w, "幾つかの")).toBe("other");
    }
  });
});

describe("insertForm", () => {
  it("述語では形容詞の「な」「の」を落とす", () => {
    expect(insertForm("adjective", "重要な、大切な", "pred")).toBe("重要");
    expect(insertForm("adjective", "電気の", "pred")).toBe("電気");
  });

  it("連体では語尾をそのまま残す", () => {
    expect(insertForm("adjective", "電気の", "attr")).toBe("電気の");
    expect(insertForm("adjective", "重要な、大切な", "attr")).toBe("重要な");
  });

  it("い形容詞は述語でもそのまま", () => {
    expect(insertForm("adjective", "美しい、きれいな", "pred")).toBe("美しい");
  });

  it("動詞は他動詞の「を」を落とす", () => {
    expect(insertForm("verb", "を許可する", "pred")).toBe("許可する");
  });

  it("括弧書きと先頭の「〜」を取り除く", () => {
    expect(insertForm("other", "〜しよう（Let's 〜）", "pred")).toBe("しよう");
  });

  it("第一語義だけを使う", () => {
    expect(insertForm("noun", "図書館、書庫", "pred")).toBe("図書館");
  });

  it("空にならない", () => {
    expect(insertForm("noun", "（副）", "pred")).toBeTruthy();
  });
});
