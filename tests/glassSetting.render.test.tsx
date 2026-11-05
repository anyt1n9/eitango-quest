import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BackgroundSettings from "../src/components/BackgroundSettings";
import GlassSlider from "../src/components/GlassSlider";
import Dashboard from "../src/components/Dashboard";
import { todayProps } from "./todayProps";
import { GLASS_KEY, GLASS_SAFE_MAX, __resetGlassForTest, flushGlassSave, setGlass } from "../src/glass";
import { makeWord } from "./fixtures";

/**
 * カードとボタンの透明感（ガラス）の画面まわり。
 *
 * 濃さそのものは CSS（`--glass-t` から計算）が持ち、明暗どちらのテーマでも
 * 読めるかは e2e が実際のブラウザで測る。ここでは
 *   - つまみ（0〜100%）と、よく使う値のボタンで選べること
 *   - 動かすとすぐ画面（<html> の data-glass と --glass-t）に当たり、つまみどうしで値がそろうこと
 *   - ガラスにする面へ印（クラス）が付いていること
 * を見る。印が外れると、設定を変えても何も起きないのに気づけない。
 */

function renderSettings() {
  render(
    <BackgroundSettings
      image={null}
      onChange={vi.fn()}
      veil="normal"
      onVeilChange={vi.fn()}
      ocean={false}
      onOceanChange={vi.fn()}
      onBack={vi.fn()}
    />
  );
}

const VOCAB = [
  makeWord({ id: "j1", word: "beautiful", level: "junior" }),
  makeWord({ id: "j2", word: "quiet", level: "junior" })
];

function renderDashboard() {
  render(<Dashboard {...todayProps({ vocabulary: VOCAB })} />);
}

const html = () => document.documentElement;
const slide = (el: HTMLElement, value: number) => fireEvent.change(el, { target: { value: String(value) } });

beforeEach(() => {
  localStorage.clear();
  __resetGlassForTest();
  delete html().dataset.glass;
  html().style.removeProperty("--glass-t");
});
afterEach(() => cleanup());

describe("透明度を選ぶ", () => {
  it("画像を選んでいなくても選べる（はじめからの飾りが背後にあるため）", () => {
    renderSettings();
    expect(screen.getByTestId("glass_picker")).toBeTruthy();
    expect(screen.getByRole("slider", { name: "透明度" })).toBeTruthy();
    for (const id of ["off", "safe", "clear"]) {
      expect(document.getElementById(`btn_glass_${id}`), id).toBeTruthy();
    }
  });

  it("つまみを動かすと、すぐ画面に当たり、少し待ってから保存する", () => {
    vi.useFakeTimers();
    try {
      renderSettings();
      slide(screen.getByRole("slider", { name: "透明度" }), 40);
      expect(html().dataset.glass).toBe("clear");
      expect(html().style.getPropertyValue("--glass-t")).toBe("40");
      // ドラッグ中は1秒に数十回動くので、そのたびには書かない
      expect(localStorage.getItem(GLASS_KEY)).toBeNull();
      act(() => { vi.advanceTimersByTime(300); });
      expect(localStorage.getItem(GLASS_KEY)).toBe("40");
    } finally {
      vi.useRealTimers();
    }
  });

  it("閉じる・裏に回るときは、待たずに保存する", () => {
    renderSettings();
    slide(screen.getByRole("slider", { name: "透明度" }), 12);
    window.dispatchEvent(new Event("pagehide"));
    expect(localStorage.getItem(GLASS_KEY)).toBe("12");
  });

  it("ヘッダーのつまみとメニューのつまみは同じ値を指す", () => {
    render(<GlassSlider id="header_glass_slider" />);
    renderSettings();
    const [header, settings] = screen.getAllByRole("slider", { name: "透明度" });
    slide(header, 30);
    expect((settings as HTMLInputElement).value).toBe("30");
    slide(settings, 5);
    expect((header as HTMLInputElement).value).toBe("5");
  });

  it("よく使う値のボタンで選べて、いま選んでいる値が分かる", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(document.getElementById("btn_glass_safe")!);
    expect(html().dataset.glass).toBe("veil");
    expect(html().style.getPropertyValue("--glass-t")).toBe(String(GLASS_SAFE_MAX));
    expect(document.getElementById("btn_glass_safe")!.getAttribute("aria-pressed")).toBe("true");
    expect(document.getElementById("btn_glass_off")!.getAttribute("aria-pressed")).toBe("false");
    expect((screen.getByRole("slider", { name: "透明度" }) as HTMLInputElement).value).toBe(String(GLASS_SAFE_MAX));
    await user.click(document.getElementById("btn_glass_off")!);
    expect(html().dataset.glass).toBe("off");
  });

  it("前に4段階で選んでいた人は、そのときの見え方から始まる", () => {
    localStorage.setItem(GLASS_KEY, "strong");
    renderSettings();
    expect((screen.getByRole("slider", { name: "透明度" }) as HTMLInputElement).value).toBe("18");
  });

  it("読み上げには、どこから読みにくくなるのかも伝える", () => {
    renderSettings();
    const slider = screen.getByRole("slider", { name: "透明度" });
    slide(slider, GLASS_SAFE_MAX);
    expect(slider.getAttribute("aria-valuetext")).toContain("読みやすさを保つ範囲");
    slide(slider, GLASS_SAFE_MAX + 1);
    expect(slider.getAttribute("aria-valuetext")).toContain("読みにくくなります");
  });

  /**
   * 18%より上は、読みやすさを測って保証できない
   * （背後の色がそのまま文字の地に混ざるため）。
   * 黙って選ばせると「急に読めなくなった」としか分からないので、選んだら伝える。
   */
  it("18%より透かしているときだけ、読みにくくなり得ることを伝える", () => {
    renderSettings();
    const slider = screen.getByRole("slider", { name: "透明度" });
    for (const v of [0, 10, GLASS_SAFE_MAX]) {
      slide(slider, v);
      expect(document.getElementById("glass_clear_note"), String(v)).toBeNull();
    }
    slide(slider, GLASS_SAFE_MAX + 1);
    expect(document.getElementById("glass_clear_note")).toBeTruthy();
    act(() => setGlass(100));
    expect(document.getElementById("glass_clear_note")).toBeTruthy();
    flushGlassSave();
  });
});

describe("ガラスにする面", () => {
  /**
   * 印が付いていないと、設定を変えても見た目が変わらない。
   * 対象は「ボタン一覧の台」「レベルのカード」と、その中の塗りつぶしボタン。
   */
  it("学習の設定（レベル・問題数・開始）の台に印が付く", () => {
    renderDashboard();
    expect(screen.getByTestId("question_count_picker").className).toContain("glass-panel");
    expect(document.getElementById("level_selection_section")!.className).toContain("glass-panel");
  });

  it("塗りつぶしのボタン（学習を始める）に印が付く", () => {
    renderDashboard();
    expect(document.getElementById("btn_junior_word")!.className).toContain("glass-chip");
  });

  it("問題数の切り替えは塗りつぶさないので、選んでいるものにも印を付けない", () => {
    // 選んでいる問題数は白く浮かせるだけにした（開始ボタンと塗りつぶしが2つ並ばないように）
    renderDashboard();
    const picked = document.querySelector('[data-testid="count_picker"] button[aria-pressed="true"]');
    expect(picked!.className).not.toContain("glass-chip");
  });

  it("枠だけのボタンには印を付けない（地の色を塗りつぶしに変えてしまうため）", () => {
    renderDashboard();
    const notPicked = document.querySelector('[data-testid="count_picker"] button[aria-pressed="false"]');
    expect(notPicked!.className).not.toContain("glass-chip");
    expect(document.getElementById("btn_junior_sentence")!.className).not.toContain("glass-chip");
  });
});
