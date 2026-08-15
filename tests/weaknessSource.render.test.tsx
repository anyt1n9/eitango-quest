import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../src/components/Dashboard";
import { makeWord, makeStats } from "./fixtures";

/**
 * 弱点分野の自動分析の出どころ表示。
 *
 * この分析は、APIキーが無いときサーバーが 200 でローカル集計を返す
 * （間違えた単語の品詞を数えただけのもの）。画面はそれを AI の分析と
 * まったく同じ見た目で出していたため、利用者には
 * 「AIが自分の学習を読んで書いた分析」に見えていた。
 * アドバイスと同じく、どちらで作った文章かを必ず書く。
 */

const VOCAB = [
  makeWord({ id: "j1", word: "beautiful", level: "junior" }),
  makeWord({ id: "j2", word: "library", level: "junior" })
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
      wrongWords={["j1", "j2"]}
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

const ANALYSIS = {
  summary: "形容詞でつまずいています。",
  partOfSpeechStats: [{ label: "形容詞", count: 2 }],
  topicStats: [],
  recommendations: ["形容詞から復習しましょう。"]
};

/** 分析パネルを開いて「分析する」を押す */
async function runAnalysis(user: ReturnType<typeof userEvent.setup>) {
  renderDashboard();
  await user.click(screen.getByRole("button", { name: /AIアドバイス$/ }));
  await user.click(document.getElementById("btn_get_weakness_analysis")!);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("弱点分析の出どころ表示", () => {
  it("AIが分析したときはそう書く", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ ...ANALYSIS, isFallback: false })
    } as unknown as Response)));

    await runAnalysis(user);

    expect(await screen.findByText("形容詞でつまずいています。")).toBeInTheDocument();
    expect(screen.getByText("Gemini AI が分析しました。")).toBeInTheDocument();
  });

  it("アプリが品詞を数えただけのときは、AIの分析と偽らない", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ ...ANALYSIS, isFallback: true })
    } as unknown as Response)));

    await runAnalysis(user);

    expect(await screen.findByText("形容詞でつまずいています。")).toBeInTheDocument();
    expect(
      screen.getByText("AIキーが未設定のため、アプリが間違えた単語の品詞を数えて組み立てました。")
    ).toBeInTheDocument();
    expect(screen.queryByText("Gemini AI が分析しました。")).toBeNull();
  });

  it("再分析に失敗したら、前回の分析も出どころの札も残さない", async () => {
    const user = userEvent.setup();
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls++;
      if (calls === 1) {
        return { ok: true, json: async () => ({ ...ANALYSIS, isFallback: false }) } as unknown as Response;
      }
      throw new Error("ネットワークに接続できません");
    }));

    await runAnalysis(user);
    expect(await screen.findByText("形容詞でつまずいています。")).toBeInTheDocument();

    await user.click(screen.getByText("最新の間違えた単語で再分析"));

    expect(await screen.findByText("ネットワークに接続できません")).toBeInTheDocument();
    expect(screen.queryByText("形容詞でつまずいています。")).toBeNull();
    expect(document.getElementById("weakness_source")).toBeNull();
  });
});
