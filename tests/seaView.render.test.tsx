import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, act } from "@testing-library/react";
import { useEffect } from "react";
import userEvent from "@testing-library/user-event";

/**
 * 海を眺める（App の seaView）。
 *
 * カードは読みやすさのために不透明（ガラスでも地を8割以上残す）なので、マンタや魚の群れが
 * カードの裏を泳いでいるあいだは見えない。「せっかくの海で動いている生き物が見えない」と言われた。
 * 読みやすさを削らずに海を見せるため、画面の文字を一時的に隠すボタンを置いている。
 *
 *   - 3D の海を描けているときだけ出す（OceanBackground の onDrawingChange）。部品を読み込み中のとき・
 *     3Dモデルを取れず海の色の地になったときに押すと、文字だけが消えて眺めるもののない地が出る
 *   - 隠すだけで外さない（入力の途中・開いていた詳細を失わない）。隠したものは操作も読み上げも受けない（inert）
 *   - どこを押しても・Esc でも戻り、押したボタンへ戻る
 */

const gpu = vi.hoisted(() => ({ ok: true }));
vi.mock("../src/oceanSetting", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/oceanSetting")>()),
  canRenderOcean: () => gpu.ok,
}));
// three.js は jsdom で動かないので、海の代わりを置く。描けたかどうかはテストから決める
const ocean = vi.hoisted(() => ({
  drawsOnMount: true,
  report: (_drawing: boolean) => {},
}));
vi.mock("../src/components/OceanBackground", () => ({
  default: ({ onDrawingChange }: { onDrawingChange?: (d: boolean) => void }) => {
    useEffect(() => {
      ocean.report = d => onDrawingChange?.(d);
      if (ocean.drawsOnMount) onDrawingChange?.(true);
      return () => onDrawingChange?.(false);
    }, [onDrawingChange]);
    return <div className="bg-scene bg-ocean3d" data-kind="ocean" aria-hidden="true" />;
  },
}));
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
  gpu.ok = true;
  ocean.drawsOnMount = true;
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

const seaButton = () => screen.findByRole("button", { name: /海を眺める/ }, { timeout: 5000 });
const ui = () => [
  document.getElementById("navigation_bar")!,
  document.getElementById("main_payload")!,
  document.getElementById("tab_bar")!,
];

describe("海を眺める", () => {
  it("押すと画面の文字を隠し、どこかを押すと戻る", async () => {
    await renderApp();
    const button = await seaButton();
    await userEvent.click(button);

    for (const el of ui()) {
      expect(el.classList.contains("sea-hidden")).toBe(true);
      // 見えないものに Tab で入ったり、読み上げが拾ったりしない
      expect(el.hasAttribute("inert")).toBe(true);
    }
    // 隠すだけで外さない（「今日」の画面はそのまま残っている）
    expect(document.getElementById("btn_junior_word")).not.toBeNull();
    const exit = screen.getByRole("button", { name: "画面に戻る" });
    expect(exit).toHaveFocus();

    await userEvent.click(exit);
    expect(screen.queryByRole("button", { name: "画面に戻る" })).toBeNull();
    for (const el of ui()) {
      expect(el.classList.contains("sea-hidden")).toBe(false);
      expect(el.hasAttribute("inert")).toBe(false);
    }
    // 押したボタンへ戻す（隠していたあいだに、どこにいたのかを見失わない）
    await waitFor(() => expect(screen.getByRole("button", { name: /海を眺める/ })).toHaveFocus());
  });

  it("Esc でも戻る", async () => {
    await renderApp();
    await userEvent.click(await seaButton());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "画面に戻る" })).toBeNull();
    expect(document.getElementById("main_payload")!.classList.contains("sea-hidden")).toBe(false);
  });

  it("3D を描けない端末では出さない（海の色の地だけで、眺めるものが無い）", async () => {
    gpu.ok = false;
    await renderApp();
    await waitFor(() => expect(document.querySelector(".bg-ocean3d")?.getAttribute("data-kind")).toBe("ocean-fallback"), {
      timeout: 5000,
    });
    expect(screen.queryByRole("button", { name: /海を眺める/ })).toBeNull();
  });

  it("部品を読み込んだだけで、まだ描けていないあいだは出さない", async () => {
    ocean.drawsOnMount = false;
    await renderApp();
    await waitFor(() => expect(document.querySelector('.bg-ocean3d[data-kind="ocean"]')).not.toBeNull(), { timeout: 5000 });
    expect(screen.queryByRole("button", { name: /海を眺める/ })).toBeNull();
    act(() => ocean.report(true));
    expect(screen.getByRole("button", { name: /海を眺める/ })).toBeTruthy();
  });

  it("途中で描けなくなったら（3Dモデルを取れない・WebGL を失った）ボタンを下げ、眺めていれば画面に戻す", async () => {
    await renderApp();
    await userEvent.click(await seaButton());
    expect(screen.getByRole("button", { name: "画面に戻る" })).toBeTruthy();
    act(() => ocean.report(false));
    expect(screen.queryByRole("button", { name: "画面に戻る" })).toBeNull();
    expect(screen.queryByRole("button", { name: /海を眺める/ })).toBeNull();
    expect(document.getElementById("main_payload")!.classList.contains("sea-hidden")).toBe(false);
  });

  it("海を使わない人には出さない", async () => {
    localStorage.setItem("quest_bg_ocean_choice", "off");
    await renderApp();
    // 3D を読み込む頃合い（App の oceanMounted）を過ぎても出てこない
    await new Promise(r => setTimeout(r, 1200));
    expect(screen.queryByRole("button", { name: /海を眺める/ })).toBeNull();
  });
});
