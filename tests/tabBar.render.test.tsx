import type { ComponentProps } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TabBar from "../src/components/TabBar";
import MenuScreen from "../src/components/MenuScreen";

/**
 * 画面下のタブと、タブの「メニュー」。
 *
 * 入口が5か所（ヘッダーのアイコン・ハンバーガー・ダッシュボードのタブ・学習メニューの
 * 折りたたみ・レベルのカード）に散らばっていたのを、画面下の5つのタブにまとめた。
 */

function renderTabs(props: Partial<ComponentProps<typeof TabBar>> = {}) {
  const all: ComponentProps<typeof TabBar> = {
    active: "today",
    onSelect: vi.fn(),
    dueCount: 0,
    bonusClaimable: false,
    ...props
  };
  render(<TabBar {...all} />);
  return all;
}

describe("画面下のタブ", () => {
  it("5つの行き先を並べ、いまの画面に印を付ける", () => {
    renderTabs({ active: "learn" });
    const nav = screen.getByRole("navigation", { name: "メイン" });
    const labels = Array.from(nav.querySelectorAll("button")).map(b => b.textContent);
    expect(labels).toEqual(["今日", "調べる", "教材", "記録", "メニュー"]);
    expect(document.getElementById("tab_learn")).toHaveAttribute("aria-current", "page");
    expect(document.getElementById("tab_today")).not.toHaveAttribute("aria-current");
  });

  it("押すとそのタブを伝える", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderTabs();
    await user.click(document.getElementById("tab_records")!);
    expect(onSelect).toHaveBeenCalledWith("records");
  });

  it("復習があれば「今日」に語数を出す（開かなくても気づける）", () => {
    renderTabs({ dueCount: 12 });
    expect(screen.getByTestId("tab_badge_today")).toHaveTextContent("12");
    expect(document.getElementById("tab_today")).toHaveAccessibleName("今日（復習 12語）");
  });

  it("ログインボーナスを受け取れる日は「記録」に印を出す", () => {
    renderTabs({ bonusClaimable: true });
    expect(screen.getByTestId("tab_badge_records")).toBeInTheDocument();
    expect(screen.queryByTestId("tab_badge_today")).toBeNull();
  });

  it("指で押せる高さがある", () => {
    renderTabs();
    for (const b of screen.getByRole("navigation", { name: "メイン" }).querySelectorAll("button")) {
      expect(b.className).toContain("min-h-16");
    }
  });
});

describe("メニュー", () => {
  function renderMenu(props: Partial<ComponentProps<typeof MenuScreen>> = {}) {
    const all: ComponentProps<typeof MenuScreen> = {
      isDark: false,
      onToggleTheme: vi.fn(),
      bgMotion: true,
      onToggleBgMotion: vi.fn(),
      availablePoints: 2550,
      onNavigate: vi.fn(),
      ...props
    };
    render(<MenuScreen {...all} />);
    return all;
  }

  it("ハンバーガーとフッターにあったものへ移れる", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderMenu();
    const pairs: [string, string][] = [
      ["nav_background_btn", "background"],
      ["nav_settings_btn", "settings"],
      ["nav_gacha_btn", "gacha"],
      ["btn_about_app", "about"],
      ["btn_privacy", "privacy"],
      ["btn_terms", "terms"]
    ];
    for (const [id, screenName] of pairs) {
      await user.click(document.getElementById(id)!);
      expect(onNavigate, id).toHaveBeenLastCalledWith(screenName);
    }
  });

  it("ガチャで使えるポイントを出す", () => {
    renderMenu();
    expect(screen.getByTestId("menu_points")).toHaveTextContent("2550 P");
  });

  it("テーマと背景の動きを切り替えられ、いまの状態が分かる", async () => {
    const user = userEvent.setup();
    const { onToggleTheme, onToggleBgMotion } = renderMenu({ isDark: true, bgMotion: false });
    expect(document.getElementById("menu_theme_btn")).toHaveAttribute("aria-pressed", "true");
    expect(document.getElementById("nav_bg_motion_btn")).toHaveAttribute("aria-pressed", "false");
    await user.click(document.getElementById("menu_theme_btn")!);
    await user.click(document.getElementById("nav_bg_motion_btn")!);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
    expect(onToggleBgMotion).toHaveBeenCalledTimes(1);
  });

  it("使っているAIを明記する（フッターから移した）", () => {
    renderMenu();
    expect(document.getElementById("menu_credits")).toHaveTextContent("Gemini 3.5 Flash");
  });
});
