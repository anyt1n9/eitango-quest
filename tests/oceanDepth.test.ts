import { describe, it, expect } from "vitest";
import {
  DEPTH_STAGES, abundance, depthAlong, nextStageInfo, oceanGradientCss, parseDepthChoice, shownStageIndex,
  stageIndexFor, type Dweller
} from "../src/ocean/depth";

/**
 * 海の深さ（段階③。src/ocean/depth.ts）。覚えた語数で海が深くなる。
 *
 * 3Dの場面は jsdom では描けないので、ここでは「どの深さに何がいるか」を決める純粋な関数を見る。
 * 見え方そのもの（色・明るさ）は、描いた画面で確かめた（CLAUDE.md の「海の深さ」）。
 */

const DWELLERS: Dweller[] = [
  "seagrass", "staghorn", "brain", "fan", "rock", "manta", "fish", "turtle", "reeffish", "wrasse", "jelly", "glow", "snow"
];
/** 1匹で泳ぐもの（oceanScene.ts と同じく、量が半分を超える深さで出す） */
const shown = (k: Dweller, d: number) => abundance(k, d) >= 0.5;
const depthOf = (id: string) => DEPTH_STAGES.find(s => s.id === id)!.depth;

describe("深さの段", () => {
  it("深くなるほど、要る語数も増える（最初の段は0語から）", () => {
    expect(DEPTH_STAGES[0].minMastered).toBe(0);
    for (let i = 1; i < DEPTH_STAGES.length; i++) {
      expect(DEPTH_STAGES[i].depth).toBeGreaterThan(DEPTH_STAGES[i - 1].depth);
      expect(DEPTH_STAGES[i].minMastered).toBeGreaterThan(DEPTH_STAGES[i - 1].minMastered);
    }
    // 収録語（7,726語）を全部覚えなくても、いちばん深い段に届く
    expect(DEPTH_STAGES[DEPTH_STAGES.length - 1].minMastered).toBeLessThan(7726);
  });

  it("覚えた語数から、潜れるいちばん深い段を決める（境目の語数ちょうどで潜れる）", () => {
    expect(stageIndexFor(0)).toBe(0);
    for (let i = 1; i < DEPTH_STAGES.length; i++) {
      expect(stageIndexFor(DEPTH_STAGES[i].minMastered - 1)).toBe(i - 1);
      expect(stageIndexFor(DEPTH_STAGES[i].minMastered)).toBe(i);
    }
    expect(stageIndexFor(100000)).toBe(DEPTH_STAGES.length - 1);
  });

  it("背景に出す段は、潜った段より深くしない（選んだ段が深くても、潜った段まで）", () => {
    expect(shownStageIndex("auto", 3)).toBe(3);
    expect(shownStageIndex("reef", 3)).toBe(1);
    expect(shownStageIndex("deep", 1)).toBe(1);
    expect(shownStageIndex("auto", 99)).toBe(DEPTH_STAGES.length - 1);
  });

  it("保存した選択が知らない値なら「いちばん深いところ」に戻す", () => {
    expect(parseDepthChoice(null)).toBe("auto");
    expect(parseDepthChoice("abyss")).toBe("auto");
    expect(parseDepthChoice("slope")).toBe("slope");
  });

  it("次の段までの残りの語数と進み具合（いちばん深い段では無し）", () => {
    const reef = DEPTH_STAGES[1], slope = DEPTH_STAGES[2];
    const half = Math.round((reef.minMastered + slope.minMastered) / 2);
    const info = nextStageInfo(half, 1)!;
    expect(info.stage.id).toBe("slope");
    expect(info.remaining).toBe(slope.minMastered - half);
    expect(info.progress).toBeCloseTo(0.5, 1);
    // 覚えた語数が潜った段の語数より下がっていても、進み具合は0より下にしない
    expect(nextStageInfo(0, 2)!.progress).toBe(0);
    expect(nextStageInfo(99999, DEPTH_STAGES.length - 1)).toBeNull();
  });

  it("3Dを描けないときの地は、その段の色にする（段ごとに違う色）", () => {
    const seen = new Set<string>();
    for (const s of DEPTH_STAGES) {
      expect(s.gradient.every(c => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
      const css = oceanGradientCss(s.depth);
      expect(css).toContain(s.gradient[0]);
      seen.add(css);
    }
    expect(seen.size).toBe(DEPTH_STAGES.length);
  });
});

describe("深さごとに住む生き物", () => {
  it("どの深さでも量は0〜1", () => {
    for (const k of DWELLERS) {
      for (const d of [0.5, 3, 5, 8, 12, 18, 25, 35, 60, 90, 150, 250, 1000]) {
        const v = abundance(k, d);
        expect(v, `${k} @${d}m`).toBeGreaterThanOrEqual(0);
        expect(v, `${k} @${d}m`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("海草とサンゴは光の届く浅い所だけ（深い所に置くと、暗い海に明るいサンゴ礁が残る）", () => {
    expect(abundance("seagrass", 3)).toBe(1);
    expect(abundance("seagrass", 18)).toBe(0);
    expect(abundance("staghorn", 8)).toBe(1);
    expect(abundance("staghorn", 35)).toBe(0);
    expect(abundance("brain", 90)).toBe(0);
  });

  it("マンタと魚の群れは沖まで、クラゲと生き物の光は深い所から", () => {
    expect(abundance("manta", 35)).toBeGreaterThanOrEqual(0.5);
    expect(abundance("manta", 90)).toBeLessThan(0.5);
    expect(abundance("fish", 250)).toBe(0);
    expect(abundance("jelly", 8)).toBe(0);
    expect(abundance("jelly", 90)).toBe(1);
    expect(abundance("glow", 35)).toBe(0);
    expect(abundance("glow", 250)).toBe(1);
  });

  it("浅い側の段ごとの主役：浅瀬とサンゴ礁はウミガメ、サンゴ礁は熱帯魚、礁の斜面と沖はナポレオンフィッシュ", () => {
    expect(shown("turtle", depthOf("shallows"))).toBe(true);
    expect(shown("turtle", depthOf("reef"))).toBe(true);
    expect(shown("turtle", depthOf("slope"))).toBe(false);
    expect(abundance("reeffish", depthOf("reef"))).toBe(1);
    expect(abundance("reeffish", depthOf("offshore"))).toBe(0);
    // 段ごとに主役を分ける：ナポレオンフィッシュは浅いサンゴ礁には出さない
    expect(shown("wrasse", depthOf("reef"))).toBe(false);
    expect(shown("wrasse", depthOf("slope"))).toBe(true);
    expect(shown("wrasse", depthOf("offshore"))).toBe(true);
    expect(shown("wrasse", depthOf("twilight"))).toBe(false);
  });

  it("どの段にも、前の段とはっきり違うものがある（潜っても見た目が変わらない段を作らない）", () => {
    for (let i = 1; i < DEPTH_STAGES.length; i++) {
      const a = DEPTH_STAGES[i - 1].depth, b = DEPTH_STAGES[i].depth;
      const biggest = Math.max(...DWELLERS.map(k => Math.abs(abundance(k, b) - abundance(k, a))));
      expect(biggest, `${DEPTH_STAGES[i].name}`).toBeGreaterThanOrEqual(0.3);
    }
  });

  it("いちばん深い段でも、見えるもの（光るクラゲ）がいる", () => {
    const deep = DEPTH_STAGES[DEPTH_STAGES.length - 1].depth;
    expect(abundance("jelly", deep)).toBeGreaterThan(0.5);
    expect(abundance("glow", deep)).toBeGreaterThan(0.5);
  });
});

describe("潜っている途中の水深", () => {
  it("始めと終わりはその水深で、途中は単調に変わる", () => {
    expect(depthAlong(8, 90, 0)).toBeCloseTo(8);
    expect(depthAlong(8, 90, 1)).toBeCloseTo(90);
    let prev = 8;
    for (let t = 0.05; t <= 1; t += 0.05) {
      const d = depthAlong(8, 90, t);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
    // 浮かぶときも同じ
    expect(depthAlong(90, 8, 0.5)).toBeLessThan(90);
  });

  it("対数でつなぐ（中ほどは相乗平均。浅い所を一瞬で通り過ぎない）", () => {
    expect(depthAlong(3, 250, 0.5)).toBeCloseTo(Math.sqrt(3 * 250), 5);
  });
});
