import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act, within, fireEvent } from "@testing-library/react";
import Quiz from "../src/components/Quiz";
import SentenceQuiz from "../src/components/SentenceQuiz";
import SpellingQuiz from "../src/components/SpellingQuiz";
import { makeWord } from "./fixtures";

/**
 * 解答の二度押し（スマホのダブルタップ）。
 *
 * 「一度答えたら選び直せない」は state（selectedOption など）で守っていたが、
 * state が効くのは再描画のあとなので、同じ瞬間に2回押されると両方が通る。
 * 解答の記録は学習データそのもの（間隔反復の箱・正答数・苦手単語・スコア）なので、
 * 1回の解答が2回分として記録されると、
 *   - 正解で箱が2段上がり、まだ覚えていない語が「習得済み」になる
 *   - A を押した直後に B を押すと、両方が解答として記録される
 * といった形で、学習の記録そのものが狂う。
 */

const WORD = makeWord();

const common = {
  level: "junior" as const,
  vocabulary: [WORD],
  customWords: [WORD],
  questionCount: 1,
  wrongWords: [],
  setWrongWords: vi.fn(),
  solvedHistory: {},
  setSolvedHistory: vi.fn(),
  setStats: vi.fn(),
  onBackToDashboard: vi.fn(),
  updateRankingScore: vi.fn()
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

/** 再描画を挟まずに続けて押す（fireEvent を並べると2回目は既に答えた状態になる） */
function tapTogether(...els: HTMLElement[]) {
  act(() => { for (const el of els) el.click(); });
}

describe("四択", () => {
  function options() {
    return within(document.getElementById("quiz_options_container")!).getAllByRole("button");
  }

  it("同じ選択肢を2回押しても、解答の記録は1回だけ", () => {
    const recordAnswer = vi.fn();
    render(<Quiz {...common} recordAnswer={recordAnswer} />);
    const right = options().find(b => b.textContent?.includes(WORD.translation))!;
    tapTogether(right, right);
    expect(recordAnswer).toHaveBeenCalledTimes(1);
  });

  it("別の選択肢を続けて押しても、最初の1つだけを解答にする", () => {
    const recordAnswer = vi.fn();
    render(<Quiz {...common} recordAnswer={recordAnswer} />);
    const [a, b] = options();
    tapTogether(a, b);
    expect(recordAnswer).toHaveBeenCalledTimes(1);
  });
});

describe("例文穴埋め", () => {
  it("同じ選択肢を2回押しても、解答の記録は1回だけ", () => {
    const recordAnswer = vi.fn();
    render(<SentenceQuiz {...common} recordAnswer={recordAnswer} />);
    const grid = document.getElementById("sentence_quiz_options_grid")!;
    const right = within(grid).getAllByRole("button").find(b => b.textContent === WORD.word)!;
    tapTogether(right, right);
    expect(recordAnswer).toHaveBeenCalledTimes(1);
  });
});

describe("綴り", () => {
  it("Enter を2回押しても、解答の記録は1回だけ", () => {
    const recordAnswer = vi.fn();
    render(<SpellingQuiz {...common} recordAnswer={recordAnswer} />);
    const form = document.querySelector("form") as HTMLFormElement;
    const input = form.querySelector('input[type="text"]') as HTMLInputElement;
    act(() => {
      // React の制御された入力に値を入れる
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, WORD.word);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      form.requestSubmit();
      form.requestSubmit();
    });
    expect(recordAnswer).toHaveBeenCalledTimes(1);
  });
});

/**
 * 二度押しを止める印が、**次の問題まで残ってはいけない**。
 * 残ると、2問目以降を押しても何も起きない（解答できない）ことになり、
 * 二重記録より悪い。問題が進んだとき・やり直したときに必ず消えることを見る。
 */
describe("次の問題では、ふつうに答えられる", () => {
  const TWO = [
    makeWord({ id: "a", word: "alpha", translation: "アルファ",
      options: ["アルファ", "x1", "x2", "x3"], sentenceOptions: ["alpha", "y1", "y2", "y3"] }),
    makeWord({ id: "b", word: "bravo", translation: "ブラボー",
      options: ["ブラボー", "x1", "x2", "x3"], sentenceOptions: ["bravo", "y1", "y2", "y3"] })
  ];
  const two = { ...common, vocabulary: TWO, customWords: TWO, questionCount: 2 };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("四択: 1問目のあと2問目も記録される", () => {
    const recordAnswer = vi.fn();
    render(<Quiz {...two} recordAnswer={recordAnswer} />);
    const pick = () => within(document.getElementById("quiz_options_container")!).getAllByRole("button")[0];
    fireEvent.click(pick());
    act(() => { vi.advanceTimersByTime(6500); }); // 不正解でも6秒で次へ進む
    fireEvent.click(pick());
    expect(recordAnswer).toHaveBeenCalledTimes(2);
  });

  it("例文穴埋め: 1問目のあと2問目も記録される", () => {
    const recordAnswer = vi.fn();
    render(<SentenceQuiz {...two} recordAnswer={recordAnswer} />);
    const pick = () => within(document.getElementById("sentence_quiz_options_grid")!).getAllByRole("button")[0];
    fireEvent.click(pick());
    act(() => { vi.advanceTimersByTime(6500); });
    fireEvent.click(pick());
    expect(recordAnswer).toHaveBeenCalledTimes(2);
  });

  it("綴り: 1問目のあと2問目も記録される", () => {
    vi.useRealTimers();
    const recordAnswer = vi.fn();
    render(<SpellingQuiz {...two} recordAnswer={recordAnswer} />);
    const answer = (text: string) => {
      const form = document.querySelector("form") as HTMLFormElement;
      const input = form.querySelector('input[type="text"]') as HTMLInputElement;
      fireEvent.change(input, { target: { value: text } });
      fireEvent.submit(form);
    };
    answer("zzz");
    // 次へ（判定のあとに出るボタン）
    const next = [...document.querySelectorAll("button")].find(b => /次へ|次の問題|結果/.test(b.textContent || ""))!;
    expect(next, "次へ進むボタンが見つからない").toBeTruthy();
    fireEvent.click(next);
    answer("zzz");
    expect(recordAnswer).toHaveBeenCalledTimes(2);
  });

  it("綴り: 空のまま送っても、そのあと答えられる", () => {
    vi.useRealTimers();
    const recordAnswer = vi.fn();
    render(<SpellingQuiz {...common} recordAnswer={recordAnswer} />);
    const form = document.querySelector("form") as HTMLFormElement;
    const input = form.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.submit(form);                          // 空のまま
    fireEvent.change(input, { target: { value: WORD.word } });
    fireEvent.submit(form);                          // 入れてから
    expect(recordAnswer).toHaveBeenCalledTimes(1);
  });
});

