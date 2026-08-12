import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
    // 発音記号も答えの手がかりになるので出さない
    expect(document.querySelector("#quiz_running_card .font-mono")?.textContent)
      .not.toMatch(/beautiful/);
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
    // 覚え直せるよう、正解の単語と訳を必ず出す
    expect(screen.getByText("正解の単語 ＆ 日本語訳")).toBeInTheDocument();
    expect(screen.getByText("すぐに次に進む")).toBeInTheDocument();
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
