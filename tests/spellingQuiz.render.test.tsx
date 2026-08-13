import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SpellingQuiz from "../src/components/SpellingQuiz";
import { makeWord } from "./fixtures";
import { Word } from "../src/types";

/**
 * 綴りクイズの描画。
 *
 * 唯一の産出（自分で書く）練習なので、答えを見せてしまうと
 * 問題として成立しない。ここで固定するのは主に3つ：
 *   - 出題中に答えの綴りが画面のどこにも出ていないこと
 *     （例文をそのまま出すと、本文に答えが入っている）
 *   - ヒントは最初の1文字と長さだけで、全部は見せないこと
 *   - 綴りを問えない見出し（イディオム・記号を含む語）を出さないこと
 * 判定そのもの（大文字小文字・空白）は tests/spelling.test.ts が見る。
 * ここでは画面から入力したときに同じ判定になることを確かめる。
 */

function renderQuiz(
  words: Word[] = [makeWord()],
  props: Partial<ComponentProps<typeof SpellingQuiz>> = {}
) {
  const recordAnswer = vi.fn();
  const setWrongWords = vi.fn();
  const setSolvedHistory = vi.fn();
  const setStats = vi.fn();
  const onBackToDashboard = vi.fn();
  const updateRankingScore = vi.fn();

  const view = render(
    <SpellingQuiz
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

function input() {
  return document.getElementById("spelling_input") as HTMLInputElement;
}

/** 出題カードに出ている文字すべて */
function cardText() {
  return document.getElementById("spelling_running_card")!.textContent || "";
}

async function answer(text: string) {
  const user = userEvent.setup();
  await user.type(input(), text);
  await user.click(document.getElementById("btn_spelling_submit")!);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("出題", () => {
  it("日本語訳を見出しにして、英単語を書かせる", () => {
    renderQuiz();
    expect(screen.getByRole("heading", { name: "美しい" })).toBeInTheDocument();
    expect(screen.getByLabelText("英単語を入力")).toBeInTheDocument();
  });

  it("答えの綴りは出題中どこにも出さない", () => {
    renderQuiz();
    expect(cardText()).not.toContain("beautiful");
    expect(input().value).toBe("");
  });

  it("例文の穴も伏せたまま出す", () => {
    renderQuiz();
    expect(cardText()).toContain("＿＿＿");
    expect(cardText()).not.toContain("[_____]");
  });

  it("例文に答えが入っているデータでも、答えを出さない", () => {
    // 綴りモードは例文をそのまま添える。[_____] の無い例文だと
    // 本文に答えが入ったままになる
    renderQuiz([makeWord({ sentence: "The garden is very beautiful in spring." })]);
    expect(cardText()).not.toContain("beautiful");
  });

  it("綴りを問えない見出しは出題しない", () => {
    // イディオム・記号や数字を含む見出しは書かせようがない
    renderQuiz([
      makeWord({ id: "idiom", word: "how many ~?", translation: "いくつの" }),
      makeWord({ id: "ok", word: "library", translation: "図書館" })
    ]);
    expect(screen.getByRole("heading", { name: "図書館" })).toBeInTheDocument();
    expect(screen.getByText("Q: 1 / 1")).toBeInTheDocument();
  });

  it("出せる語が1つも無ければ、準備中のまま出題しない", () => {
    renderQuiz([makeWord({ id: "idiom", word: "how many ~?", translation: "いくつの" })]);
    expect(screen.getByText(/綴りクイズの準備をしています/)).toBeInTheDocument();
    expect(document.getElementById("spelling_input")).toBeNull();
  });
});

describe("ヒント", () => {
  it("押すまで出さない", () => {
    renderQuiz();
    expect(cardText()).not.toContain("b _ _");
  });

  it("最初の1文字と長さだけを見せる", async () => {
    const user = userEvent.setup();
    renderQuiz();
    await user.click(document.getElementById("btn_spelling_hint")!);
    // beautiful → "b _ _ _ _ _ _ _ _"
    expect(screen.getByText("b _ _ _ _ _ _ _ _")).toBeInTheDocument();
    expect(cardText()).not.toContain("beautiful");
  });
});

describe("答え合わせ", () => {
  it("空欄では答え合わせできない", () => {
    renderQuiz();
    expect(document.getElementById("btn_spelling_submit")).toBeDisabled();
  });

  it("正解すると、正誤が読み上げにも伝わる", async () => {
    const { recordAnswer } = renderQuiz();
    await answer("beautiful");

    const status = document.querySelector('[role="status"]')!;
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status.textContent).toContain("正解です");
    expect(recordAnswer).toHaveBeenCalledWith("w_beautiful", true);
  });

  it("大文字小文字と前後の空白は不問にする", async () => {
    const { recordAnswer } = renderQuiz();
    await answer("  BeautiFul  ");
    expect(recordAnswer).toHaveBeenCalledWith("w_beautiful", true);
  });

  it("間違えたら正しい綴りを見せ、苦手単語に入れる", async () => {
    const { recordAnswer, setWrongWords } = renderQuiz();
    await answer("beatiful");

    const status = document.querySelector('[role="status"]')!;
    expect(status.textContent).toContain("おしい！正しい綴りはこちら");
    expect(status.textContent).toContain("beautiful");
    expect(recordAnswer).toHaveBeenCalledWith("w_beautiful", false);
    expect(setWrongWords).toHaveBeenCalled();
  });

  it("入力のどの文字が違うかを印で示す", async () => {
    renderQuiz();
    await answer("beatiful");
    // 合っている文字と違う文字を別の色で並べる（下線付きが間違い）
    const marked = document.querySelectorAll('[role="status"] .underline');
    expect(marked.length).toBeGreaterThan(0);
  });

  it("答え合わせのあとは入力を受け付けない", async () => {
    renderQuiz();
    await answer("beautiful");
    expect(input()).toBeDisabled();
    expect(document.getElementById("btn_spelling_submit")).toBeNull();
    expect(document.getElementById("btn_spelling_next")).toBeInTheDocument();
  });

  it("正しい綴りを読み上げる", async () => {
    renderQuiz();
    await answer("beatiful");
    const spoken = (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls.map(
      c => c[0].text
    );
    expect(spoken).toContain("beautiful");
  });
});

describe("進行", () => {
  it("次の問題へ進むと、前の入力を持ち越さない", async () => {
    const user = userEvent.setup();
    renderQuiz([
      makeWord({ id: "a", word: "alpha", translation: "アルファ" }),
      makeWord({ id: "b", word: "bravo", translation: "ブラボー" })
    ]);
    await answer("zzz");
    await user.click(document.getElementById("btn_spelling_next")!);

    expect(screen.getByText("Q: 2 / 2")).toBeInTheDocument();
    expect(input().value).toBe("");
    expect(input()).not.toBeDisabled();
  });

  it("最後まで解くと結果を出す", async () => {
    const user = userEvent.setup();
    const { updateRankingScore } = renderQuiz([
      makeWord({ id: "a", word: "alpha", translation: "アルファ" })
    ]);
    await answer("alpha");
    await user.click(document.getElementById("btn_spelling_next")!);

    expect(document.getElementById("spelling_result_card")).toBeInTheDocument();
    // 1問50P + 全問正解ボーナス250P
    expect(updateRankingScore).toHaveBeenCalledWith(300);
  });
});
