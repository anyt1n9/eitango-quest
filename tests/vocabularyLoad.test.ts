import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 単語データの遅延読み込み（`src/vocabulary.ts`）の検査。
 *
 * 3.1MB の単語データは別のチャンクなので、通信断やサービスワーカー更新の直後は
 * 取りに行けないことがある。そのとき失敗した約束を控えに残したままにすると、
 * 読み直しても同じ失敗が返るだけで、起動時の待機画面から永久に出られない。
 */

let attempt = 0;
const WORDS = [{ id: "j1", word: "beautiful", translation: "美しい" }];

// 1回目の読み出しだけ失敗させる。
// import そのものではなく値の取り出しで投げることで、
// 「読み込みが失敗した」状態を同じモジュール実体のまま2回試せる
vi.mock("../src/data/vocabulary", () => ({
  get initialVocabulary() {
    attempt++;
    if (attempt === 1) throw new Error("chunk load failed");
    return WORDS;
  }
}));

beforeEach(() => {
  attempt = 0;
});

describe("loadVocabulary", () => {
  it("失敗したあとに読み直すと今度は読める", async () => {
    const { loadVocabulary, loadedVocabulary } = await import("../src/vocabulary");

    await expect(loadVocabulary()).rejects.toThrow("chunk load failed");
    expect(loadedVocabulary()).toBeNull();

    // 失敗した約束が残っていると、ここでも同じ失敗が返る
    await expect(loadVocabulary()).resolves.toEqual(WORDS);
    expect(loadedVocabulary()).toEqual(WORDS);
  });

  it("読み込みは1回だけで、二度目は控えを返す", async () => {
    const { loadVocabulary } = await import("../src/vocabulary");
    const first = await loadVocabulary();
    const second = await loadVocabulary();
    expect(second).toBe(first);
  });
});
