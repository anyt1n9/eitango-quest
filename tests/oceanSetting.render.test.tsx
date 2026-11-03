import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * 海の3D背景（試験中）の入れ方。
 *
 * three.js と3Dモデル（約1.3MB）を読むので、選んだ人にだけ出す。
 * 既定で出してしまうと、使うつもりの無い人の端末にも通信と描画の負担がかかる。
 * jsdom には WebGL が無いので、選んだときは「海の色の地」に切り替わる（それも確かめる）。
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

describe("海の3D背景（試験中）", () => {
  it("はじめは使わない（いつもの飾りを出す）", async () => {
    await renderApp();
    expect(screen.getByTestId("background_scene").dataset.kind).toBe("scene");
    expect(document.querySelector(".bg-ocean3d")).toBeNull();
  });

  it("使うと決めた端末では海を出す（WebGL が無ければ海の色の地）", async () => {
    localStorage.setItem("quest_bg_ocean", "on");
    await renderApp();
    await waitFor(() => expect(document.querySelector(".bg-ocean3d")).not.toBeNull());
    expect(["ocean", "ocean-fallback"]).toContain((document.querySelector(".bg-ocean3d") as HTMLElement).dataset.kind);
    expect(document.querySelector('[data-kind="scene"]')).toBeNull();
  });

  it("背景の設定で選べて、端末に保存される", async () => {
    window.history.pushState({}, "", "/background");
    await renderApp();
    const user = userEvent.setup();
    const on = await screen.findByRole("button", { name: "使う" });
    expect(on.getAttribute("aria-pressed")).toBe("false");
    await user.click(on);
    expect(on.getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem("quest_bg_ocean")).toBe("on");
    await waitFor(() => expect(document.querySelector(".bg-ocean3d")).not.toBeNull());
    await user.click(screen.getByRole("button", { name: "使わない" }));
    expect(localStorage.getItem("quest_bg_ocean")).toBe("off");
    await waitFor(() => expect(document.querySelector(".bg-ocean3d")).toBeNull());
  });
});
