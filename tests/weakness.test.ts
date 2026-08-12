import { describe, it, expect } from "vitest";
import { heuristicPosStats, buildFallbackWeaknessAnalysis, POS_JP_LABELS } from "../server/weakness";

/**
 * 苦手分析のフォールバック。
 *
 * AIが使えないときに手元の集計で返す部分。
 * 「AIの分析結果」を騙らないよう isFallback を立てて返すこと、
 * 品詞の内訳が実際の語から作られていることを固定する。
 *
 * 語尾からの推測は当たらないこともあるが、
 * クライアントが品詞を送ってきているならそちらが正しい。
 * 推測が優先されると、正しい情報があるのに間違えることになる。
 */

describe("品詞の内訳", () => {
  it("送られてきた品詞を優先する", () => {
    // "family" は語尾からは副詞に見えるが、名詞だと分かっている
    const stats = heuristicPosStats([{ word: "family", pos: "noun" }]);
    expect(stats).toEqual([{ label: "名詞", count: 1, percentage: 100 }]);
  });

  it("品詞が無ければ語尾から推測する", () => {
    const stats = heuristicPosStats([
      { word: "quickly" },      // 副詞
      { word: "information" },  // 名詞
      { word: "beautiful" },    // 形容詞
      { word: "organize" }      // 動詞
    ]);
    const byLabel = Object.fromEntries(stats.map(s => [s.label, s.count]));
    expect(byLabel).toEqual({ "副詞": 1, "名詞": 1, "形容詞": 1, "動詞": 1 });
  });

  it("知らない品詞名は推測に回す", () => {
    // クライアントが勝手な値を送ってきても、そのまま見出しにしない
    const stats = heuristicPosStats([{ word: "quickly", pos: "verb-ish" }]);
    expect(stats[0].label).toBe("副詞");
  });

  it("多い順に並べる", () => {
    const stats = heuristicPosStats([
      { word: "a", pos: "noun" }, { word: "b", pos: "noun" }, { word: "c", pos: "verb" }
    ]);
    expect(stats.map(s => s.label)).toEqual(["名詞", "動詞"]);
  });

  it("0件の品詞は出さない", () => {
    const stats = heuristicPosStats([{ word: "a", pos: "noun" }]);
    expect(stats.every(s => s.count > 0)).toBe(true);
  });

  it("割合の合計が100前後になる", () => {
    const words = ["quickly", "information", "beautiful", "organize", "table"].map(word => ({ word }));
    const total = heuristicPosStats(words).reduce((n, s) => n + s.percentage, 0);
    expect(Math.abs(total - 100)).toBeLessThanOrEqual(2); // 四捨五入のぶれ
  });

  it("空の入力でも落ちない", () => {
    expect(heuristicPosStats([])).toEqual([]);
  });

  it("語が文字列でなくても落ちない", () => {
    expect(() => heuristicPosStats([{ word: undefined as unknown as string }])).not.toThrow();
  });

  it("扱う品詞名がラベルと対応している", () => {
    expect(Object.keys(POS_JP_LABELS).sort())
      .toEqual(["adjective", "adverb", "noun", "other", "verb"]);
  });
});

describe("フォールバックの分析結果", () => {
  const words = [{ word: "quickly" }, { word: "slowly" }, { word: "information" }];

  it("AIの結果と区別できる印を付ける", () => {
    // これを落とすと、集計で作った内容が「AIの分析」として表示される
    expect(buildFallbackWeaknessAnalysis(words).isFallback).toBe(true);
  });

  it("いちばん多い品詞を要約に書く", () => {
    const out = buildFallbackWeaknessAnalysis(words);
    expect(out.summary).toContain("副詞");
    expect(out.summary).toContain("%");
  });

  it("分析できる語が無ければ、そう書く", () => {
    const out = buildFallbackWeaknessAnalysis([]);
    expect(out.summary).toContain("十分にありません");
    expect(out.partOfSpeechStats).toEqual([]);
  });

  it("次にやることを添える", () => {
    expect(buildFallbackWeaknessAnalysis(words).recommendations.length).toBeGreaterThan(0);
  });

  it("語数を数える", () => {
    expect(buildFallbackWeaknessAnalysis(words).topicStats[0].count).toBe(3);
  });
});
