import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor, act } from "@testing-library/react";
import { todayStr } from "../src/srs";
import { GLASS_SAFE_MAX, __resetGlassForTest, setGlass } from "../src/glass";

/**
 * 明るいテーマで海の上のカードを透かしたとき（18%より上）は、中身（#main_payload）を暗いテーマ（海）の色で描く。
 *
 * 明るいテーマの文字は墨色に白い縁取りなので、カードの地が薄くなると、濃い青の海の上に暗い文字が乗って
 * 読めなかった（とくに3Dの海を描く前・描けない端末の、海の色の地の上で）。海は暗い背景なので、
 * 暗いテーマと同じ白い文字・紺の縁取りにする。色は CSS（.dark の中で変数が置き換わる）が持つので、
 * ここでは「どの組み合わせのときに中身へ .dark を付けるか」を固定する（見え方は e2e が見る）。
 */

vi.mock("../src/vocabulary", () => ({
  loadVocabulary: () => Promise.resolve(WORDS),
  loadedVocabulary: () => null
}));

const WORDS = Array.from({ length: 5 }, (_, i) => ({
  id: `j${i}`, word: `word${i}`, translation: `訳${i}`, level: "junior",
  sentence: "I like [_____].", sentenceTranslation: "好きです。",
  pos: "noun", options: [`訳${i}`, "小さい", "重い", "速い"], sentenceOptions: [`word${i}`, "small", "heavy", "fast"]
}));

async function renderApp(path = "/") {
  window.history.pushState({}, "", path);
  const { default: App } = await import("../src/App");
  render(<App />);
  await waitFor(() => expect(document.getElementById("vocabulary_loading_screen")).toBeNull());
}

const main = () => document.getElementById("main_payload")!;
const isSea = () => main().classList.contains("dark");

beforeEach(() => {
  localStorage.clear();
  __resetGlassForTest();
  document.documentElement.classList.remove("dark");
  localStorage.setItem("quest_stats", JSON.stringify({ score: 0, currentStreak: 1, lastLoginDate: todayStr(), completedQuestions: 0, correctAnswers: 0 }));
  localStorage.setItem("quest_theme", "light");
});
afterEach(() => cleanup());

describe("海の上で透かしたカードの色", () => {
  it("明るいテーマ・海の3D背景・18%より上なら、中身を海の色で描く（文字の色も中身で決め直す）", async () => {
    localStorage.setItem("quest_glass", "100");
    await renderApp();
    expect(isSea()).toBe(true);
    expect(main()).toHaveAttribute("data-sea-glass", "true");
    // 文字の色は根の要素で決まって継がれるので、中身でも指定する（無いと墨色のまま白い縁取りの上に残る）
    expect(main().className).toContain("dark:text-slate-100");
    // ヘッダーとタブは不透明なので、明るいテーマのまま
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.getElementById("navigation_bar")!.closest(".dark")).toBeNull();
    expect(document.getElementById("tab_bar")!.closest(".dark")).toBeNull();
  });

  it("読みやすさを保つ範囲（18%まで）では、明るいテーマのまま。つまみで範囲をまたぐと切り替わる", async () => {
    localStorage.setItem("quest_glass", String(GLASS_SAFE_MAX));
    await renderApp();
    expect(isSea()).toBe(false);
    act(() => setGlass(GLASS_SAFE_MAX + 1));
    expect(isSea()).toBe(true);
    act(() => setGlass(0));
    expect(isSea()).toBe(false);
  });

  it("海の3D背景を使っていない人（ジャングルの飾り・写真）には付けない", async () => {
    localStorage.setItem("quest_glass", "100");
    localStorage.setItem("quest_bg_ocean_choice", "off");
    await renderApp();
    expect(isSea()).toBe(false);
  });

  it("暗いテーマでは、もともと海の色なので中身には付けない", async () => {
    localStorage.setItem("quest_glass", "100");
    localStorage.setItem("quest_theme", "dark");
    await renderApp();
    expect(isSea()).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("出題中は背景を出さずカードも透かさないので、明るいテーマのまま", async () => {
    localStorage.setItem("quest_glass", "100");
    await renderApp();
    expect(isSea()).toBe(true);
    await act(async () => { document.getElementById("btn_junior_word")!.click(); });
    await waitFor(() => expect(document.getElementById("quiz_options_container")).not.toBeNull());
    expect(isSea()).toBe(false);
  });
});
