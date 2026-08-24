import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { LEVEL_TONE, CUSTOM_TONE, LEVEL_STYLE } from "../src/levelTheme";
import { LEVEL_ORDER } from "../src/grammar";

/**
 * レベルの色。
 *
 * 明るいテーマは森、暗いテーマは海で、同じ変数（`--lv-*`）を置き換えている。
 * コンポーネント側は色を持たず `.level-*` を指すだけなので、
 * CSS に組を書き忘れても型検査もビルドも通り、
 * 画面ではその色だけが「変数が無い＝透明」になって消える。
 * ここで一覧を突き合わせて、片方のテーマだけ抜けている状態を落とす。
 */
const CSS = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

/** `.level-xxx { ... }`（暗いテーマは `.dark .level-xxx { ... }`）の中身を取り出す */
function block(tone: string, dark: boolean): string | null {
  // 行頭から見る。`.dark .level-junior` は `.level-junior` にも
  // 部分一致するため、明るいテーマを探すときに拾ってしまう
  const head = dark ? `\\n\\.dark \\.${tone} \\{` : `\\n\\.${tone} \\{`;
  const m = new RegExp(`${head}([^}]*)\\}`).exec(CSS);
  return m ? m[1] : null;
}

const VARS = ["--lv-fg", "--lv-bg", "--lv-bg-strong", "--lv-border", "--lv-solid", "--lv-solid-hover"];

describe("レベルの色", () => {
  it("5段階すべてに色の組がある", () => {
    for (const level of LEVEL_ORDER) {
      expect(LEVEL_TONE[level], level).toBeTruthy();
    }
    expect(new Set(Object.values(LEVEL_TONE)).size, "2つのレベルが同じ組を指している").toBe(5);
    expect(Object.values(LEVEL_TONE)).not.toContain(CUSTOM_TONE);
  });

  it("明るいテーマ（森）と暗いテーマ（海）の両方に、必要な変数がそろっている", () => {
    for (const tone of [...Object.values(LEVEL_TONE), CUSTOM_TONE]) {
      for (const dark of [false, true]) {
        const body = block(tone, dark);
        expect(body, `${tone} の${dark ? "暗い" : "明るい"}テーマの色が無い`).not.toBeNull();
        for (const v of VARS) {
          expect(body, `${tone} / ${dark ? "dark" : "light"} に ${v} が無い`).toContain(`${v}:`);
        }
      }
    }
  });

  it("同じテーマの中で、レベルどうしの色が重ならない", () => {
    for (const dark of [false, true]) {
      const solids = Object.values(LEVEL_TONE).map(t => {
        const body = block(t, dark)!;
        return /--lv-solid:\s*([^;]+);/.exec(body)![1].trim();
      });
      expect(new Set(solids).size, `${dark ? "暗い" : "明るい"}テーマで色が重なっている`).toBe(5);
    }
  });

  it("部品のクラスは、色を直に書かず変数を指す", () => {
    // ここに実際の色を書くと、明暗の2組をコンポーネント側で選ぶことになり、
    // 片方のテーマだけ直し忘れる形の不具合が入る
    for (const [name, cls] of Object.entries(LEVEL_STYLE)) {
      expect(cls, name).toContain("var(--lv-");
      expect(cls, `${name} に色を直に書いている`).not.toMatch(/-(blue|emerald|purple|pink|amber|indigo)-\d/);
    }
  });
});
