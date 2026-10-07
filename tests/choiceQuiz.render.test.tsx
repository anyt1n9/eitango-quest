import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, within } from "@testing-library/react";
import SynonymQuiz from "../src/components/SynonymQuiz";
import SenseQuiz from "../src/components/SenseQuiz";
import { makeWord } from "./fixtures";

/**
 * 類義語クイズと語義分別クイズの画面の検査。
 *
 * データは作りものに差し替える（収録データだと、どの語が出るかで結果が変わる）。
 * 乱数は Math.random を固定して、どの語義・どの同義語を出すかを決める。
 */

let failSynonyms = false;
vi.mock("../src/data/synonyms", () => ({
  get wordSynonyms() {
    if (failSynonyms) throw new Error("chunk load failed");
    return {
      big: { same: ["large"], distractors: ["red", "early", "sad"] },
      fast: { same: ["quick"], distractors: ["red", "early", "sad"] }
    };
  }
}));

vi.mock("../src/data/senseQuiz", () => ({
  senseQuiz: [
    {
      word: "book",
      senses: [
        { meaning: "本", example: "I read a {book}.", translation: "私は本を読みました。" },
        { meaning: "予約する", example: "I {booked} a table.", translation: "私は席を予約しました。" }
      ]
    }
  ]
}));

const W = (id: string, word: string, translation: string) =>
  makeWord({ id, word, translation, level: "junior", pos: "adjective" });

const VOCAB = [
  W("big", "big", "大きい"),
  W("fast", "fast", "速い"),
  W("large", "large", "大きい、広い"),
  W("quick", "quick", "素早い、速い"),
  W("red", "red", "赤い"),
  W("early", "early", "早い"),
  W("sad", "sad", "悲しい"),
  makeWord({ id: "book", word: "book", translation: "本", level: "junior", pos: "noun" })
];

const common = () => ({
  level: "junior" as const,
  vocabulary: VOCAB,
  setWrongWords: vi.fn(),
  solvedHistory: {},
  setSolvedHistory: vi.fn(),
  setStats: vi.fn(),
  onBackToDashboard: vi.fn(),
  updateRankingScore: vi.fn(),
  recordAnswer: vi.fn(),
  questionCount: 10
});

beforeEach(() => {
  failSynonyms = false;
  // 0 に固定すると、出題順・選択肢の並び・語義の選び方が決まる
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function optionButton(label: string): HTMLButtonElement {
  const container = document.getElementById("quiz_options_container")!;
  return within(container).getByText(label).closest("button") as HTMLButtonElement;
}

describe("類義語クイズ", () => {
  it("同じ意味の語を選ぶと正解になり、解説に両方の訳が出る", async () => {
    const props = common();
    render(<SynonymQuiz {...props} />);
    const prompt = await screen.findByText(/この語と同じ意味の語はどれ/);
    expect(prompt).toBeInTheDocument();
    const word = document.getElementById("synonym_prompt_word")!.textContent!;
    const answer = word === "big" ? "large" : "quick";

    act(() => { optionButton(answer).click(); });
    expect(screen.getByRole("status")).toHaveTextContent("正解です");
    expect(props.recordAnswer).toHaveBeenCalledWith(word, true);
    expect(document.getElementById("choice_quiz_feedback")!.textContent).toContain(answer);
    expect(props.setWrongWords).not.toHaveBeenCalled();
  });

  it("違う語を選ぶと不正解になり、苦手単語に入る", async () => {
    const props = common();
    render(<SynonymQuiz {...props} />);
    await screen.findByText(/この語と同じ意味の語はどれ/);
    const word = document.getElementById("synonym_prompt_word")!.textContent!;

    act(() => { optionButton("red").click(); });
    expect(screen.getByRole("status")).toHaveTextContent("不正解です");
    expect(props.recordAnswer).toHaveBeenCalledWith(word, false);
    expect(props.setWrongWords).toHaveBeenCalledTimes(1);
    // 選んだ語の意味も見せる（なぜ違うのかが分かるように）
    expect(document.getElementById("choice_quiz_feedback")!.textContent).toContain("赤い");
  });

  it("解答の二度押しは1回として記録する", async () => {
    const props = common();
    render(<SynonymQuiz {...props} />);
    await screen.findByText(/この語と同じ意味の語はどれ/);
    // 同じ act の中で続けて押す（fireEvent を並べると再描画が挟まって再現しない）
    act(() => {
      optionButton("red").click();
      optionButton("early").click();
    });
    expect(props.recordAnswer).toHaveBeenCalledTimes(1);
    expect(props.setSolvedHistory).toHaveBeenCalledTimes(1);
  });

  it("「次へ」の二度押しで問題を飛ばさない", async () => {
    render(<SynonymQuiz {...common()} />);
    await screen.findByText(/この語と同じ意味の語はどれ/);
    expect(screen.getByText("Q: 1 / 2")).toBeInTheDocument();
    act(() => { optionButton("red").click(); });
    const next = document.getElementById("btn_next_question")!;
    act(() => { next.click(); next.click(); });
    expect(screen.getByText("Q: 2 / 2")).toBeInTheDocument();
    // 2問目も答えられる（解答の印が消えている）
    act(() => { optionButton("sad").click(); });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("最後まで解くと結果が出て、ポイントは1回だけ加算される", async () => {
    const props = common();
    render(<SynonymQuiz {...props} />);
    await screen.findByText(/この語と同じ意味の語はどれ/);
    for (let i = 0; i < 2; i++) {
      const word = document.getElementById("synonym_prompt_word")!.textContent!;
      act(() => { optionButton(word === "big" ? "large" : "quick").click(); });
      const next = document.getElementById("btn_next_question")!;
      act(() => { next.click(); next.click(); });
    }
    expect(document.getElementById("quiz_result_card")).toBeInTheDocument();
    // 2問正解 × 30P ＋ 全問正解 150P
    expect(props.updateRankingScore).toHaveBeenCalledTimes(1);
    expect(props.updateRankingScore).toHaveBeenCalledWith(210);
  });

  it("データを読み込めなければ理由を出し、控えを捨てて読み直せる", async () => {
    // 前のテストで読み込みが済んでいるので、読み込み部分を新しく取り直す
    vi.resetModules();
    const { default: FreshSynonymQuiz } = await import("../src/components/SynonymQuiz");
    const { loadSynonyms } = await import("../src/synonyms");

    failSynonyms = true;
    render(<FreshSynonymQuiz {...common()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("読み込めませんでした");

    // 失敗した約束を残すと、通信が戻っても同じ失敗を返し続ける
    failSynonyms = false;
    await expect(loadSynonyms()).resolves.toHaveProperty("big");
  });
});

describe("語義分別クイズ", () => {
  it("例文の対象の語を強調し、その語の語義から選ばせる", async () => {
    render(<SenseQuiz {...common()} recordPractice={vi.fn()} />);
    await screen.findByText(/の意味はどれ/);
    const sentence = document.getElementById("sense_prompt_sentence")!;
    expect(sentence.textContent).toBe("I read a book.");
    expect(sentence.querySelector("mark")!.textContent).toBe("book");
    const labels = screen.getAllByTestId("option_label").map(e => e.textContent).sort();
    expect(labels).toEqual(["予約する", "本"].sort());
  });

  it("教材が教えている語義の問題は、間隔反復と苦手単語に記録する", async () => {
    // Math.random = 0 → 先頭の語義（本）
    const props = common();
    const recordPractice = vi.fn();
    render(<SenseQuiz {...props} recordPractice={recordPractice} />);
    await screen.findByText(/の意味はどれ/);
    act(() => { optionButton("予約する").click(); });
    expect(props.recordAnswer).toHaveBeenCalledWith("book", false);
    expect(props.setWrongWords).toHaveBeenCalledTimes(1);
    expect(recordPractice).not.toHaveBeenCalled();
  });

  it("別の語義の問題は、今日の学習量にだけ数える（間隔反復・苦手単語に入れない）", async () => {
    // Math.random = 0.99 → 最後の語義（予約する）
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const props = common();
    const recordPractice = vi.fn();
    render(<SenseQuiz {...props} recordPractice={recordPractice} />);
    await screen.findByText(/の意味はどれ/);
    expect(document.getElementById("sense_prompt_sentence")!.textContent).toBe("I booked a table.");

    act(() => { optionButton("本").click(); });
    expect(recordPractice).toHaveBeenCalledWith(false);
    expect(props.recordAnswer).not.toHaveBeenCalled();
    expect(props.setWrongWords).not.toHaveBeenCalled();
    expect(props.setSolvedHistory).not.toHaveBeenCalled();
    // 和訳とほかの語義を解説に出す
    const feedback = document.getElementById("choice_quiz_feedback")!.textContent!;
    expect(feedback).toContain("私は席を予約しました。");
    expect(feedback).toContain("I read a book.");
  });

  it("解答の二度押しは1回として記録する", async () => {
    const props = common();
    render(<SenseQuiz {...props} recordPractice={vi.fn()} />);
    await screen.findByText(/の意味はどれ/);
    act(() => {
      optionButton("本").click();
      optionButton("本").click();
    });
    expect(props.recordAnswer).toHaveBeenCalledTimes(1);
  });
});
