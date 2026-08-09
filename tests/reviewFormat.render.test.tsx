import type { ReactElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuizFormatPicker from "../src/components/QuizFormatPicker";
import SentenceQuiz from "../src/components/SentenceQuiz";
import SpellingQuiz from "../src/components/SpellingQuiz";
import { makeWord } from "./fixtures";
import { Word } from "../src/types";

/**
 * 復習の出題形式。
 *
 * 復習はどちらの入口（今日の復習・苦手単語の復習）も四択に固定されていた。
 * 綴りで覚えた語を四択でしか出し直せないと、
 * 「選択肢から選べるが自分では書けない」状態に気づけないまま終わる。
 * 形式が選べること、選んだ形式でその形式のクイズが出ることを固定する。
 */

describe("形式の選択", () => {
  const words = [
    makeWord({ id: "w1", word: "beautiful" }),
    makeWord({ id: "w2", word: "quiet" })
  ];

  it("5つの形式を、出せる語数つきで並べる", () => {
    render(<QuizFormatPicker words={words} onSelect={vi.fn()} />);
    const picker = screen.getByTestId("quiz_format_picker");
    for (const label of ["四択", "文穴埋め", "リスニング", "綴り", "日→英"]) {
      expect(within(picker).getByText(label), label).toBeInTheDocument();
    }
    expect(within(picker).getAllByText("2語")).toHaveLength(5);
  });

  it("選んだ形式を返す", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<QuizFormatPicker words={words} onSelect={onSelect} />);
    await user.click(document.getElementById("review_format_spelling")!);
    expect(onSelect).toHaveBeenCalledWith("spelling");
  });

  it("その形式で出せる語が無ければ選べない", () => {
    // イディオムの見出しは綴りで出せない
    const idioms: Word[] = [makeWord({ id: "i1", word: "how many ~?" })];
    render(<QuizFormatPicker words={idioms} onSelect={vi.fn()} />);
    expect(document.getElementById("review_format_spelling")).toBeDisabled();
    expect(document.getElementById("review_format_word")).not.toBeDisabled();
  });

  it("選べない形式を押しても何も起きない", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<QuizFormatPicker words={[makeWord({ id: "i1", word: "how many ~?" })]} onSelect={onSelect} />);
    await user.click(document.getElementById("review_format_spelling")!);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("形式ごとに出せる語数が違うことを示す", () => {
    render(
      <QuizFormatPicker
        words={[makeWord({ id: "a", word: "beautiful" }), makeWord({ id: "b", word: "Mr." })]}
        onSelect={vi.fn()}
      />
    );
    const spelling = document.getElementById("review_format_spelling")!;
    const word = document.getElementById("review_format_word")!;
    expect(spelling).toHaveTextContent("1語");
    expect(word).toHaveTextContent("2語");
  });
});

/** 復習セッションとして各クイズを描画する共通の props */
function reviewProps(words: Word[]) {
  return {
    level: "junior" as const,
    vocabulary: words,
    customWords: words,
    questionCount: words.length,
    reviewMode: true,
    wrongWords: [],
    setWrongWords: vi.fn(),
    solvedHistory: {},
    setSolvedHistory: vi.fn(),
    setStats: vi.fn(),
    onBackToDashboard: vi.fn(),
    updateRankingScore: vi.fn(),
    recordAnswer: vi.fn()
  };
}

describe("文穴埋めの復習", () => {
  const words = [makeWord({ id: "w1", word: "beautiful" })];

  it("指定された単語だけを、穴埋めの形で出す", () => {
    render(<SentenceQuiz {...reviewProps(words)} />);
    // 四択の選択肢ではなく、例文の空所を埋める形になっている
    expect(screen.getByText(/The garden is very/)).toBeInTheDocument();
    expect(screen.getByText("Q: 1 / 1")).toBeInTheDocument();
  });

  it("英語の選択肢を出す（日本語訳の四択にしない）", () => {
    render(<SentenceQuiz {...reviewProps(words)} />);
    const buttons = Array.from(document.querySelectorAll("button")).map(b => b.textContent || "");
    expect(buttons.join("")).toContain("beautiful");
    expect(buttons.join("")).not.toContain("美しい");
  });

  it("レベルではなく渡された単語から出題する", () => {
    // level は junior だが、customWords は上級の語だけ
    const advanced = [makeWord({ id: "adv", word: "meticulous", level: "advanced" })];
    render(<SentenceQuiz {...reviewProps(advanced)} />);
    expect(screen.getByText("Q: 1 / 1")).toBeInTheDocument();
  });
});

describe("再描画で出題が入れ替わらない", () => {
  // 呼び出し側は毎レンダーで出題対象の配列を作り直すことがある。
  // 配列の同一性で出題し直していたため、解答の途中で問題がすり替わり、
  // 「1問目の判定が出たまま2問目の語が表示される」状態になっていた。
  const words = [
    makeWord({ id: "w1", word: "beautiful", translation: "美しい" }),
    makeWord({ id: "w2", word: "library", translation: "図書館" }),
    makeWord({ id: "w3", word: "station", translation: "駅" })
  ];

  /**
   * 出題し直したかどうかを、見えている問題ではなく Math.random の呼び出しで見る。
   * 出題順はシャッフルなので、たまたま同じ語が先頭に来ることがあり、
   * 画面の比較だけでは見逃す（実際にこの見逃しが起きた）。
   */
  function countsShuffles(render: () => void, rerender: () => void): [number, number] {
    const spy = vi.spyOn(Math, "random");
    render();
    const afterFirst = spy.mock.calls.length;
    rerender();
    const afterSecond = spy.mock.calls.length;
    spy.mockRestore();
    return [afterFirst, afterSecond];
  }

  it("綴り: 中身が同じなら出題し直さない", () => {
    const props = reviewProps(words);
    let rerender: (ui: ReactElement) => void;
    const [before, after] = countsShuffles(
      () => { rerender = render(<SpellingQuiz {...props} />).rerender; },
      // 中身は同じだが別の配列を渡す（毎レンダーで作り直された状態）
      () => rerender(<SpellingQuiz {...props} customWords={[...words]} />)
    );
    expect(before).toBeGreaterThan(0);
    expect(after).toBe(before);
  });

  it("文穴埋め: 中身が同じなら出題し直さない", () => {
    const props = reviewProps(words);
    const { rerender } = render(<SentenceQuiz {...props} />);
    const first = document.getElementById("sentence_quiz_root")?.textContent
      ?? document.body.textContent;
    rerender(<SentenceQuiz {...props} customWords={[...words]} />);
    const second = document.getElementById("sentence_quiz_root")?.textContent
      ?? document.body.textContent;
    expect(second).toBe(first);
  });

  it("出題対象が本当に変わったときは出題し直す", () => {
    const props = reviewProps(words);
    const { rerender } = render(<SpellingQuiz {...props} />);
    const only = [words[2]];
    rerender(<SpellingQuiz {...props} customWords={only} questionCount={1} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("駅");
  });
});

describe("綴りの復習", () => {
  const words = [makeWord({ id: "w1", word: "beautiful" })];

  it("指定された単語だけを、書き取りの形で出す", () => {
    render(<SpellingQuiz {...reviewProps(words)} />);
    expect(screen.getByText(/復習/)).toBeInTheDocument();
    // 日本語訳を見て綴りを入力する。選択肢は出さない
    expect(screen.getByRole("heading", { name: "美しい" })).toBeInTheDocument();
    expect(document.querySelector("input")).toBeInTheDocument();
  });

  it("綴りで出せない見出しは出題しない", () => {
    // イディオムの見出しが混ざっていても書き取りにはしない
    const mixed = [
      makeWord({ id: "ok", word: "beautiful" }),
      makeWord({ id: "idiom", word: "how many ~?", translation: "いくつの" })
    ];
    render(<SpellingQuiz {...reviewProps(mixed)} />);
    expect(screen.queryByRole("heading", { name: "いくつの" })).toBeNull();
    expect(screen.getByRole("heading", { name: "美しい" })).toBeInTheDocument();
  });
});
