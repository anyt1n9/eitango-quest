import { describe, it, expect } from "vitest";
import { grammarTopics } from "../src/data/grammar";
import {
  findTopic, topicsByLevel, searchTopics, verbsForFrames, topicsForFrames,
  isTopicCleared, levelProgress, nextTopics, LEVEL_LABELS, LEVEL_ORDER
} from "../src/grammar";
import { VERB_PATTERNS } from "../src/usage";
import { initialVocabulary } from "../src/data/vocabulary";
import { wordUsage } from "../src/data/wordUsage";
import { Level } from "../src/types";
import { makeWord } from "./fixtures";

/**
 * 文法解説。
 *
 * 語義や語法と違い、この解説は辞書やコーパスから作ったものではなく書き下ろしである。
 * 出典で正しさを担保できないぶん、
 * 「説明・例文・よくある間違い・練習問題がすべての項目にそろっているか」
 * 「練習問題の正解が選択肢の中にあるか」といった、形の面をここで固定する。
 * 内容そのものは1項目ずつ読んで確かめるほかない。
 */

const T = grammarTopics;

describe("文法データの形", () => {
  it("十分な数の項目がある", () => {
    expect(T.length).toBeGreaterThanOrEqual(30);
  });

  it("id が重複していない", () => {
    expect(new Set(T.map(t => t.id)).size).toBe(T.length);
  });

  it("すべてのレベルに項目がある", () => {
    for (const level of LEVEL_ORDER) {
      expect(T.filter(t => t.level === level).length, level).toBeGreaterThan(0);
    }
  });

  it("題名・要約・分類が空でない", () => {
    const bad = T.filter(t => !t.title.trim() || !t.summary.trim() || !t.category.trim()).map(t => t.id);
    expect(bad).toEqual([]);
  });

  it("題名が重複していない", () => {
    expect(new Set(T.map(t => t.title)).size).toBe(T.length);
  });

  it("すべての項目に説明・例文・よくある間違い・練習問題がある", () => {
    // どれか1つでも欠けていると「参考書の代わり」にならない
    const bad: string[] = [];
    for (const t of T) {
      if (t.sections.length < 2) bad.push(`${t.id}:説明`);
      if (t.examples.length < 3) bad.push(`${t.id}:例文`);
      if (t.mistakes.length < 2) bad.push(`${t.id}:間違い`);
      if (t.questions.length < 3) bad.push(`${t.id}:練習`);
    }
    expect(bad).toEqual([]);
  });

  it("説明が日本語で書かれ、短すぎない", () => {
    const bad: string[] = [];
    for (const t of T) {
      for (const s of t.sections) {
        if (!s.heading.trim()) bad.push(`${t.id}:見出しが空`);
        if (s.body.length < 30) bad.push(`${t.id}:${s.heading} が短い`);
        if (!/[ぁ-んァ-ヶ一-鿿]/.test(s.body)) bad.push(`${t.id}:${s.heading} が日本語でない`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("例文", () => {
  it("英文と和訳がそろっている", () => {
    const bad: string[] = [];
    for (const t of T) {
      for (const e of t.examples) {
        if (!e.english.trim()) bad.push(`${t.id}:英文が空`);
        if (!e.japanese.trim()) bad.push(`${t.id}:和訳が空`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("英文が英字で書かれている", () => {
    const bad: string[] = [];
    for (const t of T) {
      for (const e of t.examples) {
        if (!/[a-zA-Z]/.test(e.english)) bad.push(`${t.id}:${e.english}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("和訳が日本語で書かれている", () => {
    const bad: string[] = [];
    for (const t of T) {
      for (const e of t.examples) {
        if (!/[ぁ-んァ-ヶ一-鿿]/.test(e.japanese)) bad.push(`${t.id}:${e.japanese}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("同じ項目の中で例文が重複していない", () => {
    const bad = T.filter(t => new Set(t.examples.map(e => e.english)).size !== t.examples.length)
      .map(t => t.id);
    expect(bad).toEqual([]);
  });
});

describe("よくある間違い", () => {
  it("誤りと正しい形が違う", () => {
    const bad: string[] = [];
    for (const t of T) {
      for (const m of t.mistakes) {
        if (m.wrong.trim() === m.right.trim()) bad.push(`${t.id}:${m.wrong}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("なぜ間違いかの説明が日本語である", () => {
    const bad: string[] = [];
    for (const t of T) {
      for (const m of t.mistakes) {
        if (m.why.length < 10 || !/[ぁ-んァ-ヶ一-鿿]/.test(m.why)) bad.push(`${t.id}:${m.wrong}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("練習問題", () => {
  it("選択肢がちょうど4つある", () => {
    const bad: string[] = [];
    for (const t of T) {
      for (const q of t.questions) {
        if (q.options.length !== 4) bad.push(`${t.id}:${q.question}(${q.options.length})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("正解の番号が選択肢の範囲に収まる", () => {
    const bad: string[] = [];
    for (const t of T) {
      for (const q of t.questions) {
        if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
          bad.push(`${t.id}:${q.question}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("選択肢が重複せず、空でない", () => {
    const bad: string[] = [];
    for (const t of T) {
      for (const q of t.questions) {
        if (new Set(q.options).size !== q.options.length) bad.push(`${t.id}:重複 ${q.question}`);
        if (q.options.some(o => !o.trim())) bad.push(`${t.id}:空 ${q.question}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("正解が1つだけになるよう、どの選択肢も別物である", () => {
    // 「同じ答えが2つある」問題は、正解を選んでも不正解になりうる
    const bad: string[] = [];
    for (const t of T) {
      for (const q of t.questions) {
        const normalized = q.options.map(o => o.replace(/\s+/g, "").toLowerCase());
        if (new Set(normalized).size !== normalized.length) bad.push(`${t.id}:${q.question}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("空所を含む問題文になっている", () => {
    const bad: string[] = [];
    for (const t of T) {
      for (const q of t.questions) {
        if (!q.question.includes("[_____]")) bad.push(`${t.id}:${q.question}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("なぜその答えかの説明が付いている", () => {
    const bad: string[] = [];
    for (const t of T) {
      for (const q of t.questions) {
        if (q.explanation.length < 10 || !/[ぁ-んァ-ヶ一-鿿]/.test(q.explanation)) {
          bad.push(`${t.id}:${q.question}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("他のデータとのつながり", () => {
  it("前提として挙げた項目が実在する", () => {
    const ids = new Set(T.map(t => t.id));
    const bad: string[] = [];
    for (const t of T) {
      for (const r of t.requires || []) if (!ids.has(r)) bad.push(`${t.id} → ${r}`);
    }
    expect(bad).toEqual([]);
  });

  it("前提の項目が自分より後のレベルにない", () => {
    // 先に読めない項目を前提にすると学習の順序が崩れる
    const byId = new Map(T.map(t => [t.id, t]));
    const bad: string[] = [];
    for (const t of T) {
      for (const r of t.requires || []) {
        const req = byId.get(r)!;
        if (LEVEL_ORDER.indexOf(req.level) > LEVEL_ORDER.indexOf(t.level)) bad.push(`${t.id} → ${r}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("文型番号が WordNet の既知の型である", () => {
    const bad: string[] = [];
    for (const t of T) {
      for (const f of t.verbFrames || []) if (!VERB_PATTERNS[f]) bad.push(`${t.id}:${f}`);
    }
    expect(bad).toEqual([]);
  });

  it("文型を持つ項目には、収録語の中に実例の動詞がある", () => {
    // 「この形をとる動詞」の欄が空のまま出ないことの確認
    const bad: string[] = [];
    for (const t of T) {
      if (!t.verbFrames) continue;
      if (verbsForFrames(t.verbFrames, wordUsage, initialVocabulary).length === 0) bad.push(t.id);
    }
    expect(bad).toEqual([]);
  });
});

describe("目次と検索", () => {
  it("すべてのレベルに日本語のラベルがある", () => {
    for (const l of LEVEL_ORDER) expect(LEVEL_LABELS[l as Level]).toBeTruthy();
  });

  it("レベルごとにまとめても項目数が変わらない", () => {
    const total = topicsByLevel(T).reduce((n, g) => n + g.topics.length, 0);
    expect(total).toBe(T.length);
  });

  it("レベルの並びが学習順になっている", () => {
    const levels = topicsByLevel(T).map(g => g.level);
    const expected = LEVEL_ORDER.filter(l => levels.includes(l));
    expect(levels).toEqual(expected);
  });

  it("題名で引ける", () => {
    expect(searchTopics(T, "現在完了").map(t => t.id)).toContain("g_present_perfect");
  });

  it("例文の英語でも引ける", () => {
    // 「have been を調べたい」といった引き方ができる
    const hits = searchTopics(T, "as if");
    expect(hits.map(t => t.id)).toContain("g_subjunctive");
  });

  it("空の検索では絞り込まない", () => {
    expect(searchTopics(T, "  ")).toHaveLength(T.length);
  });

  it("id で1件だけ取り出せる", () => {
    expect(findTopic(T, "g_passive")?.title).toBe("受動態（be + 過去分詞）");
    expect(findTopic(T, "存在しない")).toBeUndefined();
  });
});

describe("進捗", () => {
  const topic = T[0];

  it("全問正解して初めて仕上がりになる", () => {
    const partial = { [topic.id]: topic.questions.map((_, i) => i).slice(0, -1) };
    expect(isTopicCleared(topic, partial)).toBe(false);
    const full = { [topic.id]: topic.questions.map((_, i) => i) };
    expect(isTopicCleared(topic, full)).toBe(true);
  });

  it("手を付けていない項目は仕上がりでない", () => {
    expect(isTopicCleared(topic, {})).toBe(false);
  });

  it("レベルごとの達成数を数える", () => {
    const junior = T.filter(t => t.level === "junior");
    const done = { [junior[0].id]: junior[0].questions.map((_, i) => i) };
    const p = levelProgress(T, "junior", done);
    expect(p.cleared).toBe(1);
    expect(p.total).toBe(junior.length);
  });

  it("次に読む項目は、前提を満たしたものから出す", () => {
    // 何も終えていないときは学習順の先頭から
    const first = nextTopics(T, {});
    expect(first[0].level).toBe("junior");
    expect(first).toHaveLength(3);
  });

  it("仕上げた項目は次に読む候補から外れる", () => {
    const done: Record<string, number[]> = {};
    for (const t of T.filter(t => t.level === "junior")) done[t.id] = t.questions.map((_, i) => i);
    const next = nextTopics(T, done);
    expect(next.every(t => t.level !== "junior")).toBe(true);
  });
});

describe("verbsForFrames", () => {
  const words = [
    makeWord({ id: "v1", word: "tell", pos: "verb" }),
    makeWord({ id: "v2", word: "walk", pos: "verb" }),
    makeWord({ id: "n1", word: "book", pos: "noun" })
  ];
  const usage = {
    v1: { patterns: [8, 14, 26] },
    v2: { patterns: [2] },
    n1: { patterns: [14] }   // 名詞なので拾わない
  };

  it("指定した文型を持つ動詞だけを返す", () => {
    expect(verbsForFrames([14], usage, words).map(w => w.id)).toEqual(["v1"]);
  });

  it("動詞でない語は返さない", () => {
    // n1 も文型14を持っているが名詞なので除く
    expect(verbsForFrames([14], usage, words).map(w => w.id)).not.toContain("n1");
  });

  it("複数の文型のどれかに当たればよい", () => {
    expect(verbsForFrames([2, 26], usage, words).map(w => w.id).sort()).toEqual(["v1", "v2"]);
  });

  it("上限を超えて返さない", () => {
    const many = Array.from({ length: 20 }, (_, i) => makeWord({ id: `m${i}`, word: `w${i}`, pos: "verb" }));
    const table = Object.fromEntries(many.map(w => [w.id, { patterns: [8] }]));
    expect(verbsForFrames([8], table, many, 5)).toHaveLength(5);
  });

  it("文型が無ければ空を返す", () => {
    expect(verbsForFrames(undefined, usage, words)).toEqual([]);
    expect(verbsForFrames([], usage, words)).toEqual([]);
  });
});

describe("文型から文法項目を引く", () => {
  it("その文型を扱う項目を返す", () => {
    // 文法ガイドから「この形をとる動詞」へは辿れたが、
    // 辞書で文型を見ているときに解説へ戻る道が無かった
    const withFrames = grammarTopics.filter(t => t.verbFrames && t.verbFrames.length > 0);
    expect(withFrames.length).toBeGreaterThan(0);
    const frame = withFrames[0].verbFrames![0];
    const found = topicsForFrames(grammarTopics, [frame]);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every(t => t.verbFrames!.includes(frame))).toBe(true);
  });

  it("扱う項目が無い文型では空になる", () => {
    // WordNet の文型番号は1〜35。範囲外の番号を持つ項目は無い
    expect(topicsForFrames(grammarTopics, [999])).toEqual([]);
  });

  it("文型が無ければ空になる", () => {
    expect(topicsForFrames(grammarTopics, undefined)).toEqual([]);
    expect(topicsForFrames(grammarTopics, [])).toEqual([]);
  });

  it("易しい項目から順に返す", () => {
    // 同じ形を複数の項目が扱うとき、上級のものを先に見せない
    const all = grammarTopics.filter(t => t.verbFrames?.length);
    const frames = all.flatMap(t => t.verbFrames!);
    const found = topicsForFrames(grammarTopics, frames, 10);
    const order = found.map(t => LEVEL_ORDER.indexOf(t.level));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("出しすぎない", () => {
    const frames = grammarTopics.flatMap(t => t.verbFrames ?? []);
    expect(topicsForFrames(grammarTopics, frames).length).toBeLessThanOrEqual(3);
    expect(topicsForFrames(grammarTopics, frames, 1).length).toBe(1);
  });
});
