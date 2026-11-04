import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEME_COLORS, applyThemeColor } from "../src/themeColor";

/**
 * ブラウザの上の帯（theme-color）の色。
 *
 * 帯を `media="(prefers-color-scheme: …)"` の2つで分けていたときは、端末の設定で選ばれるため、
 * 端末が暗くアプリを明るくしている人では、暗い帯の下に紙の色の画面が出ていた。
 */

const root = join(__dirname, "..");

beforeEach(() => {
  document.head.innerHTML = "";
});

describe("theme-color", () => {
  it("選んだテーマの地の色にする", () => {
    applyThemeColor(true);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
    expect(meta.content).toBe(THEME_COLORS.dark);
    applyThemeColor(false);
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(meta.content).toBe(THEME_COLORS.light);
  });

  it("端末の設定で選ばれる media を残さない", () => {
    document.head.innerHTML = '<meta name="theme-color" content="#000" media="(prefers-color-scheme: dark)">';
    applyThemeColor(false);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
    expect(meta.hasAttribute("media")).toBe(false);
    expect(meta.content).toBe(THEME_COLORS.light);
  });

  it("index.html の起動スクリプトも同じ色を書く（React を待たずに決めるため）", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    expect(html).not.toMatch(/name="theme-color"[^>]*media=/);
    expect(html).toContain(`dark ? "${THEME_COLORS.dark}" : "${THEME_COLORS.light}"`);
  });

  it("ホーム画面から開いたときの起動画面は暗い方にする（暗いテーマの人に白い画面を光らせない）", () => {
    // manifest は明暗を分けられない
    const config = readFileSync(join(root, "vite.config.ts"), "utf8");
    expect(config).toContain(`background_color: '${THEME_COLORS.dark}'`);
  });
});
