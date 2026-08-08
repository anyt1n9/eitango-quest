import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { readStoredArray, readStoredObject } from "../src/storage";

/** localStorage の最小実装（node 環境には存在しないため） */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

const store = new MemoryStorage();
(globalThis as any).localStorage = store;
afterAll(() => { delete (globalThis as any).localStorage; });
beforeEach(() => store.clear());

describe("readStoredArray", () => {
  it("保存された配列をそのまま返す", () => {
    store.setItem("k", JSON.stringify([1, 2, 3]));
    expect(readStoredArray<number>("k")).toEqual([1, 2, 3]);
  });

  it("キーが無ければ fallback", () => {
    expect(readStoredArray("missing", ["x"])).toEqual(["x"]);
  });

  it("配列以外のJSONが入っていても fallback に落とす", () => {
    // 破損データ（バックアップ復元・古い形式の残骸）で
    // `[...customList]` が TypeError を投げ、起動時に画面が真っ白になっていた
    for (const bad of ["{}", "5", '"text"', "null", "true", '{"a":1}']) {
      store.setItem("k", bad);
      expect(readStoredArray("k", ["fallback"])).toEqual(["fallback"]);
    }
  });

  it("JSONとして壊れていても例外を投げない", () => {
    store.setItem("k", "{not json");
    expect(() => readStoredArray("k")).not.toThrow();
    expect(readStoredArray("k")).toEqual([]);
  });

  it("空文字は fallback（保存に失敗した痕跡とみなす）", () => {
    store.setItem("k", "");
    expect(readStoredArray("k", ["f"])).toEqual(["f"]);
  });

  it("localStorage 自体が使えない環境でも fallback を返す", () => {
    const original = (globalThis as any).localStorage;
    (globalThis as any).localStorage = {
      getItem() { throw new Error("SecurityError: storage disabled"); }
    };
    try {
      expect(readStoredArray("k", ["f"])).toEqual(["f"]);
    } finally {
      (globalThis as any).localStorage = original;
    }
  });
});

describe("readStoredObject", () => {
  it("保存されたオブジェクトをそのまま返す", () => {
    store.setItem("k", JSON.stringify({ a: 1 }));
    expect(readStoredObject("k", {})).toEqual({ a: 1 });
  });

  it("配列は受け付けない（辞書として使う値のため）", () => {
    store.setItem("k", JSON.stringify([1, 2]));
    expect(readStoredObject("k", { d: true })).toEqual({ d: true });
  });

  it("オブジェクト以外は fallback", () => {
    for (const bad of ["5", '"text"', "null", "true"]) {
      store.setItem("k", bad);
      expect(readStoredObject("k", { d: true })).toEqual({ d: true });
    }
  });

  it("壊れたJSONでも例外を投げない", () => {
    store.setItem("k", "]]]");
    expect(() => readStoredObject("k", {})).not.toThrow();
  });
});
