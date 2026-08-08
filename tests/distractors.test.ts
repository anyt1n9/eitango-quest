import { describe, it, expect } from "vitest";
import { pickDistractors, Candidate } from "../src/distractors";
import { seededRandom, senses } from "./helpers";

const c = (word: string, translation: string, pos: Candidate["pos"], level = "junior"): Candidate =>
  ({ word, translation, pos, level });

const POOL: Candidate[] = [
  c("apple", "りんご", "noun"),
  c("orange", "オレンジ", "noun"),
  c("tomato", "トマト", "noun"),
  c("library", "図書館", "noun"),
  c("museum", "博物館", "noun"),
  c("hotel", "ホテル", "noun"),
  c("station", "駅", "noun"),
  c("teacher", "先生、教師", "noun"),
  c("doctor", "医者", "noun"),
  c("nurse", "看護師", "noun"),
  c("beautiful", "美しい、きれいな", "adjective"),
  c("wonderful", "素晴らしい", "adjective"),
  c("delicious", "おいしい", "adjective"),
  c("expensive", "高価な", "adjective"),
  c("small", "小さい、少しの", "adjective"),
  c("wild", "野生の、荒々しい", "adjective"),
  c("run", "走る", "verb"),
  c("swim", "泳ぐ", "verb"),
  c("decide", "決める、決定する", "verb"),
  c("improve", "改善する", "verb"),
  c("quickly", "すばやく、速く", "adverb"),
  c("slowly", "ゆっくりと", "adverb"),
  c("carefully", "注意深く", "adverb"),
  c("quietly", "静かに", "adverb"),
];

describe("pickDistractors", () => {
  const target = c("cheap", "安い、安価な", "adjective");

  it("要求された数だけ返す", () => {
    expect(pickDistractors(target, POOL, 3, "translation", seededRandom(1))).toHaveLength(3);
  });

  it("正解そのものを誤答に含めない", () => {
    for (let s = 0; s < 30; s++) {
      const out = pickDistractors(target, POOL, 3, "translation", seededRandom(s));
      expect(out).not.toContain(target.translation);
    }
  });

  it("誤答同士が重複しない", () => {
    for (let s = 0; s < 30; s++) {
      const out = pickDistractors(target, POOL, 3, "translation", seededRandom(s));
      expect(new Set(out).size).toBe(out.length);
    }
  });

  it("誤答を正解と同じ品詞から選ぶ（品詞での消去法を封じる）", () => {
    // 以前は同レベルからの無作為抽出で、同じ品詞である割合は50%（ランダム相当）だった。
    // beautiful(美しい) の誤答が 事務所 / 17、十七 / 劇、ドラマ では、
    // 意味を知らなくても消去法で当たってしまう。
    const byTranslation = new Map(POOL.map(p => [p.translation, p]));
    for (let s = 0; s < 50; s++) {
      for (const t of [c("cheap", "安い、安価な", "adjective"),
                       c("walk", "歩く", "verb"),
                       c("kitchen", "台所", "noun"),
                       c("loudly", "大声で", "adverb")]) {
        for (const d of pickDistractors(t, POOL, 3, "translation", seededRandom(s))) {
          expect(byTranslation.get(d)!.pos).toBe(t.pos);
        }
      }
    }
  });

  it("英単語モードでも正解と同じ品詞から選ぶ", () => {
    const byWord = new Map(POOL.map(p => [p.word, p]));
    const t = c("cheap", "安い、安価な", "adjective");
    for (let s = 0; s < 30; s++) {
      for (const d of pickDistractors(t, POOL, 3, "word", seededRandom(s))) {
        expect(byWord.get(d)!.pos).toBe("adjective");
        expect(d).not.toBe(t.word);
      }
    }
  });

  it("正解と語義が重なる語を誤答にしない（正解が2つある問題を作らない）", () => {
    // 紛らわしさを上げる過程で入り込んだ回帰。実データで191問が
    // 「正解と誤答のどちらも正解」の状態になっていた。
    // 例: class の正解「授業」に対して誤答「授業、レッスン、教訓」。
    const cls = c("class", "授業", "noun");
    const pool = [
      c("lesson", "授業、レッスン、教訓", "noun"),
      c("course", "課程、コース", "noun"),
      c("grade", "学年、成績", "noun"),
      c("subject", "科目、主題", "noun"),
      c("period", "時限、期間", "noun"),
      ...POOL
    ];
    for (let s = 0; s < 50; s++) {
      const out = pickDistractors(cls, pool, 3, "translation", seededRandom(s));
      expect(out).not.toContain("授業、レッスン、教訓");
      for (const d of out) {
        expect(senses(d).some(x => senses(cls.translation).includes(x))) .toBe(false);
      }
    }
  });

  it("動詞の「を〜する」型でも語義の重なりを弾く", () => {
    const permit = c("permit", "を許可する", "verb");
    const pool = [
      c("allow", "を許可する、許す", "verb"),
      c("forbid", "を禁じる", "verb"),
      c("require", "を必要とする", "verb"),
      c("ignore", "を無視する", "verb"),
      c("reject", "を拒否する", "verb"),
      ...POOL
    ];
    for (let s = 0; s < 30; s++) {
      expect(pickDistractors(permit, pool, 3, "translation", seededRandom(s)))
        .not.toContain("を許可する、許す");
    }
  });

  it("同じレベルの候補が十分あればレベルを揃える", () => {
    const pool = [
      ...POOL,
      ...Array.from({ length: 20 }, (_, i) => c(`jun${i}`, `初級${i}な`, "adjective", "junior")),
      ...Array.from({ length: 30 }, (_, i) => c(`adv${i}`, `上級${i}な`, "adjective", "advanced"))
    ];
    const t = c("cheap", "安い、安価な", "adjective", "junior");
    const juniorTranslations = new Set(
      pool.filter(p => p.level === "junior" && p.pos === "adjective").map(p => p.translation)
    );
    for (let s = 0; s < 20; s++) {
      for (const d of pickDistractors(t, pool, 3, "translation", seededRandom(s))) {
        expect(juniorTranslations.has(d)).toBe(true);
      }
    }
  });

  it("同じ品詞の候補が足りなければ品詞を崩してでも数を揃える", () => {
    const t = c("hmm", "ふむ", "other");
    const out = pickDistractors(t, POOL, 3, "translation", seededRandom(3));
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
  });

  it("候補が空なら空配列（例外を投げない）", () => {
    expect(pickDistractors(c("solo", "単独の", "adjective"), [], 3, "translation")).toEqual([]);
  });

  it("空文字の訳語を誤答にしない", () => {
    const pool = [c("blank", "", "adjective"), ...POOL];
    for (let s = 0; s < 20; s++) {
      expect(pickDistractors(c("cheap", "安い", "adjective"), pool, 3, "translation", seededRandom(s)))
        .not.toContain("");
    }
  });

  it("毎回同じ組み合わせにならない（上位から散らして選ぶ）", () => {
    const seen = new Set<string>();
    for (let s = 0; s < 40; s++) {
      seen.add([...pickDistractors(target, POOL, 3, "translation", seededRandom(s))].sort().join("|"));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
