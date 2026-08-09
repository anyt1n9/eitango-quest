import { describe, it, expect } from "vitest";
import { wordUsage } from "../src/data/wordUsage";
import { initialVocabulary } from "../src/data/vocabulary";
import { VERB_PATTERNS, describePatterns, transitivity } from "../src/usage";
import { shortGloss, isUsefulRelative } from "../scripts/bake_usage";
import { PartOfSpeech } from "../src/types";

/**
 * 語法・コロケーション・語族データ。
 *
 * 訳語だけを覚えても英文は組み立てられない。
 * give を「与える」と覚えても give me the book の形が取れるかは分からず、
 * station を「駅」と覚えても gas station と結び付かない。
 * ここで見るのは、その補いが正しい形で入っているか。
 */

const V = initialVocabulary;
const byId = new Map(V.map(w => [w.id, w]));
const byWord = new Map(V.map(w => [String(w.word).trim().toLowerCase(), w]));
const POS: PartOfSpeech[] = ["verb", "noun", "adjective", "adverb", "other"];

/** 単語の綴りから語法データを引く */
function usageOf(word: string) {
  const w = byWord.get(word);
  return w ? wordUsage[w.id] : undefined;
}

describe("語法データの形", () => {
  it("十分な数の語に付いている", () => {
    expect(Object.keys(wordUsage).length).toBeGreaterThan(4000);
  });

  it("すべての鍵が収録語のIDである", () => {
    const bad = Object.keys(wordUsage).filter(id => !byId.has(id));
    expect(bad).toEqual([]);
  });

  it("中身が空の項目を作らない", () => {
    const bad = Object.entries(wordUsage)
      .filter(([, u]) => !u.family?.length && !u.patterns?.length && !u.collocations?.length)
      .map(([id]) => id);
    expect(bad).toEqual([]);
  });

  it("文型の番号がすべて既知の型である", () => {
    const bad: string[] = [];
    for (const [id, u] of Object.entries(wordUsage)) {
      for (const n of u.patterns || []) if (!VERB_PATTERNS[n]) bad.push(`${id}:${n}`);
    }
    expect(bad).toEqual([]);
  });

  it("文型は動詞として教えている語にだけ付ける", () => {
    // 名詞の medicine に「動詞の語法」を出すと邪魔になるだけ
    const bad = Object.entries(wordUsage)
      .filter(([id, u]) => u.patterns?.length && byId.get(id)!.pos !== "verb")
      .map(([id]) => id);
    expect(bad).toEqual([]);
  });

  it("文型が重複せず昇順に並んでいる", () => {
    const bad: string[] = [];
    for (const [id, u] of Object.entries(wordUsage)) {
      const p = u.patterns;
      if (!p) continue;
      if (new Set(p).size !== p.length) bad.push(`${id}:重複`);
      if (p.some((n, i) => i > 0 && n <= p[i - 1])) bad.push(`${id}:順序`);
    }
    expect(bad).toEqual([]);
  });

  it("語族の品詞が定義済みの値", () => {
    const bad: string[] = [];
    for (const [id, u] of Object.entries(wordUsage)) {
      for (const f of u.family || []) if (!POS.includes(f.pos)) bad.push(`${id}:${f.pos}`);
    }
    expect(bad).toEqual([]);
  });

  it("語族に自分自身や活用形が混ざっていない", () => {
    const bad: string[] = [];
    for (const [id, u] of Object.entries(wordUsage)) {
      const self = String(byId.get(id)!.word).trim().toLowerCase();
      for (const f of u.family || []) {
        if (!isUsefulRelative(self, f.word)) bad.push(`${id}:${self}→${f.word}`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("語族の中で語が重複していない", () => {
    const bad = Object.entries(wordUsage)
      .filter(([, u]) => u.family && new Set(u.family.map(f => f.word)).size !== u.family.length)
      .map(([id]) => id);
    expect(bad).toEqual([]);
  });

  it("コロケーションは必ずその語を含む句である", () => {
    const bad: string[] = [];
    for (const [id, u] of Object.entries(wordUsage)) {
      const self = String(byId.get(id)!.word).trim().toLowerCase();
      for (const c of u.collocations || []) {
        if (!c.phrase.split(" ").includes(self)) bad.push(`${id}:${c.phrase}`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("コロケーションはすべて2語以上の句である", () => {
    const bad: string[] = [];
    for (const [id, u] of Object.entries(wordUsage)) {
      for (const c of u.collocations || []) if (!c.phrase.includes(" ")) bad.push(`${id}:${c.phrase}`);
    }
    expect(bad).toEqual([]);
  });

  it("和訳が日本語で書かれ、空でも長すぎもしない", () => {
    const bad: string[] = [];
    for (const [id, u] of Object.entries(wordUsage)) {
      const glosses = [
        ...(u.family || []).map(f => f.meaning),
        ...(u.collocations || []).map(c => c.meaning)
      ];
      for (const g of glosses) {
        if (!g.trim() || g.length > 21) bad.push(`${id}:${g}`);
        else if (!/[ぁ-んァ-ヶ一-鿿]/.test(g)) bad.push(`${id}:${g}`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("和訳に辞書の記号が残っていない", () => {
    const bad: string[] = [];
    for (const [id, u] of Object.entries(wordUsage)) {
      const glosses = [
        ...(u.family || []).map(f => f.meaning),
        ...(u.collocations || []).map(c => c.meaning)
      ];
      for (const g of glosses) if (/[『』《》〈〉\[\]]/.test(g)) bad.push(`${id}:${g}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("実際の語で確かめる", () => {
  it("give は二重目的語（SVOO）が取れる動詞として出る", () => {
    const u = usageOf("give")!;
    expect(u.patterns).toBeTruthy();
    expect(transitivity(u.patterns)).toMatch(/他動詞/);
  });

  it("tell は人＋that節 の形を持つ", () => {
    const labels = describePatterns(usageOf("tell")!.patterns).map(p => p.label);
    expect(labels).toContain("人＋もの の順に2つ目的語をとる（SVOO）");
    expect(labels).toContain("that節 が続く");
  });

  it("borrow は from を伴う形を持つ", () => {
    const labels = describePatterns(usageOf("borrow")!.patterns).map(p => p.label);
    expect(labels).toContain("もの＋from＋人 の順に置く");
  });

  it("station には gas station のような複合語が付く", () => {
    const phrases = (usageOf("station")!.collocations || []).map(c => c.phrase);
    expect(phrases).toContain("gas station");
    expect(phrases).toContain("fire station");
  });

  it("decide には decision と decisive が語族として付く", () => {
    const words = (usageOf("decide")!.family || []).map(f => f.word);
    expect(words).toContain("decision");
    expect(words).toContain("decisive");
  });
});

describe("describePatterns", () => {
  it("番号を型に直す", () => {
    const out = describePatterns([8, 26]);
    expect(out.map(p => p.pattern)).toEqual([
      "Somebody ----s something",
      "Somebody ----s that CLAUSE"
    ]);
  });

  it("知らない番号は捨てる（WordNet の版が変わっても落ちない）", () => {
    expect(describePatterns([8, 999])).toHaveLength(1);
  });

  it("何も無ければ空を返す", () => {
    expect(describePatterns(undefined)).toEqual([]);
  });

  it("すべての型に日本語ラベルと英語の型がある", () => {
    for (const [n, p] of Object.entries(VERB_PATTERNS)) {
      expect(p.label, n).toBeTruthy();
      expect(p.pattern, n).toContain("----");
    }
  });

  it("番号は WordNet の 1〜35 に収まる", () => {
    const ns = Object.keys(VERB_PATTERNS).map(Number);
    expect(Math.min(...ns)).toBe(1);
    expect(Math.max(...ns)).toBe(35);
    expect(ns).toHaveLength(35);
  });
});

describe("transitivity", () => {
  it("目的語をとる型だけなら他動詞と言い切る", () => {
    expect(transitivity([8, 9])).toBe("他動詞（目的語が要る）");
  });

  it("目的語をとらない型だけなら自動詞と言い切る", () => {
    expect(transitivity([1, 2])).toBe("自動詞（目的語をとらない）");
  });

  it("両方あればどちらでも使えると伝える", () => {
    expect(transitivity([2, 8])).toBe("自動詞・他動詞のどちらでも使う");
  });

  it("二重目的語も他動詞として数える", () => {
    expect(transitivity([14])).toBe("他動詞（目的語が要る）");
  });

  it("前置詞句だけでは断定しない", () => {
    // 「前置詞句が続く」だけでは自動詞とも他動詞とも決められない
    expect(transitivity([22])).toBeNull();
  });

  it("何も無ければ何も言わない", () => {
    expect(transitivity(undefined)).toBeNull();
    expect(transitivity([])).toBeNull();
  });
});

describe("shortGloss", () => {
  it("最初の語義だけを取り出す", () => {
    expect(shortGloss("美しい,きれいな / みごとな")).toBe("美しい");
  });

  it("辞書の記号と英語の言い換えを落とす", () => {
    expect(shortGloss("《話》『決定』(decision)")).toBe("決定");
  });

  it("長すぎる語義は切り詰める", () => {
    const out = shortGloss("あ".repeat(30));
    expect(out.length).toBeLessThanOrEqual(15);
    expect(out.endsWith("…")).toBe(true);
  });

  it("日本語を含まない語義は使わない", () => {
    expect(shortGloss("=bicycle")).toBe("");
  });

  it("英語まじりの語義から空白を消さない", () => {
    // 以前は空白をすべて落としていたため「gas station」が「gasstation」になった
    expect(shortGloss("野球の world series", 20)).toBe("野球の world series");
  });

  it("別の見出しを指しているだけの項目は訳にしない", () => {
    expect(shortGloss("=sheepdog")).toBe("");
    expect(shortGloss("sheep dog = sheepdog")).toBe("");
  });

  it("目的語の指定は … に置き換える", () => {
    expect(shortGloss("〈人〉を罰する")).toBe("…を罰する");
  });

  it("切り詰めて日本語が残らない語義は使わない", () => {
    // 「Strategic Arms Limitation Talks 戦略兵器制限交渉」は前半だけ残ると英語になる
    expect(shortGloss("Strategic Arms Limitation Talks 戦略兵器制限交渉", 14)).toBe("");
  });
});

describe("isUsefulRelative", () => {
  it("語族として役に立つ語を通す", () => {
    expect(isUsefulRelative("decide", "decision")).toBe(true);
    expect(isUsefulRelative("friend", "friendship")).toBe(true);
  });

  it("単なる活用形は語族ではない", () => {
    expect(isUsefulRelative("remember", "remembering")).toBe(false);
    expect(isUsefulRelative("walk", "walked")).toBe(false);
    expect(isUsefulRelative("make", "making")).toBe(false);
  });

  it("自分自身は返さない", () => {
    expect(isUsefulRelative("decide", "decide")).toBe(false);
  });

  it("語頭が離れすぎている語は落とす", () => {
    expect(isUsefulRelative("go", "went")).toBe(false);
  });

  it("複合語は語族に入れない", () => {
    expect(isUsefulRelative("gas", "gas station")).toBe(false);
  });
});
