import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../src/components/Dashboard";
import { makeWord, makeStats } from "./fixtures";

/**
 * 出題の入口。
 *
 * 「一問一答」だけが問題数を選ぶモーダルを開き、
 * 他の4形式は10問固定で即開始していた。
 * 同じ並びのボタンなのに片方だけ手順が増え、
 * しかも他の形式では問題数を選べないという不揃いだった。
 *
 * 1回の問題数を1か所の設定にして、5形式すべてがそれを使う。
 */

const VOCAB = [
  makeWord({ id: "j1", word: "beautiful", level: "junior" }),
  makeWord({ id: "j2", word: "quiet", level: "junior" })
];

function renderDashboard() {
  const onStartQuiz = vi.fn();
  render(
    <Dashboard
      stats={makeStats()}
      setStats={vi.fn()}
      vocabulary={VOCAB}
      setVocabulary={vi.fn()}
      solvedHistory={{}}
      srsData={{}}
      wrongWords={[]}
      onStartQuiz={onStartQuiz}
      onStartReview={vi.fn()}
      onOpenDictionary={vi.fn()}
      onStartReading={vi.fn()}
      onOpenDiary={vi.fn()}
      onOpenVerbForms={vi.fn()}
      onOpenGrammar={vi.fn()}
      ranking={[{ id: "me_id", name: "You", score: 0, avatar: "🏆", isMe: true }]}
      setRanking={vi.fn()}
      dailyLog={{}}
      dailyGoal={20}
      equipped={{}}
      onOpenGachaShop={vi.fn()}
    />
  );
  return { onStartQuiz };
}

beforeEach(() => {
  localStorage.clear();
});

describe("1回の問題数", () => {
  it("選べる数を並べる", () => {
    renderDashboard();
    const picker = screen.getByTestId("question_count_picker");
    for (const label of ["10問", "50問", "100問"]) {
      expect(within(picker).getByText(label), label).toBeInTheDocument();
    }
  });

  it("既定は10問", () => {
    renderDashboard();
    expect(document.getElementById("btn_question_count_10")).toHaveAttribute("aria-pressed", "true");
  });

  it("選んだ数を覚えておく", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(document.getElementById("btn_question_count_50")!);
    expect(document.getElementById("btn_question_count_50")).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("quest_question_count")).toBe("50");
  });

  it("保存された数で開き直す", () => {
    localStorage.setItem("quest_question_count", "100");
    renderDashboard();
    expect(document.getElementById("btn_question_count_100")).toHaveAttribute("aria-pressed", "true");
  });

  it("保存値が壊れていても既定に戻す", () => {
    localStorage.setItem("quest_question_count", "9999");
    renderDashboard();
    expect(document.getElementById("btn_question_count_10")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("5つの形式の入口", () => {
  const FORMATS: [string, string][] = [
    ["btn_junior_word", "word"],
    ["btn_junior_sentence", "sentence"],
    ["btn_junior_listening", "listening"],
    ["btn_junior_reverse", "reverse"],
    ["btn_junior_spelling", "spelling"]
  ];

  it("どの形式もすぐ始まる（片方だけモーダルを挟まない）", async () => {
    for (const [id, type] of FORMATS) {
      const user = userEvent.setup();
      const { onStartQuiz } = renderDashboard();
      await user.click(document.getElementById(id)!);
      expect(onStartQuiz, id).toHaveBeenCalledWith("junior", type, 10);
      screen.getByTestId("question_count_picker"); // まだダッシュボードにいる
      document.body.innerHTML = "";
    }
  });

  it("選んだ問題数がすべての形式に効く", async () => {
    const user = userEvent.setup();
    const { onStartQuiz } = renderDashboard();
    await user.click(document.getElementById("btn_question_count_50")!);

    await user.click(document.getElementById("btn_junior_spelling")!);
    expect(onStartQuiz).toHaveBeenCalledWith("junior", "spelling", 50);

    await user.click(document.getElementById("btn_junior_word")!);
    expect(onStartQuiz).toHaveBeenCalledWith("junior", "word", 50);
  });

  it("出題数を選ぶモーダルは残っていない", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(document.getElementById("btn_junior_word")!);
    expect(document.getElementById("word_count_modal")).toBeNull();
  });
});

describe("画面の詰まりを減らす", () => {
  it("取り込みの手順は既定で畳んでおく", () => {
    // AI・CSV・PDF の取り込みは縦に1,200pxあり、毎日の学習では使わない
    renderDashboard();
    expect(screen.queryByTestId("import_panel")).toBeNull();
    expect(document.getElementById("btn_toggle_import_panel")).toHaveAttribute("aria-expanded", "false");
  });

  it("押せば開く", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(document.getElementById("btn_toggle_import_panel")!);
    expect(screen.getByTestId("import_panel")).toBeInTheDocument();
    expect(document.getElementById("input_new_word")).toBeInTheDocument();
  });

  it("レベルへの飛び先を並べる", () => {
    // スマホでは1列に積むので、上級のカードまで3,500pxスクロールしていた
    renderDashboard();
    const jump = screen.getByTestId("level_jump");
    for (const label of ["中学", "高1", "高2", "高3", "大学・社会人"]) {
      expect(within(jump).getByText(label), label).toBeInTheDocument();
    }
  });

  it("飛び先はそのレベルのカードを指す", async () => {
    const user = userEvent.setup();
    renderDashboard();
    const card = document.getElementById("advanced_level_card")!;
    const spy = vi.spyOn(card, "scrollIntoView");
    await user.click(document.getElementById("btn_jump_advanced")!);
    expect(spy).toHaveBeenCalled();
  });
});

describe("長文・AI日記への入口", () => {
  /**
   * この2つは上部のナビからは外した（ダッシュボードに大きな案内カードがあり、
   * 入口が二重になっていたため）。カード側のボタンが唯一の入口になるので、
   * ここが動かなくなると画面へ行けなくなる。
   *
   * AI日記のボタンは以前、消したナビのボタンを
   * `document.getElementById(...).click()` で押していた。
   * ナビを消した時点で行き先を失うので、呼び出しで繋ぎ直してある。
   */
  it("長文はカードのボタンから開ける", async () => {
    const user = userEvent.setup();
    const onStartReading = vi.fn();
    render(
      <Dashboard
        stats={makeStats()} setStats={vi.fn()} vocabulary={VOCAB} setVocabulary={vi.fn()}
        solvedHistory={{}} srsData={{}} wrongWords={[]} onStartQuiz={vi.fn()}
        onStartReview={vi.fn()} onOpenDictionary={vi.fn()} onStartReading={onStartReading}
        onOpenDiary={vi.fn()} onOpenVerbForms={vi.fn()} onOpenGrammar={vi.fn()}
        ranking={[{ id: "me_id", name: "You", score: 0, avatar: "🏆", isMe: true }]}
        setRanking={vi.fn()} dailyLog={{}} dailyGoal={20} equipped={{}} onOpenGachaShop={vi.fn()}
      />
    );
    await user.click(document.getElementById("dashboard_open_reading_btn")!);
    expect(onStartReading).toHaveBeenCalledTimes(1);
  });

  it("AI日記はカードのボタンから開ける", async () => {
    const user = userEvent.setup();
    const onOpenDiary = vi.fn();
    render(
      <Dashboard
        stats={makeStats()} setStats={vi.fn()} vocabulary={VOCAB} setVocabulary={vi.fn()}
        solvedHistory={{}} srsData={{}} wrongWords={[]} onStartQuiz={vi.fn()}
        onStartReview={vi.fn()} onOpenDictionary={vi.fn()} onStartReading={vi.fn()}
        onOpenDiary={onOpenDiary} onOpenVerbForms={vi.fn()} onOpenGrammar={vi.fn()}
        ranking={[{ id: "me_id", name: "You", score: 0, avatar: "🏆", isMe: true }]}
        setRanking={vi.fn()} dailyLog={{}} dailyGoal={20} equipped={{}} onOpenGachaShop={vi.fn()}
      />
    );
    await user.click(document.getElementById("dashboard_open_diary_btn")!);
    expect(onOpenDiary).toHaveBeenCalledTimes(1);
  });
});

describe("「調べる」タブ", () => {
  /**
   * 辞書・活用表・文法ガイドは上部のナビに散らばっていて、
   * 何がどこにあるのか分かりにくかった。
   * 「習熟度 & クイズ」と「AIアドバイス」の間にタブを1つ足して、
   * 3つの入口をそこにまとめる。
   */
  function renderWithHandlers() {
    const handlers = {
      onOpenDictionary: vi.fn(),
      onOpenVerbForms: vi.fn(),
      onOpenGrammar: vi.fn()
    };
    render(
      <Dashboard
        stats={makeStats()} setStats={vi.fn()} vocabulary={VOCAB} setVocabulary={vi.fn()}
        solvedHistory={{}} srsData={{}} wrongWords={[]} onStartQuiz={vi.fn()}
        onStartReview={vi.fn()} onStartReading={vi.fn()} onOpenDiary={vi.fn()}
        {...handlers}
        ranking={[{ id: "me_id", name: "You", score: 0, avatar: "🏆", isMe: true }]}
        setRanking={vi.fn()} dailyLog={{}} dailyGoal={20} equipped={{}} onOpenGachaShop={vi.fn()}
      />
    );
    return handlers;
  }

  it("タブが「習熟度 & クイズ」と「AIアドバイス」の間に並ぶ", () => {
    renderWithHandlers();
    const ids = within(screen.getByTestId("dashboard_tabs"))
      .getAllByRole("button")
      .map(b => b.id);
    expect(ids.indexOf("tab_btn_reference")).toBe(ids.indexOf("tab_btn_progress") + 1);
    expect(ids.indexOf("tab_btn_reference")).toBe(ids.indexOf("tab_btn_ai") - 1);
  });

  it("押すまでは中身を出さない", () => {
    renderWithHandlers();
    expect(screen.queryByTestId("reference_tab")).toBeNull();
  });

  it("押すと3つの資料が並ぶ", async () => {
    const user = userEvent.setup();
    renderWithHandlers();
    await user.click(document.getElementById("tab_btn_reference")!);
    const panel = screen.getByTestId("reference_tab");
    for (const label of ["単語一覧辞書", "動詞の活用表", "文法ガイド"]) {
      expect(within(panel).getByText(label), label).toBeInTheDocument();
    }
  });

  it("それぞれの画面へ移れる", async () => {
    const user = userEvent.setup();
    const h = renderWithHandlers();
    await user.click(document.getElementById("tab_btn_reference")!);

    await user.click(document.getElementById("btn_reference_dictionary")!);
    expect(h.onOpenDictionary).toHaveBeenCalledTimes(1);

    await user.click(document.getElementById("btn_reference_verb_forms")!);
    expect(h.onOpenVerbForms).toHaveBeenCalledTimes(1);

    await user.click(document.getElementById("btn_reference_grammar")!);
    expect(h.onOpenGrammar).toHaveBeenCalledTimes(1);
  });

  it("何のための場所かを説明する", async () => {
    const user = userEvent.setup();
    renderWithHandlers();
    await user.click(document.getElementById("tab_btn_reference")!);
    const panel = screen.getByTestId("reference_tab");
    expect(within(panel).getByText(/解いていて分からなかったことを確かめる場所/)).toBeInTheDocument();
  });

  it("他のタブに切り替えると閉じる", async () => {
    const user = userEvent.setup();
    renderWithHandlers();
    await user.click(document.getElementById("tab_btn_reference")!);
    await user.click(document.getElementById("tab_btn_progress")!);
    expect(screen.queryByTestId("reference_tab")).toBeNull();
  });
});
