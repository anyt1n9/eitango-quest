import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";

/**
 * 開いたまま日をまたいだとき（App の useToday）。
 *
 * ホーム画面から開くとアプリは何日も閉じない。以前は描くたびに todayStr() を呼ぶだけで、
 * 日付が変わったことを知らせる仕組みが無かったので、0時を過ぎても何か操作するまで
 * 「今日」の画面に前の日の日付・「達成！」・復習の数が残り、ログインボーナスも
 * 受け取り済みに見えたままだった。
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

function seed() {
  localStorage.clear();
  // 11月5日に、ボーナスを受け取り、目標の20問を解き終えた。apple の復習は翌日
  localStorage.setItem("quest_stats", JSON.stringify({
    score: 300, currentStreak: 2, lastLoginDate: "2026-11-05", completedQuestions: 20, correctAnswers: 18,
  }));
  localStorage.setItem("quest_daily_goal", "20");
  localStorage.setItem("quest_daily_progress", JSON.stringify({ date: "2026-11-05", count: 20 }));
  localStorage.setItem("quest_srs", JSON.stringify({
    j1: { box: 1, dueDate: "2026-11-06", lastReview: "2026-11-05", reps: 1, lapses: 0 },
  }));
}

async function renderApp() {
  const { default: App } = await import("../src/App");
  render(<App />);
  await waitFor(() => expect(document.getElementById("vocabulary_loading_screen")).toBeNull());
}

const text = (id: string) => document.getElementById(id)?.textContent ?? "";

function expectNov5() {
  expect(text("today_date")).toBe("11月5日（木）");
  expect(text("today_goal_count")).toContain("達成");
  expect(document.getElementById("today_review_card")).toBeNull();
  expect(text("next_review_text")).toContain("明日に1語");
  expect(screen.queryByTestId("tab_badge_records"), "受け取り済みなのに印が出ている").toBeNull();
}

function expectNov6() {
  expect(text("today_date")).toBe("11月6日（金）");
  expect(text("today_goal_count")).toContain("目標 0 / 20問");
  // 前の日に「明日」と言っていた復習が、今日の復習として出る
  expect(document.getElementById("today_review_card")).not.toBeNull();
  expect(screen.queryByTestId("tab_badge_today")?.textContent).toBe("1");
  // 新しい日のログインボーナスを受け取れる
  expect(screen.queryByTestId("tab_badge_records")?.textContent).toBe("!");
  // 前の日（11月5日）に受け取っているので、連続ログインは途切れていない（日をまたいだときの巻き戻しで0にしない）
  expect(screen.getByLabelText("ログイン連続 2日")).toBeTruthy();
}

beforeEach(() => {
  seed();
  window.history.pushState({}, "", "/");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("開いたまま日をまたいだとき", () => {
  it("0時を過ぎたら、操作しなくても「今日」を次の日に切り替える", async () => {
    vi.setSystemTime(new Date(2026, 10, 5, 23, 59, 0));
    await renderApp();
    // 起動直後の時計（海の3D背景の読み込みなど）を先に済ませる。0時をまたぐ間に鳴ると、
    // そのついでの描き直しで日付が変わったように見え、0時の時計が無くても通ってしまう
    await act(async () => { vi.advanceTimersByTime(3000); });
    expectNov5();

    await act(async () => { vi.advanceTimersByTime(60_000); });
    expectNov6();
  });

  it("裏に回っていて0時の時計が鳴らなかったときも、画面に戻ったときに切り替える", async () => {
    vi.setSystemTime(new Date(2026, 10, 5, 22, 0, 0));
    await renderApp();
    expectNov5();

    // 端末が眠っているあいだに朝になった（時計だけが進み、0時の時計はまだ鳴っていない）
    vi.setSystemTime(new Date(2026, 10, 6, 7, 30, 0));
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expectNov6();
  });
});
