import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { GLASS_CHOICES, GLASS_KEY, readGlassLevel, saveGlassLevel } from "../src/glass";

/**
 * カードとボタンの透明感（ガラス）の設定。
 *
 * 透かすほど背景は見えるが文字は読みにくくなるので、
 * **既定は「オフ」**（不透明）で、選んだ人にだけ効かせる。
 * 読めない状態が既定になると、そもそも学習できない。
 */

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

describe("透明感の設定", () => {
  it("何も選んでいなければオフ（不透明）", () => {
    expect(readGlassLevel()).toBe("off");
  });

  it("選んだ濃さを覚える", () => {
    for (const level of ["light", "strong", "off"] as const) {
      saveGlassLevel(level);
      expect(store.getItem(GLASS_KEY)).toBe(level);
      expect(readGlassLevel()).toBe(level);
    }
  });

  it("知らない値が入っていてもオフとして扱う（読めない状態にしない）", () => {
    for (const bad of ["", "on", "MAX", "0.5", "null"]) {
      store.setItem(GLASS_KEY, bad);
      expect(readGlassLevel(), bad).toBe("off");
    }
  });

  it("localStorage が使えなくても落ちない", () => {
    const original = (globalThis as any).localStorage;
    (globalThis as any).localStorage = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); }
    };
    expect(readGlassLevel()).toBe("off");
    expect(() => saveGlassLevel("strong")).not.toThrow();
    (globalThis as any).localStorage = original;
  });

  it("選択肢はオフを先頭に、薄い順で並ぶ", () => {
    expect(GLASS_CHOICES.map(c => c.level)).toEqual(["off", "light", "strong"]);
    // 画面に出す文言が欠けていると、何を選んでいるのか分からない
    expect(GLASS_CHOICES.every(c => c.label.length > 0 && c.note.length > 0)).toBe(true);
  });
});
