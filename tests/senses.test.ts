import { describe, it, expect } from "vitest";
import { wordSenses } from "../src/data/senses";
import { findDominantSense, POS_SHARE_LABELS } from "../src/senses";
import { initialVocabulary } from "../src/data/vocabulary";
import { parseSenses, rankSenses, containsWord, baseFormCandidates, referencedWords } from "../scripts/bake_senses";
import { PartOfSpeech } from "../src/types";

/**
 * 多義語の語義データ。
 *
 * これまで1語につき意味は1つだけで、収録している長文には
 * 教材に無い語義で使われている語が8語あった（watch / order / well / fine /
 * matter / left / right / kind）。
 */

const V = initialVocabulary;
const byId = new Map(V.map(w => [w.id, w]));
const POS: PartOfSpeech[] = ["verb", "noun", "adjective", "adverb", "other"];

describe("語義データの形", () => {
  it("十分な数の語に語義が付いている", () => {
    expect(Object.keys(wordSenses).length).toBeGreaterThan(6000);
  });

  it("語義が2つ以上ある語が多数ある", () => {
    const multi = Object.values(wordSenses).filter(s => s.length >= 2);
    expect(multi.length).toBeGreaterThan(4000);
  });

  it("すべての鍵が収録語のIDである", () => {
    const unknown = Object.keys(wordSenses).filter(id => !byId.has(id));
    expect(unknown).toEqual([]);
  });

  it("語義が空でなく、長すぎない", () => {
    const bad: string[] = [];
    for (const [id, list] of Object.entries(wordSenses)) {
      for (const s of list) {
        if (!s.meaning || !s.meaning.trim()) bad.push(`${id}: 空`);
        else if (s.meaning.length > 30) bad.push(`${id}: ${s.meaning.length}文字`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("語義が日本語で書かれている", () => {
    const bad = Object.entries(wordSenses)
      .filter(([, list]) => list.some(s => !/[ぁ-んァ-ヶ一-鿿]/.test(s.meaning)))
      .map(([id]) => id);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("品詞が定義済みの値", () => {
    const bad = Object.entries(wordSenses)
      .filter(([, list]) => list.some(s => !POS.includes(s.pos)))
      .map(([id]) => id);
    expect(bad).toEqual([]);
  });

  it("使用割合が0〜100の整数", () => {
    const bad: string[] = [];
    for (const [id, list] of Object.entries(wordSenses)) {
      for (const s of list) {
        if (s.share === undefined) continue;
        if (!Number.isInteger(s.share) || s.share < 0 || s.share > 100) bad.push(`${id}:${s.share}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("同じ語の中で語義が重複していない", () => {
    const bad = Object.entries(wordSenses)
      .filter(([, list]) => new Set(list.map(s => s.meaning)).size !== list.length)
      .map(([id]) => id);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("同じ品詞には同じ使用割合が入る（割合は品詞単位の値のため）", () => {
    const bad: string[] = [];
    for (const [id, list] of Object.entries(wordSenses)) {
      const byPos = new Map<string, Set<number | undefined>>();
      for (const s of list) {
        const set = byPos.get(s.pos) || new Set();
        set.add(s.share);
        byPos.set(s.pos, set);
      }
      for (const [pos, set] of byPos) if (set.size > 1) bad.push(`${id}:${pos}`);
    }
    expect(bad).toEqual([]);
  });

  it("活用の相互参照が語義として残っていない", () => {
    // 「leaveの過去・過去分詞」は意味ではないので除いてある
    const bad = Object.entries(wordSenses)
      .filter(([, list]) => list.some(s => /の(過去|複数形|比較級|最上級|現在分詞)/.test(s.meaning)))
      .map(([id]) => id);
    expect(bad.slice(0, 10)).toEqual([]);
  });
});

describe("多義語で品詞が偏らない", () => {
  it("複数の品詞を持つ語では、上位の品詞だけで埋め尽くさない", () => {
    // 使用割合の高い順に並べて上から切ると、watch の語義が動詞ばかりになり
    // 教材が教えている「腕時計」（名詞）が1つも残らなくなる
    const check = ["watch", "light", "well", "spring", "order"];
    for (const word of check) {
      const w = V.find(x => x.word.toLowerCase() === word)!;
      const list = wordSenses[w.id];
      expect(list, `${word} に語義が無い`).toBeTruthy();
      expect(new Set(list.map(s => s.pos)).size, `${word} の品詞が1種類だけ`).toBeGreaterThan(1);
    }
  });

  it("教材が教えている品詞の語義が必ず含まれる", () => {
    const check = ["watch", "kind", "well", "light", "fine"];
    for (const word of check) {
      const w = V.find(x => x.word.toLowerCase() === word)!;
      expect(wordSenses[w.id].some(s => s.pos === w.pos), `${word}`).toBe(true);
    }
  });

  it("長文に別語義で出てくる語に、その語義が用意されている", () => {
    // watch は本文で動詞、kind は名詞として使われている
    const expectations: [word: string, pos: PartOfSpeech][] = [
      ["watch", "verb"], ["kind", "noun"], ["order", "verb"], ["matter", "verb"]
    ];
    for (const [word, pos] of expectations) {
      const w = V.find(x => x.word.toLowerCase() === word)!;
      expect(wordSenses[w.id].some(s => s.pos === pos), `${word} の${pos}`).toBe(true);
    }
  });

  it("教材が教えている意味が先頭に来る", () => {
    // 辞書の掲載順は頻度順ではない（bank は 土手 → 銀行 の順）ため、
    // 学習者が覚えている意味を先頭へ引き上げている
    const bank = V.find(x => x.word.toLowerCase() === "bank")!;
    expect(wordSenses[bank.id][0].meaning).toContain("銀行");
    const spring = V.find(x => x.word.toLowerCase() === "spring")!;
    expect(wordSenses[spring.id][0].meaning).toContain("春");
  });
});

describe("findDominantSense", () => {
  const senses = [
    { meaning: "時計", pos: "noun" as PartOfSpeech, share: 9 },
    { meaning: "じっと見る", pos: "verb" as PartOfSpeech, share: 91 }
  ];

  it("覚えている品詞より明らかによく使う品詞があれば返す", () => {
    const hint = findDominantSense(senses, "noun");
    expect(hint?.pos).toBe("verb");
    expect(hint?.share).toBe(91);
  });

  it("覚えている品詞が最頻なら何も返さない", () => {
    expect(findDominantSense(senses, "verb")).toBeNull();
  });

  it("差が小さいときは口を出さない", () => {
    // order は名詞52%・動詞48%で、どちらも普通に使う
    const close = [
      { meaning: "命令", pos: "noun" as PartOfSpeech, share: 52 },
      { meaning: "注文する", pos: "verb" as PartOfSpeech, share: 48 }
    ];
    expect(findDominantSense(close, "noun")).toBeNull();
  });

  it("使用割合のデータが無ければ何も返さない", () => {
    expect(findDominantSense([{ meaning: "何か", pos: "noun" }], "verb")).toBeNull();
  });

  it("語義が無くても落ちない", () => {
    expect(findDominantSense(undefined, "noun")).toBeNull();
    expect(findDominantSense([], "noun")).toBeNull();
  });

  it("実データでも、教材の品詞が少数派の語では補足が出る", () => {
    const watch = V.find(x => x.word.toLowerCase() === "watch")!;
    const hint = findDominantSense(wordSenses[watch.id], watch.pos);
    expect(hint?.pos).toBe("verb");
  });
});

describe("parseSenses", () => {
  it("スラッシュ区切りで語義に分ける", () => {
    expect(parseSenses("『銀行』 / 土手,堤").map(s => s.meaning)).toEqual(["銀行", "土手,堤"]);
  });

  it("辞書が重要とする語義に印を付ける", () => {
    const r = parseSenses("『銀行』 / 土手");
    expect(r[0].important).toBe(true);
    expect(r[1].important).toBe(false);
  });

  it("用法注記と可算・不可算の印を落とす", () => {
    expect(parseSenses("〈U〉『光』《+『on』+『名』》").map(s => s.meaning)).toEqual(["光"]);
  });

  it("英語の言い換えを落とす", () => {
    expect(parseSenses("輝き(brightness)").map(s => s.meaning)).toEqual(["輝き"]);
  });

  it("活用の相互参照を除く", () => {
    expect(parseSenses("leaveの過去・過去分詞 / 左")).toHaveLength(1);
  });

  it("空の語義を作らない", () => {
    expect(parseSenses(" / 〈C〉 / 春").map(s => s.meaning)).toEqual(["春"]);
  });
});

describe("rankSenses", () => {
  const raw = [
    { meaning: "土手,堤", important: true, order: 0 },
    { meaning: "川岸", important: false, order: 1 },
    { meaning: "銀行", important: true, order: 2 },
    { meaning: "〈金〉を銀行に預金する", important: false, order: 3 }
  ];

  it("よく使う品詞を先に並べる", () => {
    const out = rankSenses("bank", raw, { noun: 94, verb: 6 }, "noun", "銀行");
    expect(out[0].meaning).toContain("銀行");
    expect(out[0].pos).toBe("noun");
  });

  it("教材が教えている意味を各品詞の先頭に置く", () => {
    // 辞書の掲載順では 土手 が先だが、教材は 銀行 を教えている
    const out = rankSenses("bank", raw, { noun: 94, verb: 6 }, "noun", "銀行");
    const nouns = out.filter(s => s.pos === "noun").map(s => s.meaning);
    expect(nouns[0]).toContain("銀行");
  });

  it("品詞を巡回して取り出す（上位の品詞だけで埋めない）", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ meaning: `名詞${i}`, important: false, order: i }));
    many.push({ meaning: "…を見張る", important: true, order: 99 });
    const out = rankSenses("watch", many, { noun: 9, verb: 91 }, "noun", "腕時計");
    expect(new Set(out.map(s => s.pos)).size).toBeGreaterThan(1);
  });

  it("上限を超えて返さない", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ meaning: `意味${i}`, important: false, order: i }));
    expect(rankSenses("x", many, undefined).length).toBeLessThanOrEqual(4);
  });

  it("同じ語義を重複して返さない", () => {
    const dup = [
      { meaning: "春", important: true, order: 0 },
      { meaning: "春", important: false, order: 1 }
    ];
    expect(rankSenses("spring", dup, undefined)).toHaveLength(1);
  });

  it("長すぎる語義は切り詰める", () => {
    const long = [{ meaning: "あ".repeat(60), important: true, order: 0 }];
    const out = rankSenses("x", long, undefined);
    expect(out[0].meaning.length).toBeLessThanOrEqual(30);
    expect(out[0].meaning.endsWith("…")).toBe(true);
  });

  it("頻度データが無くても語義を返す", () => {
    const out = rankSenses("zzz", raw, undefined);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every(s => s.share === undefined)).toBe(true);
  });
});

describe("品詞ラベル", () => {
  it("すべての品詞に日本語ラベルがある", () => {
    for (const p of POS) expect(POS_SHARE_LABELS[p]).toBeTruthy();
  });
});

describe("基本形から借りた語義", () => {
  it("辞書に見出しが無い派生語にも意味が付く", () => {
    // politely / sustainable / scared のような語は辞書に見出しが無い
    for (const word of ["politely", "sustainable", "scared", "politeness", "environmentally"]) {
      const w = V.find(x => x.word.toLowerCase() === word);
      if (!w) continue;
      expect(wordSenses[w.id], `${word} に語義が無い`).toBeTruthy();
    }
  });

  it("借りた語義には由来の語が入る", () => {
    const w = V.find(x => x.word.toLowerCase() === "politely")!;
    expect(wordSenses[w.id][0].from).toBe("polite");
  });

  it("借りた語義には使用割合を付けない（その語自身の割合ではないため）", () => {
    const borrowed = Object.values(wordSenses).filter(list => list[0].from);
    expect(borrowed.length).toBeGreaterThan(100);
    const withShare = borrowed.filter(list => list.some(s => s.share !== undefined));
    expect(withShare).toEqual([]);
  });

  it("借りた語義の品詞は基本形から判定する", () => {
    // politely の綴りで判定すると語義がすべて副詞になり、
    // 「副詞 礼儀正しい」のように中身と食い違う
    const w = V.find(x => x.word.toLowerCase() === "politely")!;
    expect(wordSenses[w.id].every(s => s.pos === "adjective")).toBe(true);
  });

  it("参照だけの見出しは参照先の意味を借りる", () => {
    // bike は辞書では「=bicycle」としか書かれていない
    const w = V.find(x => x.word.toLowerCase() === "bike")!;
    expect(wordSenses[w.id][0].from).toBe("bicycle");
    expect(wordSenses[w.id].some(s => s.meaning.includes("自転車"))).toBe(true);
  });

  it("由来の語は元の語と違う", () => {
    const same = Object.entries(wordSenses)
      .filter(([id, list]) => list[0].from && list[0].from === byId.get(id)?.word.toLowerCase())
      .map(([id]) => id);
    expect(same).toEqual([]);
  });
});

describe("使い方の例（用例）", () => {
  it("十分な数の語義に用例が付いている", () => {
    const withUsage = Object.values(wordSenses).flat().filter(s => s.usage);
    expect(withUsage.length).toBeGreaterThan(1000);
  });

  it("用例はその語（またはその活用形）を含む", () => {
    const bad: string[] = [];
    for (const [id, list] of Object.entries(wordSenses)) {
      const word = byId.get(id)!.word.toLowerCase();
      for (const s of list) {
        if (!s.usage) continue;
        if (!containsWord(s.usage, word)) bad.push(`${word}: ${s.usage}`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("教材が教えている品詞の語義には用例を付けない（単語データ側の例文があるため）", () => {
    const bad: string[] = [];
    for (const [id, list] of Object.entries(wordSenses)) {
      const w = byId.get(id)!;
      for (const s of list) if (s.usage && s.pos === w.pos) bad.push(w.word);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("同じ品詞に用例を重複して付けない", () => {
    const bad: string[] = [];
    for (const [id, list] of Object.entries(wordSenses)) {
      const seen = new Set<string>();
      for (const s of list) {
        if (!s.usage) continue;
        if (seen.has(s.pos)) bad.push(byId.get(id)!.word);
        seen.add(s.pos);
      }
    }
    expect(bad).toEqual([]);
  });

  it("借りた語義には用例を付けない（その語自身の使い方ではないため）", () => {
    const bad = Object.entries(wordSenses)
      .filter(([, list]) => list[0].from && list.some(s => s.usage))
      .map(([id]) => id);
    expect(bad).toEqual([]);
  });

  it("代表的な多義語に、教材が教えていない品詞の用例が付く", () => {
    const watch = V.find(x => x.word.toLowerCase() === "watch")!;
    const verbSense = wordSenses[watch.id].find(s => s.pos === "verb");
    expect(verbSense?.usage).toBeTruthy();
    expect(verbSense!.usage!.toLowerCase()).toContain("watch");
  });
});

describe("containsWord", () => {
  it("原形をそのまま含む場合", () => {
    expect(containsWord("watch a basketball game", "watch")).toBe(true);
  });
  it("複数形・三人称・過去形・ing形も認める", () => {
    expect(containsWord("what kinds of desserts are there?", "kind")).toBe(true);
    expect(containsWord("She ordered him to do the shopping", "order")).toBe(true);
    expect(containsWord("Tears well in her eyes", "well")).toBe(true);
  });
  it("別の語に前方一致しただけのものは認めない", () => {
    // light が lightens に当たると、別の単語の用例を載せてしまう
    expect(containsWord("This lamp lightens the room", "light")).toBe(false);
    expect(containsWord("sculpture is a form of art", "kind")).toBe(false);
  });
  it("語を含まない文は false", () => {
    expect(containsWord("I said to him to go home", "order")).toBe(false);
  });
});
