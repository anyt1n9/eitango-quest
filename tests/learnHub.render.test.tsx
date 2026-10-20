import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LearnHub from "../src/components/LearnHub";
import { makeWord } from "./fixtures";

/**
 * 教材の画面（画面下のタブの「教材」）。
 *
 * ダッシュボードの「学習メニュー」の折りたたみ・「調べる」タブ・レベルのカードの
 * 形式ボタン・ハンバーガーの「つながりマップ」に分かれていた入口をここに集めた。
 * 入口が1か所になったぶん、ここが動かなくなると画面へ行けなくなる。
 */

const VOCAB = [
  makeWord({ id: "j1", word: "beautiful", level: "junior" }),
  makeWord({ id: "s1", word: "achieve", level: "senior" })
];

function renderLearn(props: Partial<ComponentProps<typeof LearnHub>> = {}) {
  const all: ComponentProps<typeof LearnHub> = {
    vocabulary: VOCAB,
    setVocabulary: vi.fn(),
    setStats: vi.fn(),
    setRanking: vi.fn(),
    solvedHistory: {},
    srsData: {},
    wrongWords: [],
    onStartQuiz: vi.fn(),
    onStartReview: vi.fn(),
    onOpenReading: vi.fn(),
    onOpenGrammar: vi.fn(),
    onOpenVerbForms: vi.fn(),
    onOpenMapPuzzle: vi.fn(),
    onOpenDiary: vi.fn(),
    onChangeLevel: vi.fn(),
    ...props
  };
  render(<LearnHub {...all} />);
  return all;
}

beforeEach(() => {
  localStorage.clear();
});

describe("単語クイズ", () => {
  it("7つの形式がどれも並び、押すとすぐ始まる", async () => {
    const user = userEvent.setup();
    const { onStartQuiz } = renderLearn();
    for (const type of ["word", "reverse", "sentence", "listening", "spelling", "synonym", "sense"]) {
      await user.click(document.getElementById(`btn_learn_${type}`)!);
      expect(onStartQuiz, type).toHaveBeenLastCalledWith("junior", type, 10);
    }
  });

  it("「今日」の画面で選んだレベルと問題数を使う", async () => {
    // 片方で選んだものがもう片方に効かないと、
    // 「中級1を選んだのに教材から始めたら初級だった」ことになる
    localStorage.setItem("quest_selected_level", "senior");
    localStorage.setItem("quest_question_count", "50");
    const user = userEvent.setup();
    const { onStartQuiz } = renderLearn();
    expect(document.getElementById("learn_quiz_setting")).toHaveTextContent("中級1（高1）・50問");
    await user.click(document.getElementById("btn_learn_spelling")!);
    expect(onStartQuiz).toHaveBeenCalledWith("senior", "spelling", 50);
  });

  it("レベルを変えるときは「今日」の画面へ戻す", async () => {
    const user = userEvent.setup();
    const { onChangeLevel } = renderLearn();
    await user.click(document.getElementById("btn_learn_change_level")!);
    expect(onChangeLevel).toHaveBeenCalledTimes(1);
  });

  it("苦手な単語の数を出し、復習へ行ける", async () => {
    const user = userEvent.setup();
    const { onStartReview } = renderLearn({ wrongWords: ["j1", "s1"] });
    expect(document.getElementById("btn_learn_wrong_words")).toHaveTextContent("間違えた 2語を復習");
    await user.click(document.getElementById("btn_learn_wrong_words")!);
    expect(onStartReview).toHaveBeenCalledTimes(1);
  });
});

describe("読む・文法", () => {
  it("それぞれの画面へ移れる", async () => {
    const user = userEvent.setup();
    const h = renderLearn();
    const pairs: [string, keyof typeof h][] = [
      ["learn_open_reading", "onOpenReading"],
      ["learn_open_grammar", "onOpenGrammar"],
      ["learn_open_verb_forms", "onOpenVerbForms"],
      ["learn_open_map", "onOpenMapPuzzle"],
      ["learn_open_diary", "onOpenDiary"]
    ];
    for (const [id, handler] of pairs) {
      await user.click(document.getElementById(id)!);
      expect(h[handler], id).toHaveBeenCalledTimes(1);
    }
  });

  it("項目ごとに違う絵を使う", () => {
    renderLearn();
    const marks = ["learn_open_reading", "learn_open_grammar", "learn_open_verb_forms", "learn_open_map"]
      .map(id => document.getElementById(id)!.querySelector("svg")!.innerHTML);
    expect(new Set(marks).size, "同じ絵が2か所に出ている").toBe(marks.length);
  });
});

describe("AI 英語日記", () => {
  it("使えるようになるまでの残りを出す（目立つボタンにしない）", () => {
    // 以前は学習メニューの中で、まだ使えないこの機能のボタンがいちばん目立っていた
    renderLearn();
    expect(document.getElementById("learn_diary_lock")).toHaveTextContent("200語覚えると使えます（あと 200語）");
    expect(document.getElementById("learn_open_diary")!.className).toContain("border-dashed");
  });

  it("200語覚えたら、ふつうの入口になる", () => {
    const words = Array.from({ length: 200 }, (_, i) => makeWord({ id: `w${i}`, word: `word${i}`, level: "junior" }));
    const srsData = Object.fromEntries(words.map(w => [w.id, { box: 3, dueDate: "2099-01-01", lastReview: "2026-01-01", reps: 3, lapses: 0 }]));
    renderLearn({ vocabulary: words, srsData });
    expect(document.getElementById("learn_diary_lock")).toBeNull();
    expect(document.getElementById("learn_open_diary")!.className).not.toContain("border-dashed");
  });
});

describe("単語を増やす", () => {
  it("取り込みの手順は既定で畳んでおく", () => {
    // AI・CSV・PDF の取り込みは縦に1,200pxあり、毎日の学習では使わない
    renderLearn();
    expect(screen.queryByTestId("import_panel")).toBeNull();
    expect(document.getElementById("btn_toggle_import_panel")).toHaveAttribute("aria-expanded", "false");
  });

  it("押せば開く", async () => {
    const user = userEvent.setup();
    renderLearn();
    await user.click(document.getElementById("btn_toggle_import_panel")!);
    expect(screen.getByTestId("import_panel")).toBeInTheDocument();
    expect(document.getElementById("input_new_word")).toBeInTheDocument();
  });
});
