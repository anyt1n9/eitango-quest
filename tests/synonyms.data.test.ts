import { describe, it, expect } from "vitest";
import { initialVocabulary } from "../src/data/vocabulary";
import { wordSynonyms } from "../src/data/synonyms";
import { EXCLUDED_PAIRS, translationTokens, translationsOverlap } from "../scripts/bake_synonyms";

/**
 * 類義語クイズのデータ（src/data/synonyms.ts）の検査。
 *
 * 「同じ意味の語を選ぶ」設問は、正解以外にも同じ意味と言える選択肢が混ざると
 * 正解が2つになる。逆に、辞書の上では同義でも教材の訳が別の意味なら、
 * 学習者には無関係な語を「同じ意味」と教えることになる。
 * どちらも型検査やビルドでは見つからないので、全件をここで確かめる。
 *
 * 辞書(WordNet)での裏付けは生成時（scripts/bake_synonyms.ts）に行っている。
 * ここでは CI でも見られる「教材の訳」と「形」の面を固定する。
 */

const byId = new Map(initialVocabulary.map(w => [w.id, w]));
const entries = Object.entries(wordSynonyms);

function list<T>(items: T[], show: (x: T) => string): string[] {
  return items.map(show);
}

describe("類義語クイズのデータ", () => {
  it("十分な数がある（各レベルで50語以上）", () => {
    const perLevel: Record<string, number> = {};
    for (const [id] of entries) {
      const level = byId.get(id)!.level;
      perLevel[level] = (perLevel[level] || 0) + 1;
    }
    for (const level of ["junior", "senior", "senior2", "senior3", "advanced"]) {
      expect(perLevel[level] ?? 0, level).toBeGreaterThanOrEqual(50);
    }
  });

  it("出題語・正解・誤答はすべて収録語で、重複が無い", () => {
    const bad: string[] = [];
    for (const [id, e] of entries) {
      for (const x of [id, ...e.same, ...e.distractors]) {
        if (!byId.has(x)) bad.push(`${id}: ${x} が収録語に無い`);
      }
      const all = [id, ...e.same, ...e.distractors];
      if (new Set(all).size !== all.length) bad.push(`${id}: IDが重複している`);
      if (e.same.length === 0) bad.push(`${id}: 正解が無い`);
      if (e.distractors.length !== 3) bad.push(`${id}: 誤答が${e.distractors.length}件`);
    }
    expect(bad).toEqual([]);
  });

  it("同じ品詞どうしで組んでいる（品詞で消去法が効かない）", () => {
    const bad = entries.filter(([id, e]) => {
      const pos = byId.get(id)!.pos;
      return [...e.same, ...e.distractors].some(x => byId.get(x)!.pos !== pos);
    });
    expect(list(bad, ([id]) => byId.get(id)!.word)).toEqual([]);
  });

  it("同義の組は双方向にそろっている", () => {
    const bad: string[] = [];
    for (const [id, e] of entries) {
      for (const s of e.same) {
        if (!wordSynonyms[s]?.same.includes(id)) bad.push(`${byId.get(id)!.word} → ${byId.get(s)!.word}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("同義の組は、教材の訳が第一の訳で重なっている", () => {
    const bad: string[] = [];
    for (const [id, e] of entries) {
      const w = byId.get(id)!;
      for (const s of e.same) {
        const v = byId.get(s)!;
        const tw = translationTokens(w.translation);
        const tv = translationTokens(v.translation);
        const shared = tw.filter(t => tv.includes(t));
        if (!shared.some(t => t === tw[0] || t === tv[0])) {
          bad.push(`${w.word}「${w.translation}」 = ${v.word}「${v.translation}」`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("綴りが含まれ合う組は無い（意味ではなく綴りで当たってしまう）", () => {
    const bad: string[] = [];
    for (const [id, e] of entries) {
      const w = byId.get(id)!.word;
      for (const s of [...e.same, ...e.distractors]) {
        const v = byId.get(s)!.word;
        if (w.includes(v) || v.includes(w)) bad.push(`${w} / ${v}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("誤答は、出題語とも正解とも訳が重ならない（正解が2つにならない）", () => {
    const bad: string[] = [];
    for (const [id, e] of entries) {
      const group = [id, ...e.same].map(x => byId.get(x)!);
      for (const d of e.distractors) {
        const dv = byId.get(d)!;
        const clash = group.find(g => translationsOverlap(g.translation, dv.translation));
        if (clash) bad.push(`${byId.get(id)!.word}: 誤答 ${dv.word}「${dv.translation}」が ${clash.word}「${clash.translation}」と重なる`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("誤答どうしも訳が重ならない（似た誤答が並ぶと、それ以外が正解だと分かってしまう）", () => {
    const bad: string[] = [];
    for (const [id, e] of entries) {
      const ds = e.distractors.map(x => byId.get(x)!);
      for (let i = 0; i < ds.length; i++) {
        for (let j = i + 1; j < ds.length; j++) {
          if (translationsOverlap(ds[i].translation, ds[j].translation)) {
            bad.push(`${byId.get(id)!.word}: ${ds[i].word} / ${ds[j].word}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("外した組は生成結果に入っておらず、外した理由が書いてある", () => {
    const pairs = new Set<string>();
    for (const [id, e] of entries) {
      for (const s of e.same) pairs.add([byId.get(id)!.word, byId.get(s)!.word].sort().join("|"));
    }
    for (const [pair, reason] of Object.entries(EXCLUDED_PAIRS)) {
      expect(pairs.has(pair), pair).toBe(false);
      expect(reason.length, pair).toBeGreaterThan(10);
      // キーはアルファベット順にしておく（同じ組を2通りに書いて片方だけ効く、を防ぐ）
      expect(pair.split("|").slice().sort().join("|"), pair).toBe(pair);
    }
  });

  it("よく知られた組が入っていて、使い分けを問われる組は入っていない", () => {
    const has = (a: string, b: string) => entries.some(([id, e]) =>
      byId.get(id)!.word === a && e.same.some(s => byId.get(s)!.word === b));
    expect(has("big", "large")).toBe(true);
    expect(has("begin", "start") || has("start", "begin")).toBe(true);
    expect(has("happen", "occur")).toBe(true);
    // 訳は同じ「まだ」でも、肯定文と否定文で使い分ける
    expect(has("yet", "still")).toBe(false);
    // 辞書では同義でも、教材の minister は「大臣」
    expect(has("minister", "pastor")).toBe(false);
  });
});
