import type { ComponentProps } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, within } from "@testing-library/react";
import Quiz from "../src/components/Quiz";
import SentenceQuiz from "../src/components/SentenceQuiz";
import SpellingQuiz from "../src/components/SpellingQuiz";
import { makeWord, makeWords } from "./fixtures";

/**
 * 出題中に単語帳が増えたとき（#154）。
 *
 * 「教材」では単語の取り込み（PDF・AI）と出題の入口が同じ画面にあり、取り込みは画面を離れても続く。
 * 終わると単語帳（vocabulary）が増えるが、出題を作る効果が vocabulary を依存に持っていたので、
 * 解いている途中で問題が丸ごと引き直された（解答の位置と点数はそのままなので、結果に前後の問題が混ざる）。
 * 増えた語がそのレベルに関係なくても引き直していた（5回中5回）。
 */

const WORDS = makeWords(40);
const GROWN = [...WORDS, makeWord({ id: "imported", word: "imported", translation: "取り込んだ語", level: "advanced" })];

const common = () => ({
  level: "junior" as const,
  questionCount: 10,
  wrongWords: [] as string[],
  setWrongWords: vi.fn(),
  solvedHistory: {},
  setSolvedHistory: vi.fn(),
  setStats: vi.fn(),
  onBackToDashboard: vi.fn(),
  updateRankingScore: vi.fn(),
  recordAnswer: vi.fn()
});

afterEach(() => cleanup());

/** 出題中の語（見出し） */
const promptText = () => screen.getByRole("heading", { level: 2 }).textContent;

describe("四択（Quiz）", () => {
  it("1問目に誤答して解説を読んでいるあいだに単語帳が増えても、問題を引き直さない", () => {
    const props = common() as ComponentProps<typeof Quiz>;
    const { rerender } = render(<Quiz {...props} vocabulary={WORDS} />);
    const word = promptText();
    const options = within(document.getElementById("quiz_options_container")!).getAllByRole("button");
    const wrong = options.find(b => !within(b).getByTestId("option_label").textContent!.startsWith("意味"))!;
    act(() => { wrong.click(); });
    expect(screen.getByRole("status")).toHaveTextContent("不正解");

    rerender(<Quiz {...props} vocabulary={GROWN} />);
    expect(promptText()).toBe(word);
    expect(screen.getByRole("status")).toHaveTextContent("不正解");
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
  });
});

describe("例文穴埋め（SentenceQuiz）", () => {
  it("単語帳が増えても、出している例文を替えない", () => {
    const props = common() as ComponentProps<typeof SentenceQuiz>;
    const { rerender } = render(<SentenceQuiz {...props} vocabulary={WORDS} />);
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
    const before = document.body.textContent;
    rerender(<SentenceQuiz {...props} vocabulary={GROWN} />);
    expect(document.body.textContent).toBe(before);
  });
});

describe("綴り（SpellingQuiz）", () => {
  // 綴りは英字だけの見出ししか出さない（canSpell）ので、数字を含まない綴りにする
  const letters = (i: number) => String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26));
  const SPELL = Array.from({ length: 40 }, (_, i) =>
    makeWord({ id: `s_${i}`, word: `word${letters(i)}`, translation: `意味${letters(i)}` })
  );

  it("単語帳が増えても、出している問題を替えない", () => {
    const props = common() as ComponentProps<typeof SpellingQuiz>;
    const { rerender } = render(<SpellingQuiz {...props} vocabulary={SPELL} />);
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
    const before = document.body.textContent;
    rerender(<SpellingQuiz {...props} vocabulary={[...SPELL, GROWN[GROWN.length - 1]]} />);
    expect(document.body.textContent).toBe(before);
  });
});
