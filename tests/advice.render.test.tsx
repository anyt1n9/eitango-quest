import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../src/components/Dashboard";
import { makeWord, makeStats } from "./fixtures";

/**
 * ダッシュボードの学習アドバイス。
 *
 * 「どこで作った文章か」を画面に出すようにしたが、
 * 再分析に失敗したときに前回の結果が残ると、
 * 更新されていない古い文章に「Gemini AI が生成しました」の札が付いたまま見える。
 * 出どころを偽らないための表示が、かえって誤解を生むことになる。
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

/** 1回目は成功、2回目は失敗する fetch */
function mockFetchOnceThenFail(advice: string, source: "ai" | "local") {
  let calls = 0;
  return vi.fn(async () => {
    calls++;
    if (calls === 1) {
      return { ok: true, json: async () => ({ advice, source }) } as unknown as Response;
    }
    throw new Error("ネットワークに接続できません");
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("アドバイスの出どころ表示", () => {
  it("AIが生成したときはそう書く", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ advice: "### 今の学習状況\n\n順調です。", source: "ai" })
    } as unknown as Response)));

    renderDashboard();
    await user.click(screen.getByRole("button", { name: /AIアドバイス$/ }));
    await user.click(document.getElementById("btn_get_advice")!);

    expect(await screen.findByText("Gemini AI が生成しました。")).toBeInTheDocument();
  });

  it("アプリが組み立てたときはそう書く", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ advice: "### 今の学習状況\n\n出発点です。", source: "local" })
    } as unknown as Response)));

    renderDashboard();
    await user.click(screen.getByRole("button", { name: /AIアドバイス$/ }));
    await user.click(document.getElementById("btn_get_advice")!);

    expect(
      await screen.findByText("AIキーが未設定のため、アプリが学習記録から組み立てました。")
    ).toBeInTheDocument();
  });

  it("再分析に失敗したら、前回の文章も出どころの札も残さない", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", mockFetchOnceThenFail("### 今の学習状況\n\n前回のアドバイスです。", "ai"));

    renderDashboard();
    await user.click(screen.getByRole("button", { name: /AIアドバイス$/ }));
    await user.click(document.getElementById("btn_get_advice")!);
    expect(await screen.findByText("前回のアドバイスです。")).toBeInTheDocument();
    expect(screen.getByText("Gemini AI が生成しました。")).toBeInTheDocument();

    // 「最新の回答進捗で再分析」が失敗する
    await user.click(screen.getByText("最新の回答進捗で再分析"));

    expect(await screen.findByText("ネットワークに接続できません")).toBeInTheDocument();
    // 更新されていない文章に「AIが生成しました」が付いたまま残らない
    expect(screen.queryByText("前回のアドバイスです。")).toBeNull();
    expect(screen.queryByText("Gemini AI が生成しました。")).toBeNull();
    expect(screen.queryByTestId("advice_source")).toBeNull();
  });
});
