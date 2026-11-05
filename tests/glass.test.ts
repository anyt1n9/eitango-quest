import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GLASS_KEY, GLASS_PRESETS, GLASS_SAFE_MAX, clampGlass, glassRegime, parseGlass, readGlass
} from "../src/glass";

/**
 * カードとボタンの透明感（ガラス）の設定。0〜100（%）の1つの数で持つ。
 *
 * 透かすほど背景は見えるが文字は読みにくくなるので、
 * **既定は 0**（不透明）で、選んだ人にだけ効かせる。
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

describe("透明度の設定", () => {
  it("何も選んでいなければ 0（不透明）", () => {
    expect(readGlass()).toBe(0);
  });

  it("0〜100 の数を覚える", () => {
    for (const v of [0, 1, 18, 19, 55, 100]) {
      store.setItem(GLASS_KEY, String(v));
      expect(readGlass()).toBe(v);
    }
  });

  it("以前の4段階の保存値は、そのときと同じ見え方の数に読み替える", () => {
    expect(parseGlass("off")).toBe(0);
    expect(parseGlass("light")).toBe(14);   // 地 0.86
    expect(parseGlass("strong")).toBe(18);  // 地 0.82（読みやすさを保つ上限）
    expect(parseGlass("clear")).toBe(100);
  });

  it("知らない値・範囲の外は 0 として扱う（読めない状態にしない）", () => {
    for (const bad of ["", "on", "MAX", "0.5", "-1", "101", "1000", "null", "transparent", "toString", "__proto__", " 50"]) {
      expect(parseGlass(bad), bad).toBe(0);
    }
  });

  it("localStorage が使えなくても落ちない", () => {
    const original = (globalThis as any).localStorage;
    (globalThis as any).localStorage = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); }
    };
    expect(readGlass()).toBe(0);
    (globalThis as any).localStorage = original;
  });

  it("つまみの値は整数の 0〜100 に収める", () => {
    expect(clampGlass(-5)).toBe(0);
    expect(clampGlass(17.6)).toBe(18);
    expect(clampGlass(250)).toBe(100);
    expect(clampGlass(NaN)).toBe(0);
  });

  it("読みやすさを保証するのは 18% まで。それより上は「保証の外」", () => {
    expect(glassRegime(0)).toBe("off");
    expect(glassRegime(1)).toBe("veil");
    expect(glassRegime(GLASS_SAFE_MAX)).toBe("veil");
    expect(glassRegime(GLASS_SAFE_MAX + 1)).toBe("clear");
    expect(glassRegime(100)).toBe("clear");
  });

  it("よく使う値は、オフ・保証の上限・透明", () => {
    expect(GLASS_PRESETS.map(p => p.value)).toEqual([0, GLASS_SAFE_MAX, 100]);
    // 画面に出す文言が欠けていると、何を選んでいるのか分からない
    expect(GLASS_PRESETS.every(p => p.label.length > 0 && p.note.length > 0)).toBe(true);
  });

  /**
   * 「18」は CSS の式（--glass-chip-alpha などの折れ目）と、起動直後に当てる index.html にもある。
   * 片方だけ変えると、保証の上限と見た目の折れ目がずれる。
   */
  it("保証の上限は CSS と index.html の起動スクリプトでも同じ", () => {
    const root = join(__dirname, "..");
    const css = readFileSync(join(root, "src", "index.css"), "utf8");
    const section = css.slice(css.indexOf("カードとボタンの透明感（ガラス）"), css.indexOf("背景の飾り（明るいテーマ"));
    for (const name of ["--glass-chip-alpha", "--glass-blur", "--glass-inner-alpha"]) {
      const line = section.split("\n").find(l => l.trimStart().startsWith(`${name}:`))!;
      expect(line, name).toContain(`- ${GLASS_SAFE_MAX})`);
    }
    const html = readFileSync(join(root, "index.html"), "utf8");
    expect(html).toContain(`t <= ${GLASS_SAFE_MAX} ? "veil" : "clear"`);
  });
});
