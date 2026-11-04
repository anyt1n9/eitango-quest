import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * 海の3D背景の入れ方。段階②-3で既定にした（決め方は src/oceanSetting.ts）。
 *
 * 試験中は App が起動のたびに quest_bg_ocean へ "off" を書いていたので、その "off" は
 * 本人の選択とは限らない。本人が選んだものだけを quest_bg_ocean_choice に書き、そちらを優先する。
 * jsdom には WebGL が無いので、海は「海の色の地」になる（それも確かめる）。
 */

vi.mock("../src/vocabulary", () => ({
  loadVocabulary: () => Promise.resolve(WORDS),
  loadedVocabulary: () => null,
}));

const WORDS = [
  {
    id: "j1", word: "apple", translation: "りんご", level: "junior",
    sentence: "I like [_____].", sentenceTranslation: "りんごが好きです。",
    pos: "noun", options: ["りんご", "小さい", "重い", "速い"], sentenceOptions: ["apple", "small", "heavy", "fast"],
  },
];

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, "", "/");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function renderApp() {
  const { default: App } = await import("../src/App");
  render(<App />);
  await waitFor(() => expect(document.getElementById("vocabulary_loading_screen")).toBeNull());
}

const ocean = () => document.querySelector(".bg-ocean3d") as HTMLElement | null;

describe("海の3D背景", () => {
  it("はじめから海を出す（WebGL が無ければ海の色の地）", async () => {
    await renderApp();
    await waitFor(() => expect(ocean()).not.toBeNull());
    // 3D は画面が落ち着いてから読み込む（それまでは同じ海の色の地 ocean-loading）
    expect(["ocean-loading", "ocean", "ocean-fallback"]).toContain(ocean()!.dataset.kind);
    await waitFor(() => expect(["ocean", "ocean-fallback"]).toContain(ocean()!.dataset.kind), { timeout: 5000 });
    expect(document.querySelector('[data-kind="scene"]')).toBeNull();
  });

  it("起動しただけでは選択を保存しない（本人が選んだのかを区別するため）", async () => {
    await renderApp();
    expect(localStorage.getItem("quest_bg_ocean_choice")).toBeNull();
    expect(localStorage.getItem("quest_bg_ocean")).toBeNull();
  });

  it("試験中に起動のたびに書かれた \"off\" では、海を止めない", async () => {
    localStorage.setItem("quest_bg_ocean", "off");
    await renderApp();
    await waitFor(() => expect(ocean()).not.toBeNull());
  });

  it("「使わない」を選んだ人には、いつもの飾りを出す", async () => {
    localStorage.setItem("quest_bg_ocean_choice", "off");
    await renderApp();
    expect(screen.getByTestId("background_scene").dataset.kind).toBe("scene");
    expect(ocean()).toBeNull();
  });

  it("自分の画像を背景にしている人は、画像のまま（海で隠さない）", async () => {
    localStorage.setItem("quest_bg_image", "data:image/jpeg;base64,AAAA");
    await renderApp();
    expect(ocean()).toBeNull();
  });

  it("背景の設定で選べて、端末に保存される", async () => {
    window.history.pushState({}, "", "/background");
    await renderApp();
    const user = userEvent.setup();
    // 背景の設定は lazy() で読む画面なので、重い環境では出るまで少しかかる
    const off = await screen.findByRole("button", { name: "使わない" }, { timeout: 5000 });
    expect(off.getAttribute("aria-pressed")).toBe("false");
    await user.click(off);
    expect(off.getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem("quest_bg_ocean_choice")).toBe("off");
    await waitFor(() => expect(ocean()).toBeNull());
    await user.click(screen.getByRole("button", { name: "使う" }));
    expect(localStorage.getItem("quest_bg_ocean_choice")).toBe("on");
    await waitFor(() => expect(ocean()).not.toBeNull());
  });
});
