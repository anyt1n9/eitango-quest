import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Quiz from "../src/components/Quiz";
import { makeWord, makeWords } from "./fixtures";

/**
 * クイズ画面の描画。
 *
 * ここまでのテストは副作用の無い関数だけを見ていたので、
 * 「関数は正しいが画面には出ていない」「日→英モードで答えが見えている」
 * といった不具合は型検査もビルドもすり抜けてしまう。
 * 出題文・選択肢・回答後の見え方という、学習者が実際に目にする部分を固定する。
 */

function renderQuiz(props: Partial<ComponentProps<typeof Quiz>> = {}) {
  const recordAnswer = vi.fn();
  const setWrongWords = vi.fn();
  const setSolvedHistory = vi.fn();
  const setStats = vi.fn();
  const onBackToDashboard = vi.fn();
  const updateRankingScore = vi.fn();
  const word = makeWord();

  render(
    <Quiz
      level="junior"
      vocabulary={[word]}
      customWords={[word]}
      questionCount={1}
      wrongWords={[]}
      setWrongWords={setWrongWords}
      solvedHistory={{}}
      setSolvedHistory={setSolvedHistory}
      setStats={setStats}
      onBackToDashboard={onBackToDashboard}
      updateRankingScore={updateRankingScore}
      recordAnswer={recordAnswer}
      {...props}
    />
  );

  return { recordAnswer, setWrongWords, setStats, updateRankingScore, onBackToDashboard, word };
}

/** 4択ボタンだけを取り出す（発音ボタンなどを含めないため） */
function optionButtons() {
  const container = document.getElementById("quiz_options_container")!;
  return within(container).getAllByRole("button");
}

/** 選択肢の文言だけを取り出す（ボタンには番号の飾りも入っているため） */
function optionLabels() {
  return optionButtons().map(
    b => within(b).getByTestId("option_label").textContent
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("英→日モード（既定）", () => {
  it("英単語を出題し、日本語訳の4択を並べる", () => {
    renderQuiz();
    expect(screen.getByRole("heading", { name: "beautiful" })).toBeInTheDocument();
    expect(screen.getByText("英単語の意味を選択")).toBeInTheDocument();
    const labels = optionLabels();
    expect(labels).toHaveLength(4);
    expect(labels.join("")).toContain("美しい");
    // 選択肢に英単語が混ざっていない
    expect(labels.join("")).not.toContain("beautiful");
  });

  it("出題時に英単語を読み上げる", () => {
    renderQuiz();
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });
});

describe("日→英モード", () => {
  it("日本語を出題し、英単語の4択を並べる", () => {
    renderQuiz({ reverseMode: true });
    expect(screen.getByRole("heading", { name: "美しい" })).toBeInTheDocument();
    expect(screen.getByText("日本語に合う英単語を選択")).toBeInTheDocument();
    const labels = optionLabels();
    expect(labels).toHaveLength(4);
    expect(labels).toContain("beautiful");
  });

  it("回答前に綴りを見せない（答えの露出を防ぐ）", () => {
    renderQuiz({ reverseMode: true });
    // 選択肢の中に beautiful があるのは正しいので、出題文の側だけを見る
    const heading = screen.getByRole("heading");
    expect(heading).toHaveTextContent("美しい");
    expect(heading).not.toHaveTextContent("beautiful");
    // 選択肢の外（出題文・発音記号など）にも出さない
    const card = document.getElementById("quiz_running_card")!.textContent!;
    const options = document.getElementById("quiz_options_container")!.textContent!;
    expect(card.replace(options, "")).not.toMatch(/beautiful/);
  });

  it("答えである英単語を読み上げない", () => {
    renderQuiz({ reverseMode: true });
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it("正解の判定は英単語の綴りで行う", async () => {
    const user = userEvent.setup();
    const { recordAnswer } = renderQuiz({ reverseMode: true });
    await user.click(optionButtons()[optionLabels().indexOf("beautiful")]);
    expect(recordAnswer).toHaveBeenCalledWith("w_beautiful", true);
  });
});

describe("リスニングモード", () => {
  it("綴りを隠し、再生ボタンだけを見せる", () => {
    renderQuiz({ listeningMode: true });
    expect(screen.queryByRole("heading", { name: "beautiful" })).toBeNull();
    expect(document.getElementById("listening_replay_btn")).toBeInTheDocument();
    expect(screen.getByText("🎧 音声を聞いて意味を選択")).toBeInTheDocument();
  });

  it("再生ボタンで読み上げ直せる", async () => {
    const user = userEvent.setup();
    renderQuiz({ listeningMode: true });
    vi.mocked(window.speechSynthesis.speak).mockClear();
    await user.click(document.getElementById("listening_replay_btn")!);
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });
});

describe("回答したとき", () => {
  it("正解なら苦手単語に入れない", async () => {
    const user = userEvent.setup();
    const { recordAnswer, setWrongWords } = renderQuiz();
    await user.click(optionButtons().find(b => b.textContent?.includes("美しい"))!);
    expect(recordAnswer).toHaveBeenCalledWith("w_beautiful", true);
    expect(setWrongWords).not.toHaveBeenCalled();
  });

  it("誤答なら苦手単語に加え、正解を見せる", async () => {
    const user = userEvent.setup();
    const { recordAnswer, setWrongWords } = renderQuiz();
    await user.click(optionButtons().find(b => b.textContent?.includes("重い"))!);
    expect(recordAnswer).toHaveBeenCalledWith("w_beautiful", false);
    expect(setWrongWords).toHaveBeenCalled();
    // 覚え直せるよう、正解の単語と訳を必ず出す（読み上げにも伝える）
    expect(screen.getByRole("status")).toHaveTextContent("不正解です。正解は「美しい」（beautiful）");
    expect(document.getElementById("answer_feedback")).toHaveTextContent("beautiful");
    expect(document.getElementById("btn_next_question")).toHaveTextContent("結果を見る");
  });

  it("誤答のあとは選択肢を見せたまま、正解と自分の答えに印を付ける", async () => {
    // 以前はカード全体を大きな×でぼかして覆い、見比べられなかった
    const user = userEvent.setup();
    renderQuiz();
    await user.click(optionButtons().find(b => b.textContent?.includes("重い"))!);
    const right = optionButtons().find(b => b.textContent?.includes("美しい"))!;
    const mine = optionButtons().find(b => b.textContent?.includes("重い"))!;
    expect(right.className).toContain("border-emerald-400");
    expect(mine.className).toContain("border-rose-300");
    expect(right).toBeVisible();
  });

  it("誤答のあとは、押すまで次へ進まない（読み終える前に消さない）", async () => {
    vi.useFakeTimers();
    try {
      const words = makeWords(3);
      const { setStats } = renderQuiz({ vocabulary: words, customWords: words, questionCount: 3 });
      const q = screen.getByRole("heading").textContent!;
      const correct = words.find(w => w.word === q)!.translation;
      fireEvent.click(optionButtons()[optionLabels().findIndex(l => l !== correct)]);
      act(() => { vi.advanceTimersByTime(60_000); });
      expect(screen.getByText("Q: 1 / 3")).toBeInTheDocument();
      fireEvent.click(document.getElementById("btn_next_question")!);
      expect(screen.getByText("Q: 2 / 3")).toBeInTheDocument();
      expect(setStats).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("正解のときは少しで自動で次へ進む", () => {
    vi.useFakeTimers();
    try {
      const words = makeWords(3);
      renderQuiz({ vocabulary: words, customWords: words, questionCount: 3 });
      const q = screen.getByRole("heading").textContent!;
      const correct = words.find(w => w.word === q)!.translation;
      fireEvent.click(optionButtons()[optionLabels().indexOf(correct)]);
      expect(document.getElementById("btn_next_question")).toBeNull();
      act(() => { vi.advanceTimersByTime(1300); });
      expect(screen.getByText("Q: 2 / 3")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("「次の問題へ」を2回続けて押しても、1問しか進まない", () => {
    const words = makeWords(3);
    renderQuiz({ vocabulary: words, customWords: words, questionCount: 3 });
    const q = screen.getByRole("heading").textContent!;
    const correct = words.find(w => w.word === q)!.translation;
    fireEvent.click(optionButtons()[optionLabels().findIndex(l => l !== correct)]);
    const next = document.getElementById("btn_next_question")!;
    act(() => { next.click(); next.click(); });
    expect(screen.getByText("Q: 2 / 3")).toBeInTheDocument();
  });

  it("二重に回答できない", async () => {
    const user = userEvent.setup();
    const { recordAnswer } = renderQuiz();
    const buttons = optionButtons();
    await user.click(buttons.find(b => b.textContent?.includes("美しい"))!);
    expect(recordAnswer).toHaveBeenCalledTimes(1);
    for (const b of optionButtons()) expect(b).toBeDisabled();
    await user.click(optionButtons()[1]);
    expect(recordAnswer).toHaveBeenCalledTimes(1);
  });
});

describe("進行", () => {
  it("問題数を指定した分だけ出題する", () => {
    const words = makeWords(20);
    renderQuiz({ vocabulary: words, customWords: words, questionCount: 5 });
    expect(screen.getByText("Q: 1 / 5")).toBeInTheDocument();
  });

  it("中断ボタンでダッシュボードへ戻れる", async () => {
    const user = userEvent.setup();
    const { onBackToDashboard } = renderQuiz();
    await user.click(screen.getByText("中断して戻る"));
    expect(onBackToDashboard).toHaveBeenCalled();
  });

  it("出題できる単語が無ければ読み込み表示のままにする", () => {
    renderQuiz({ vocabulary: [], customWords: [] });
    expect(screen.getByText("英単語クイズの準備をしています...")).toBeInTheDocument();
    expect(document.getElementById("quiz_options_container")).toBeNull();
  });
});

describe("キーボードで解く", () => {
  it("数字キーで選択肢を選べる", async () => {
    // パソコンで解くとき、毎問マウスへ手を移すことになっていた
    const user = userEvent.setup();
    const { recordAnswer } = renderQuiz();
    const labels = optionLabels();
    const correctAt = labels.indexOf("美しい");
    expect(correctAt).toBeGreaterThanOrEqual(0);
    await user.keyboard(String(correctAt + 1));
    expect(recordAnswer).toHaveBeenCalledWith("w_beautiful", true);
  });

  it("選択肢の数を超える番号では何も起きない", async () => {
    const user = userEvent.setup();
    const { recordAnswer } = renderQuiz();
    await user.keyboard("9");
    expect(recordAnswer).not.toHaveBeenCalled();
  });

  it("一度答えたら、番号を押しても二重に記録しない", async () => {
    const user = userEvent.setup();
    const { recordAnswer } = renderQuiz();
    await user.keyboard("1");
    await user.keyboard("2");
    expect(recordAnswer).toHaveBeenCalledTimes(1);
  });

  it("選択肢に番号を表示する", () => {
    // 押せることが見えていなければ使われない
    renderQuiz();
    const first = optionButtons()[0];
    expect(first).toHaveTextContent("1");
  });
});
