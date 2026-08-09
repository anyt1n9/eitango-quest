import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  readStoredArray, readStoredObject, writeStored, setStorageErrorHandler, prefersDarkTheme
} from "../src/storage";

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

describe("writeStored", () => {
  it("オブジェクトをJSONにして保存する", () => {
    expect(writeStored("k", { a: 1 })).toBe(true);
    expect(store.getItem("k")).toBe('{"a":1}');
  });

  it("文字列はそのまま保存する（二重引用符で包まない）", () => {
    writeStored("k", "20");
    expect(store.getItem("k")).toBe("20");
  });

  it("保存できたら true を返す", () => {
    expect(writeStored("k", [1, 2, 3])).toBe(true);
  });

  it("容量超過でも例外を投げず false を返す", () => {
    // 上限に達すると setItem が QuotaExceededError を投げる。
    // これが useEffect の中で起きるとエラー画面に落ちていた
    const original = (globalThis as any).localStorage;
    (globalThis as any).localStorage = {
      setItem() {
        const e: any = new Error("QuotaExceededError");
        e.name = "QuotaExceededError";
        throw e;
      }
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(() => writeStored("k", { big: "x".repeat(100) })).not.toThrow();
      expect(writeStored("k", {})).toBe(false);
    } finally {
      warn.mockRestore();
      (globalThis as any).localStorage = original;
    }
  });

  it("localStorage 自体が使えなくても落ちない", () => {
    const original = (globalThis as any).localStorage;
    (globalThis as any).localStorage = undefined;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(writeStored("k", {})).toBe(false);
    } finally {
      warn.mockRestore();
      (globalThis as any).localStorage = original;
    }
  });

  it("失敗したときにハンドラへ通知する", () => {
    const original = (globalThis as any).localStorage;
    (globalThis as any).localStorage = { setItem() { throw new Error("full"); } };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const seen: string[] = [];
    setStorageErrorHandler(key => seen.push(key));
    try {
      writeStored("quest_srs", {});
      expect(seen).toEqual(["quest_srs"]);
    } finally {
      setStorageErrorHandler(null);
      warn.mockRestore();
      (globalThis as any).localStorage = original;
    }
  });

  it("ハンドラ自身が例外を投げてもアプリを壊さない", () => {
    const original = (globalThis as any).localStorage;
    (globalThis as any).localStorage = { setItem() { throw new Error("full"); } };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setStorageErrorHandler(() => { throw new Error("ハンドラの不具合"); });
    try {
      expect(() => writeStored("k", {})).not.toThrow();
    } finally {
      setStorageErrorHandler(null);
      warn.mockRestore();
      (globalThis as any).localStorage = original;
    }
  });

  it("書いた値を読み戻せる", () => {
    writeStored("k", [{ id: "a" }]);
    expect(readStoredArray<{ id: string }>("k")).toEqual([{ id: "a" }]);
  });
});

describe("prefersDarkTheme", () => {
  const setMatchMedia = (matches: boolean) => {
    (globalThis as any).window = { matchMedia: () => ({ matches }) };
  };
  const clearMatchMedia = () => { delete (globalThis as any).window; };

  it("保存された設定を最優先する", () => {
    setMatchMedia(false);
    store.setItem("quest_theme", "dark");
    expect(prefersDarkTheme()).toBe(true);

    setMatchMedia(true);
    store.setItem("quest_theme", "light");
    expect(prefersDarkTheme()).toBe(false);
    clearMatchMedia();
  });

  it("保存された設定が無ければ端末の設定に従う", () => {
    // 以前は保存値が "dark" かどうかだけを見ていたため、
    // OSをダークにしている人でも初回は必ずライトで開いていた
    setMatchMedia(true);
    expect(prefersDarkTheme()).toBe(true);

    setMatchMedia(false);
    expect(prefersDarkTheme()).toBe(false);
    clearMatchMedia();
  });

  it("端末の設定も分からなければライト", () => {
    clearMatchMedia();
    expect(prefersDarkTheme()).toBe(false);
  });

  it("保存値が壊れていても端末の設定へ落ちる", () => {
    store.setItem("quest_theme", "ダークモード");
    setMatchMedia(true);
    expect(prefersDarkTheme()).toBe(true);
    clearMatchMedia();
  });
});
