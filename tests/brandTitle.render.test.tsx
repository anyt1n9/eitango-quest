import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Dashboard from "../src/components/Dashboard";
import { makeWord, makeStats } from "./fixtures";

/**
 * アプリの名前と、そのうしろに置く2つのしるし。
 *
 * 「エイゴリラ」は英語＋ゴリラ、そしてエイの掛けことばで、
 * 名前だけでは由来が伝わらない。しるしはその説明にあたるので、
 * 名前を変えたときに片方だけ直して食い違うことがないよう固定する。
 *
 * しるしは飾りなので読み上げには渡さない（名前は文字で読めている）。
 */

const VOCAB = [makeWord({ id: "j1", word: "beautiful", level: "junior" })];

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

describe("アプリの名前", () => {
  it("見出しは「エイゴリラ」", () => {
    renderDashboard();
    expect(screen.getByRole("heading", { name: /エイゴリラ/ })).toBeInTheDocument();
  });

  it("古い名前が残っていない", () => {
    renderDashboard();
    expect(document.body.textContent).not.toMatch(/英単語 ?Quest/);
    // 冒険の要素は無いので、機能の呼び名からも Quest を外した
    expect(document.body.textContent).not.toMatch(/読破 Quest/);
  });

  it("名前のうしろにエイとゴリラのしるしを2つ置く", () => {
    renderDashboard();
    const icons = within(document.getElementById("app_title")!).getByTestId("brand_icons");
    expect(icons.querySelectorAll("svg")).toHaveLength(2);
  });

  it("しるしは飾りなので読み上げには渡さない", () => {
    renderDashboard();
    expect(screen.getByTestId("brand_icons")).toHaveAttribute("aria-hidden", "true");
  });
});
