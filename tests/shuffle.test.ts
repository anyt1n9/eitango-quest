import { describe, it, expect, afterEach, vi } from "vitest";
import { shuffle, sampleArray } from "../src/shuffle";
import { seededRandom } from "./helpers";

/** 分布を調べる間だけ Math.random を決定的な擬似乱数に差し替える */
function withSeededRandom(seed: number, fn: () => void) {
  const rnd = seededRandom(seed);
  const spy = vi.spyOn(Math, "random").mockImplementation(rnd);
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
}

afterEach(() => vi.restoreAllMocks());

describe("shuffle", () => {
  it("元の配列を書き換えない", () => {
    const src = [1, 2, 3, 4, 5];
    const copy = [...src];
    shuffle(src);
    expect(src).toEqual(copy);
  });

  it("要素を過不足なく保つ", () => {
    const src = ["a", "b", "c", "d", "e", "f"];
    const out = shuffle(src);
    expect(out).toHaveLength(src.length);
    expect([...out].sort()).toEqual([...src].sort());
  });

  it("空配列・1要素でも壊れない", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([7])).toEqual([7]);
  });

  it("四択の並びが一様になる（先頭に正解が残る偏りが無い）", () => {
    // 以前の `sort(() => Math.random() - 0.5)` では、元の先頭要素が
    // 1番目に残る確率が約36%（一様なら25%）だった。
    // options は「正解 + ダミー3件」の順で生成されるため、この偏りは
    // 「常に1番目を選ぶ」だけで期待値以上の正答率が出ることを意味する。
    withSeededRandom(20260808, () => {
      const N = 40000;
      const counts = [0, 0, 0, 0];
      for (let i = 0; i < N; i++) {
        counts[shuffle([0, 1, 2, 3]).indexOf(0)]++;
      }
      for (const c of counts) {
        expect(Math.abs(c / N - 0.25)).toBeLessThan(0.015);
      }
    });
  });

  it("全ての並び順が現れる（特定の順列に落ちない）", () => {
    withSeededRandom(7, () => {
      const seen = new Set<string>();
      for (let i = 0; i < 3000; i++) seen.add(shuffle([1, 2, 3]).join(""));
      expect(seen.size).toBe(6); // 3! = 6通り
    });
  });
});

describe("sampleArray", () => {
  it("要求数より短い配列はそのまま返す（コピーであること）", () => {
    const src = [1, 2, 3];
    const out = sampleArray(src, 10);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
  });

  it("要求数ちょうどを重複なく返す", () => {
    const src = Array.from({ length: 100 }, (_, i) => i);
    const out = sampleArray(src, 30);
    expect(out).toHaveLength(30);
    expect(new Set(out).size).toBe(30);
    for (const v of out) expect(src).toContain(v);
  });

  it("元の配列を書き換えない", () => {
    const src = Array.from({ length: 50 }, (_, i) => i);
    const copy = [...src];
    sampleArray(src, 10);
    expect(src).toEqual(copy);
  });

  it("先頭からの切り出しではなく全体から選ぶ", () => {
    // 以前は `slice(0, size)` だったため、7,000語習得していても
    // AIには常に同じ「最初の300語」しか渡らなかった。
    withSeededRandom(99, () => {
      const src = Array.from({ length: 1000 }, (_, i) => i);
      const seen = new Set<number>();
      for (let i = 0; i < 50; i++) for (const v of sampleArray(src, 20)) seen.add(v);
      // 後半（index 500以降）からも十分に選ばれている
      expect([...seen].filter(v => v >= 500).length).toBeGreaterThan(200);
    });
  });
});
