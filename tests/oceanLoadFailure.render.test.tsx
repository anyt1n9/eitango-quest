import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

/**
 * 海の3D背景の部品そのものを取りに行けなかったとき（通信が切れている・デプロイ直後で
 * 古いファイルが無い）。
 *
 * 背景は飾りなので、いつもの背景に戻してアプリは使えるままにする。
 * 失敗が最上位の ErrorBoundary まで届くと、設定（quest_bg_ocean=on）が保存されているため
 * 読み直しても同じ所で落ち、設定の画面にも行けなくなる。
 */

vi.mock("../src/vocabulary", () => ({
  loadVocabulary: () => Promise.resolve(WORDS),
  loadedVocabulary: () => null,
}));
// 動的 import の失敗と同じく、読み込みが投げる
vi.mock("../src/components/OceanBackground", () => {
  throw new Error("Failed to fetch dynamically imported module: /assets/OceanBackground-old.js");
});

const WORDS = [
  {
    id: "j1", word: "apple", translation: "りんご", level: "junior",
    sentence: "I like [_____].", sentenceTranslation: "りんごが好きです。",
    pos: "noun", options: ["りんご", "小さい", "重い", "速い"], sentenceOptions: ["apple", "small", "heavy", "fast"],
  },
];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("quest_bg_ocean", "on");
  window.history.pushState({}, "", "/");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("海の3D背景を読み込めなかったとき", () => {
  it("いつもの背景に戻し、アプリは使えるままにする", async () => {
    const { default: App } = await import("../src/App");
    render(<App />);
    await waitFor(() => expect(document.getElementById("vocabulary_loading_screen")).toBeNull());
    // 3D は画面が落ち着いてから読み込む（App の oceanMounted）ので、少し待つ
    await waitFor(() => expect(screen.getByTestId("background_scene").dataset.kind).toBe("scene"), { timeout: 5000 });
    expect(screen.queryByText(/問題が発生しました/)).toBeNull();
    expect(document.getElementById("btn_junior_word")).not.toBeNull();
    // 設定は消さない（通信が戻れば、次に開いたとき海が出る）
    expect(localStorage.getItem("quest_bg_ocean")).toBe("on");
  });
});
