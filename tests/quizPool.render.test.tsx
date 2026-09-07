import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Quiz from "../src/components/Quiz";
import SentenceQuiz from "../src/components/SentenceQuiz";
import { makeWord } from "./fixtures";

/**
 * レベル別クイズの出題プール。
 *
 * 復習セッションは呼び出し側（wordsForFormat）が形式に合う語だけを渡すが、
 * レベル別の出題はレベルで絞るだけだった。
 * 取り込んだ単語（CSV・AI・PDF）は同じ品詞の候補が足りないと
 * 誤答が0〜1件しか作れないため（誤答生成は取れた分だけ返す）、
 * そのままだと「選択肢が1つだけ＝必ず正解」や
 * 「穴はあるが選ぶものが無い」壊れた設問が出る。
 */

/** 誤答を作れなかった語（取り込みで実際に起こる形） */
const BROKEN = makeWord({
  id: "broken", word: "zymurgy", translation: "醸造学",
  options: ["醸造学"],          // 誤答が無い
  sentenceOptions: ["zymurgy"], // 同上
  sentence: "He studies [_____] at college."
});
/** 例文が無い語（イディオムの取り込みなどで起こる） */
const NO_SENTENCE = makeWord({
  id: "nosent", word: "keep up with", translation: "遅れずについていく",
  sentence: "", sentenceTranslation: ""
});
const GOOD = makeWord({ id: "good", word: "beautiful" });

const common = {
  level: "junior" as const,
  questionCount: 5,
  wrongWords: [],
  setWrongWords: vi.fn(),
  solvedHistory: {},
  setSolvedHistory: vi.fn(),
  setStats: vi.fn(),
  onBackToDashboard: vi.fn(),
  updateRankingScore: vi.fn(),
  recordAnswer: vi.fn()
};

afterEach(() => cleanup());

/** 四択ボタンだけを数える（発音ボタンなどを含めない） */
function optionCount(containerId: string): number {
  const c = document.getElementById(containerId);
  return c ? c.querySelectorAll("button").length : 0;
}

describe("四択（レベル別）", () => {
  it("選択肢が足りない語は出題しない", () => {
    render(<Quiz {...common} vocabulary={[BROKEN, GOOD]} />);
    // 出るのは GOOD だけ。壊れた語が出ると選択肢が1つになる
    expect(screen.getByRole("heading", { name: "beautiful" })).toBeInTheDocument();
    expect(optionCount("quiz_options_container")).toBe(4);
  });

  it("日→英でも、英単語の選択肢が足りない語は出題しない", () => {
    render(<Quiz {...common} vocabulary={[BROKEN, GOOD]} reverseMode />);
    expect(optionCount("quiz_options_container")).toBe(4);
    // 壊れた語が出ていれば、選択肢は0件か1件になる
    expect(screen.queryByRole("heading", { name: "zymurgy" })).toBeNull();
  });
});

describe("例文穴埋め（レベル別）", () => {
  it("例文の無い語・選択肢の足りない語は出題しない", () => {
    render(<SentenceQuiz {...common} vocabulary={[BROKEN, NO_SENTENCE, GOOD]} />);
    // 3語のうち出題できるのは GOOD だけ。5問求めても1問しか作られない
    expect(document.body.textContent).toMatch(/Q:\s*1\s*\/\s*1/);
    expect(optionCount("sentence_quiz_options_grid")).toBe(4);
    expect(document.body.textContent).not.toContain("keep up with");
  });
});
