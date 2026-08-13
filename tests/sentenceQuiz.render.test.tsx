import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SentenceQuiz from "../src/components/SentenceQuiz";
import { makeWord } from "./fixtures";
import { Word } from "../src/types";

/**
 * 例文穴埋めクイズの描画。
 *
 * 毎日使う出題画面なのに、四択（Quiz）だけがテストで守られていた。
 * この画面には「答えを見せてはいけない」という不変条件があり、
 * 型検査でもロジックのテストでも見つからない：
 *   - 穴埋め箇所に答えの綴りがそのまま残る
 *   - 例文に [_____] が無いデータで、本文に答えが出たままになる
 *   - 和訳のヒントを開く前から答えが読める
 * 解答の受け付け（二重回答・出題の作り直し）もここで固定する。
 */

function renderQuiz(
  words: Word[] = [makeWord()],
  props: Partial<ComponentProps<typeof SentenceQuiz>> = {}
) {
  const recordAnswer = vi.fn();
  const setWrongWords = vi.fn();
  const setSolvedHistory = vi.fn();
  const setStats = vi.fn();
  const onBackToDashboard = vi.fn();
  const updateRankingScore = vi.fn();

  const view = render(
    <SentenceQuiz
      level="junior"
      vocabulary={words}
      customWords={words}
      questionCount={words.length}
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

  return { view, recordAnswer, setWrongWords, setStats, updateRankingScore, onBackToDashboard };
}

/** 4択ボタン */
function optionButtons() {
  const grid = document.getElementById("sentence_quiz_options_grid")!;
  return within(grid).getAllByRole("button");
}

function optionLabels() {
  return optionButtons().map(b => b.textContent);
}

/** 出題カードに出ている文字すべて（フィードバックの重なりを含めない） */
function questionText() {
  return document.getElementById("sentence_quiz_running_card")!.textContent || "";
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("出題", () => {
  it("穴埋めの例文と、英単語の4択を並べる", () => {
    renderQuiz();
    expect(screen.getByText("穴埋めに当てはまる英単語を選択")).toBeInTheDocument();
    expect(questionText()).toContain("The garden is very");
    expect(questionText()).toContain("in spring.");
    expect(optionLabels().sort()).toEqual(["beautiful", "careful", "peaceful", "powerful"]);
  });

  it("答えの綴りは、選択肢の外には出さない", () => {
    renderQuiz();
    // 穴は伏せ字のまま
    expect(questionText()).toContain("_____");
    // 4択を取り除くと、答えはどこにも残らない
    const grid = document.getElementById("sentence_quiz_options_grid")!;
    const withoutOptions = questionText().replace(grid.textContent || "", "");
    expect(withoutOptions).not.toContain("beautiful");
  });

  it("例文に穴が無いデータでも、答えを本文に残さない", () => {
    // 収録データには [_____] を含まない例文もある。
    // そのまま出すと本文に答えが出てしまい、穴埋めとして成立しない
    renderQuiz([
      makeWord({ sentence: "The garden is very beautiful in spring." })
    ]);
    const grid = document.getElementById("sentence_quiz_options_grid")!;
    const withoutOptions = questionText().replace(grid.textContent || "", "");
    expect(withoutOptions).toContain("_____");
    expect(withoutOptions).not.toContain("beautiful");
  });

  it("例文が空でも、穴のある文を出す", () => {
    renderQuiz([makeWord({ sentence: "" })]);
    expect(questionText()).toContain("_____");
  });

  it("和訳は押すまで出さない", () => {
    renderQuiz();
    expect(screen.queryByText(/その庭は春に/)).not.toBeInTheDocument();
    expect(screen.getByText("日本語訳のヒントをみる")).toBeInTheDocument();
  });

  it("和訳のヒントを押すと出る", async () => {
    const user = userEvent.setup();
    renderQuiz();
    await user.click(screen.getByText("日本語訳のヒントをみる"));
    expect(screen.getByText(/その庭は春にとても美しい。/)).toBeInTheDocument();
  });

  it("例文を読み上げる（穴は something に置き換える）", () => {
    renderQuiz();
    const spoken = (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(spoken.text).toContain("something");
    expect(spoken.text).not.toContain("_____");
  });
});

describe("解答", () => {
  it("正解を選ぶと、正誤が読み上げにも伝わる", async () => {
    const user = userEvent.setup();
    const { recordAnswer } = renderQuiz();
    await user.click(screen.getByRole("button", { name: "beautiful" }));

    const status = document.querySelector('[role="status"]')!;
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status.textContent).toContain("正解です");
    expect(recordAnswer).toHaveBeenCalledWith("w_beautiful", true);
  });

  it("不正解のときは、正解の綴りと意味を読み上げに伝える", async () => {
    const user = userEvent.setup();
    const { recordAnswer, setWrongWords } = renderQuiz();
    await user.click(screen.getByRole("button", { name: "careful" }));

    const status = document.querySelector('[role="status"]')!;
    expect(status.textContent).toContain("不正解");
    expect(status.textContent).toContain("beautiful");
    expect(status.textContent).toContain("美しい");
    expect(recordAnswer).toHaveBeenCalledWith("w_beautiful", false);
    expect(setWrongWords).toHaveBeenCalled();
  });

  it("大文字小文字が違っても正解にする", async () => {
    const user = userEvent.setup();
    const { recordAnswer } = renderQuiz([
      makeWord({ word: "Beautiful", sentenceOptions: ["beautiful", "careful", "powerful", "peaceful"] })
    ]);
    await user.click(screen.getByRole("button", { name: "beautiful" }));
    expect(recordAnswer).toHaveBeenCalledWith("w_beautiful", true);
  });

  it("一度答えたら選び直せない", async () => {
    const user = userEvent.setup();
    const { recordAnswer } = renderQuiz();
    await user.click(screen.getByRole("button", { name: "careful" }));
    for (const b of optionButtons()) expect(b).toBeDisabled();
    // 押しても2回目は記録されない
    await user.click(screen.getByRole("button", { name: "beautiful" }));
    expect(recordAnswer).toHaveBeenCalledTimes(1);
  });

  it("選んだ語を穴に入れて見せる", async () => {
    const user = userEvent.setup();
    renderQuiz();
    await user.click(screen.getByRole("button", { name: "careful" }));
    const hole = document.getElementById("sentence_quiz_running_card")!;
    expect(within(hole).getAllByText("careful").length).toBeGreaterThan(1);
  });
});

describe("出題のやり直し", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("同じ内容の配列を渡し直しても、出題し直さない", () => {
    // 呼び出し側は毎レンダーで配列を作り直す。
    // 同一性で見ると解答の途中で問題がすり替わる
    vi.useFakeTimers();
    const words = [
      makeWord({ id: "a", word: "alpha", sentenceOptions: ["alpha", "x1", "x2", "x3"] }),
      makeWord({ id: "b", word: "bravo", sentenceOptions: ["bravo", "y1", "y2", "y3"] })
    ];
    const { view } = renderQuiz(words);
    expect(screen.getByText("Q: 1 / 2")).toBeInTheDocument();

    // 1問目に答えて2問目へ進める（不正解でも6秒で自動で進む）
    fireEvent.click(optionButtons()[0]);
    act(() => { vi.advanceTimersByTime(6500); });
    expect(screen.getByText("Q: 2 / 2")).toBeInTheDocument();

    // 中身が同じ新しい配列を渡す（呼び出し側の再レンダー相当）
    view.rerender(
      <SentenceQuiz
        level="junior"
        vocabulary={[...words]}
        customWords={words.map(w => ({ ...w }))}
        questionCount={2}
        wrongWords={[]}
        setWrongWords={vi.fn()}
        solvedHistory={{}}
        setSolvedHistory={vi.fn()}
        setStats={vi.fn()}
        onBackToDashboard={vi.fn()}
        updateRankingScore={vi.fn()}
      />
    );
    expect(screen.getByText("Q: 2 / 2"), "2問目のまま").toBeInTheDocument();
  });

  it("違う単語を渡したら、その単語で出し直す", () => {
    // 「同一性で見ない」を取り違えて中身も見なくなると、
    // 復習の対象を変えても前の単語が出続けることになる
    const words = [
      makeWord({ id: "a", word: "alpha", sentenceOptions: ["alpha", "x1", "x2", "x3"] }),
      makeWord({ id: "b", word: "bravo", sentenceOptions: ["bravo", "y1", "y2", "y3"] })
    ];
    const { view } = renderQuiz(words);
    expect(optionLabels().join(",")).toMatch(/alpha|bravo/);

    const others = [
      makeWord({ id: "c", word: "charlie", sentenceOptions: ["charlie", "z1", "z2", "z3"] }),
      makeWord({ id: "d", word: "delta", sentenceOptions: ["delta", "w1", "w2", "w3"] })
    ];
    view.rerender(
      <SentenceQuiz
        level="junior"
        vocabulary={others}
        customWords={others}
        questionCount={2}
        wrongWords={[]}
        setWrongWords={vi.fn()}
        solvedHistory={{}}
        setSolvedHistory={vi.fn()}
        setStats={vi.fn()}
        onBackToDashboard={vi.fn()}
        updateRankingScore={vi.fn()}
      />
    );
    expect(optionLabels().join(",")).toMatch(/charlie|delta/);
    expect(optionLabels().join(",")).not.toMatch(/alpha|bravo/);
  });
});
