import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BackgroundSettings from "../src/components/BackgroundSettings";
import Dashboard from "../src/components/Dashboard";
import { GLASS_CHOICES } from "../src/glass";
import { makeWord, makeStats } from "./fixtures";

/**
 * カードとボタンの透明感（ガラス）の画面まわり。
 *
 * 濃さそのものは CSS（`:root[data-glass]`）が持ち、明暗どちらのテーマでも
 * 読めるかは e2e が実際のブラウザで測る。ここでは
 *   - 3段階から選べること
 *   - ガラスにする面へ印（クラス）が付いていること
 * を見る。印が外れると、設定を変えても何も起きないのに気づけない。
 */

function renderSettings(glass: "off" | "light" | "strong" = "off") {
  const onGlassChange = vi.fn();
  render(
    <BackgroundSettings
      image={null}
      onChange={vi.fn()}
      veil="normal"
      onVeilChange={vi.fn()}
      glass={glass}
      onGlassChange={onGlassChange}
      onBack={vi.fn()}
    />
  );
  return { onGlassChange };
}

const VOCAB = [
  makeWord({ id: "j1", word: "beautiful", level: "junior" }),
  makeWord({ id: "j2", word: "quiet", level: "junior" })
];

function renderDashboard() {
  render(
    <Dashboard
      stats={makeStats()}
      setStats={vi.fn()}
      vocabulary={VOCAB}
      setVocabulary={vi.fn()}
      solvedHistory={{}}
      srsData={{}}
      wrongWords={[]}
      onStartQuiz={vi.fn()}
      onStartReview={vi.fn()}
      onOpenDictionary={vi.fn()}
      onStartReading={vi.fn()}
      onOpenDiary={vi.fn()}
      onOpenVerbForms={vi.fn()}
      onOpenGrammar={vi.fn()}
      ranking={[{ id: "me_id", name: "You", score: 0, avatar: "🏆", isMe: true }]}
      setRanking={vi.fn()}
      dailyLog={{}}
      dailyGoal={20}
      equipped={{}}
      onOpenGachaShop={vi.fn()}
      dueCount={0}
      onStartSrsReview={vi.fn()}
    />
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("透明感を選ぶ", () => {
  it("画像を選んでいなくても選べる（はじめからの飾りが背後にあるため）", () => {
    renderSettings();
    expect(screen.getByTestId("glass_picker")).toBeTruthy();
    for (const c of GLASS_CHOICES) {
      expect(document.getElementById(`btn_glass_${c.level}`), c.level).toBeTruthy();
    }
  });

  it("いま選んでいる段階が分かる", () => {
    renderSettings("strong");
    expect(document.getElementById("btn_glass_strong")!.getAttribute("aria-pressed")).toBe("true");
    expect(document.getElementById("btn_glass_off")!.getAttribute("aria-pressed")).toBe("false");
  });

  it("押すとその段階を伝える", async () => {
    const user = userEvent.setup();
    const { onGlassChange } = renderSettings();
    await user.click(document.getElementById("btn_glass_light")!);
    expect(onGlassChange).toHaveBeenCalledWith("light");
  });
});

describe("ガラスにする面", () => {
  /**
   * 印が付いていないと、設定を変えても見た目が変わらない。
   * 対象は「ボタン一覧の台」「レベルのカード」と、その中の塗りつぶしボタン。
   */
  it("ボタン一覧の台とレベルのカードに印が付く", () => {
    renderDashboard();
    expect(screen.getByTestId("question_count_picker").className).toContain("glass-panel");
    expect(document.getElementById("level_selection_section")!.className).toContain("glass-panel");
  });

  it("塗りつぶしのボタンに印が付く（一問一答・選んでいるレベル・選んでいる問題数）", () => {
    renderDashboard();
    expect(document.getElementById("btn_junior_word")!.className).toContain("glass-chip");
    expect(document.getElementById("btn_level_junior")!.className).toContain("glass-chip");
    const count = document.querySelector('[data-testid="count_picker"] button[aria-pressed="true"]');
    expect(count!.className).toContain("glass-chip");
  });
});
