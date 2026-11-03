import { describe, it, expect } from "vitest";
import { judge, looksLikeBrowserCap30, tierSpecs, type JudgeContext } from "../src/ocean/quality";

/**
 * 海の3D背景の画質の自動判定。
 *
 * 試作では iPhone 14 で「低・30fps」になった。手で「高」にすると 50〜55fps 出ており、
 * 端末が重いのではなく、ブラウザが毎秒30コマに制限していた（省電力モード、
 * 埋め込み表示で画面に触れるまで）のを「重い」と取り違えていた。
 */

const ctx = (over: Partial<JudgeContext> = {}): JudgeContext => ({
  tier: "mid", cap: 60, probing: false, coarsePointer: true, triedHigh: false, ...over,
});

/** ms ごとの間隔を n 個並べた記録 */
function sampleOf(intervals: number[]) {
  const elapsedMs = intervals.reduce((a, b) => a + b, 0);
  return { intervals, frames: intervals.length, elapsedMs };
}
const steady = (ms: number, n = 80) => Array.from({ length: n }, () => ms);
const jitter = (ms: number, spread: number, n = 80) =>
  Array.from({ length: n }, (_, i) => ms + Math.sin(i * 1.7) * spread);

describe("ブラウザの30コマ制限を、端末の重さと取り違えない", () => {
  it("33ms に張り付いているのは制限（画質を下げない）", () => {
    const v = judge(sampleOf(steady(33.3)), ctx());
    expect(v.kind).toBe("throttled");
  });

  it("ばらついて遅いのは重さ（中 → 低に下げる）", () => {
    const v = judge(sampleOf(jitter(40, 14)), ctx());
    expect(v).toMatchObject({ kind: "down", to: "low" });
  });

  it("「低」はもともと30コマが上限なので、30コマでも下げも制限扱いもしない", () => {
    const v = judge(sampleOf(steady(33.3)), ctx({ tier: "low", cap: 30 }));
    expect(v.kind).toBe("keep");
  });

  it("記録が少なすぎるときは制限と決めつけない", () => {
    expect(looksLikeBrowserCap30(steady(33.3, 5))).toBe(false);
  });
});

describe("下げる・上げる", () => {
  it("「高」で 30fps 前後なら「中」に下げる", () => {
    expect(judge(sampleOf(jitter(32, 9)), ctx({ tier: "high" }))).toMatchObject({ kind: "down", to: "mid" });
  });

  it("「中」で余裕があっても、スマホは「高」へ自動では上げない（電池と熱のため）", () => {
    expect(judge(sampleOf(steady(16.7)), ctx({ coarsePointer: true })).kind).toBe("keep");
  });

  it("パソコンで余裕があれば「高」を一度だけ試す", () => {
    expect(judge(sampleOf(steady(16.7)), ctx({ coarsePointer: false }))).toMatchObject({ kind: "up", to: "high" });
    expect(judge(sampleOf(steady(16.7)), ctx({ coarsePointer: false, triedHigh: true })).kind).toBe("keep");
  });

  it("「低」で上限を外して測り、55fps 以上出れば「中」に戻す", () => {
    expect(judge(sampleOf(steady(16.7)), ctx({ tier: "low", cap: 60, probing: true }))).toMatchObject({ kind: "up", to: "mid" });
    expect(judge(sampleOf(jitter(25, 6)), ctx({ tier: "low", cap: 60, probing: true })).kind).toBe("keep");
  });
});

describe("「低」でも重い端末", () => {
  it("これ以上は軽くできないので、動かすのをやめる（止めた1枚にする）", () => {
    expect(judge(sampleOf(jitter(70, 15)), ctx({ tier: "low", cap: 30 })).kind).toBe("freeze");
  });

  it("「低」の上限どおり（30コマ前後）なら止めない", () => {
    expect(judge(sampleOf(jitter(34, 4)), ctx({ tier: "low", cap: 30 })).kind).toBe("keep");
  });
});

describe("画質ごとの量", () => {
  it("高 → 中 → 低 の順に軽くなる", () => {
    const t = tierSpecs(3);
    for (const k of ["pixelRatio", "particles", "fish", "rays", "reef"] as const) {
      expect(t.high[k]).toBeGreaterThan(t.mid[k]);
      expect(t.mid[k]).toBeGreaterThan(t.low[k]);
    }
    expect([t.high.lod, t.mid.lod, t.low.lod]).toEqual([0, 1, 2]);
  });

  it("解像度は端末の画素比を超えない", () => {
    const t = tierSpecs(1);
    expect(t.high.pixelRatio).toBeLessThanOrEqual(1);
    expect(t.mid.pixelRatio).toBeLessThanOrEqual(1);
  });
});
