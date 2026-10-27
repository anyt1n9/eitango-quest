import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { todayStr } from "../src/srs";

/**
 * 累計の回答数は1つの数え方にする。
 *
 * 学習カレンダーは1問ごとに日別の記録へ足し、「記録」の累計回答数はクイズを最後まで
 * 解いたときにまとめて足していた。途中でやめた問題はカレンダーにだけ入り、
 * 同じ画面に「累計解答 11問」と「累計回答数 10問」が並んでいた。
 * いまは回答数も1問ごとに数える（カレンダー側の累計は出さない）。
 */

vi.mock("../src/vocabulary", () => ({
  loadVocabulary: () => Promise.resolve(WORDS),
  loadedVocabulary: () => null
}));

const word = (id: string, w: string, t: string) => ({
  id, word: w, translation: t, level: "junior",
  sentence: `I like [_____].`, sentenceTranslation: "好きです。",
  pos: "noun", options: [t, "小さい", "重い", "速い"], sentenceOptions: [w, "small", "heavy", "fast"]
});
const WORDS = [
  word("j1", "apple", "りんご"), word("j2", "book", "本"), word("j3", "cat", "猫"),
  word("j4", "desk", "机"), word("j5", "egg", "卵")
];

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, "", "/");
});
afterEach(() => cleanup());

describe("途中でやめたクイズの回答", () => {
  it("答えた問題は、累計回答数と日別の記録の両方に同じだけ入る", async () => {
    const { default: App } = await import("../src/App");
    render(<App />);
    await waitFor(() => expect(document.getElementById("vocabulary_loading_screen")).toBeNull());

    const user = userEvent.setup();
    await user.click(document.getElementById("btn_junior_word")!);
    const options = within(document.getElementById("quiz_options_container")!).getAllByRole("button");
    await user.click(options[0]);
    // 1問だけ答えて中断する
    await user.click(document.getElementById("btn_quit_quiz")!);

    const stats = JSON.parse(localStorage.getItem("quest_stats") || "{}");
    const log = JSON.parse(localStorage.getItem("quest_daily_log") || "{}");
    expect(log[todayStr()].count).toBe(1);
    expect(stats.completedQuestions).toBe(1);
    expect(stats.correctAnswers).toBe(log[todayStr()].correct);
    expect(screen.queryByText("画面の表示中に問題が発生しました")).toBeNull();
  });

  it("最後まで解いても、回答数を二重に足さない（終わったときにまとめて足していた分）", async () => {
    const { default: App } = await import("../src/App");
    render(<App />);
    await waitFor(() => expect(document.getElementById("vocabulary_loading_screen")).toBeNull());

    const user = userEvent.setup();
    await user.click(document.getElementById("btn_junior_word")!);
    // 「重い」はどの語の訳でもないので、選ぶと必ず不正解になり「次へ」を押すまで待つ
    let answered = 0;
    while (document.getElementById("quiz_options_container")) {
      const container = document.getElementById("quiz_options_container")!;
      await user.click(within(container).getByText("重い"));
      answered++;
      await user.click(document.getElementById("btn_next_question")!);
    }
    expect(answered).toBe(WORDS.length);

    const stats = JSON.parse(localStorage.getItem("quest_stats") || "{}");
    const log = JSON.parse(localStorage.getItem("quest_daily_log") || "{}");
    expect(stats.completedQuestions).toBe(WORDS.length);
    expect(log[todayStr()].count).toBe(WORDS.length);
    expect(stats.correctAnswers).toBe(0);
  });
});
