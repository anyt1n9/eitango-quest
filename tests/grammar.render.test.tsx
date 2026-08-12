import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Grammar from "../src/components/Grammar";
import { grammarTopics } from "../src/data/grammar";
import { makeWord } from "./fixtures";

/**
 * 文法ガイドの画面。
 *
 * 解説を「読んで終わり」にしないための作りになっているかを見る。
 * 練習問題が解けること、答え合わせで理由が出ること、
 * 全問正解して初めて仕上がりになり、それが保存されること。
 */

vi.mock("../src/data/wordUsage", () => ({
  wordUsage: {
    v_tell: { patterns: [14, 26] },
    v_walk: { patterns: [2] }
  }
}));

const VOCAB = [
  makeWord({ id: "v_tell", word: "tell", translation: "伝える", pos: "verb" }),
  makeWord({ id: "v_walk", word: "walk", translation: "歩く", pos: "verb" })
];

/** 解説データは遅延読み込みなので、目次が出るまで待つ */
async function renderGuide() {
  const onBackToDashboard = vi.fn();
  render(<Grammar vocabulary={VOCAB} onBackToDashboard={onBackToDashboard} />);
  await screen.findByText("文法ガイド");
  return { onBackToDashboard };
}

/** 練習問題を全問正解する */
async function clearAllQuestions(user: ReturnType<typeof userEvent.setup>, topicIndex: number) {
  const topic = grammarTopics[topicIndex];
  for (let qi = 0; qi < topic.questions.length; qi++) {
    await user.click(document.getElementById(`grammar_q${qi}_opt${topic.questions[qi].correctIndex}`)!);
  }
  return topic;
}

describe("目次", () => {
  it("すべての文法項目を並べる", async () => {
    await renderGuide();
    // 「次に読むとよい項目」にも題名が出るので、一覧の中だけを見る
    const list = screen.getByTestId("grammar_topic_list");
    for (const t of grammarTopics.slice(0, 5)) {
      expect(within(list).getByText(t.title), t.id).toBeInTheDocument();
    }
    expect(screen.getByText(new RegExp(`${grammarTopics.length} 項目`))).toBeInTheDocument();
  });

  it("レベルごとにまとめて見出しを付ける", async () => {
    await renderGuide();
    expect(screen.getAllByText("初級（中学）").length).toBeGreaterThan(0);
    expect(screen.getAllByText("上級（大・社会人）").length).toBeGreaterThan(0);
  });

  it("題名で検索できる", async () => {
    const user = userEvent.setup();
    await renderGuide();
    await user.type(screen.getByLabelText("文法項目を検索"), "受動態");
    const list = screen.getByTestId("grammar_topic_list");
    expect(within(list).getByText("受動態（be + 過去分詞）")).toBeInTheDocument();
    expect(within(list).queryByText("仮定法")).toBeNull();
  });

  it("条件に合う項目が無ければその旨を伝える", async () => {
    const user = userEvent.setup();
    await renderGuide();
    await user.type(screen.getByLabelText("文法項目を検索"), "存在しない項目");
    expect(screen.getByText("条件に合う項目が見つかりませんでした。")).toBeInTheDocument();
  });

  it("レベルで絞り込める", async () => {
    const user = userEvent.setup();
    await renderGuide();
    await user.click(screen.getByRole("button", { name: /^上級（大・社会人）/ }));
    const list = screen.getByTestId("grammar_topic_list");
    expect(within(list).queryByText("be動詞と一般動詞")).toBeNull();
    expect(within(list).getByText("省略・同格・挿入")).toBeInTheDocument();
  });

  it("ダッシュボードに戻れる", async () => {
    const user = userEvent.setup();
    const { onBackToDashboard } = await renderGuide();
    await user.click(screen.getByText("ダッシュボードに戻る"));
    expect(onBackToDashboard).toHaveBeenCalled();
  });
});

describe("項目の詳細", () => {
  it("説明・例文・よくある間違い・練習問題をすべて出す", async () => {
    const user = userEvent.setup();
    await renderGuide();
    const topic = grammarTopics[0];
    await user.click(document.getElementById(`grammar_topic_${topic.id}`)!);

    const sections = screen.getByTestId("grammar_sections");
    expect(within(sections).getByText(topic.sections[0].heading)).toBeInTheDocument();
    expect(within(sections).getByText(topic.sections[0].body)).toBeInTheDocument();

    const examples = screen.getByTestId("grammar_examples");
    expect(within(examples).getByText(topic.examples[0].english)).toBeInTheDocument();
    expect(within(examples).getByText(topic.examples[0].japanese)).toBeInTheDocument();

    const mistakes = screen.getByTestId("grammar_mistakes");
    expect(within(mistakes).getByText(topic.mistakes[0].wrong)).toBeInTheDocument();
    expect(within(mistakes).getByText(topic.mistakes[0].right)).toBeInTheDocument();
    expect(within(mistakes).getByText(topic.mistakes[0].why)).toBeInTheDocument();

    expect(screen.getByTestId("grammar_questions")).toBeInTheDocument();
  });

  it("一覧に戻れる", async () => {
    const user = userEvent.setup();
    await renderGuide();
    await user.click(document.getElementById(`grammar_topic_${grammarTopics[0].id}`)!);
    await user.click(screen.getByText("文法ガイドの一覧に戻る"));
    expect(screen.getByText("文法ガイド")).toBeInTheDocument();
  });

  it("その文型をとる動詞を収録語から引いて見せる", async () => {
    const user = userEvent.setup();
    await renderGuide();
    // 文型14（SVOO）を持つ「5つの文型」の項目
    await user.click(document.getElementById("grammar_topic_g_sentence_patterns")!);
    const box = await screen.findByTestId("grammar_verbs");
    expect(within(box).getByText("tell")).toBeInTheDocument();
    expect(within(box).getByText("伝える")).toBeInTheDocument();
  });

  it("その文法が出てくる長文を並べる", async () => {
    const user = userEvent.setup();
    await renderGuide();
    // 現在完了は収録している長文の多くに出てくる
    await user.click(document.getElementById("grammar_topic_g_present_perfect")!);
    const box = await screen.findByTestId("grammar_readings");
    expect(within(box).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("出てくる長文が無い項目には欄を出さない", async () => {
    const user = userEvent.setup();
    await renderGuide();
    // 冠詞は長文の目印にしていないので、結び付く長文は無い
    await user.click(document.getElementById("grammar_topic_g_noun_article")!);
    expect(screen.queryByTestId("grammar_readings")).toBeNull();
  });

  it("文型を持たない項目には動詞の欄を出さない", async () => {
    const user = userEvent.setup();
    await renderGuide();
    await user.click(document.getElementById("grammar_topic_g_noun_article")!);
    expect(screen.queryByTestId("grammar_verbs")).toBeNull();
  });
});

describe("練習問題", () => {
  it("正解すると理由が出る", async () => {
    const user = userEvent.setup();
    await renderGuide();
    const topic = grammarTopics[0];
    await user.click(document.getElementById(`grammar_topic_${topic.id}`)!);
    await user.click(document.getElementById(`grammar_q0_opt${topic.questions[0].correctIndex}`)!);
    expect(screen.getByText(new RegExp("正解。"))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(topic.questions[0].explanation))).toBeInTheDocument();
  });

  it("誤答すると正解を示したうえで理由を出す", async () => {
    const user = userEvent.setup();
    await renderGuide();
    const topic = grammarTopics[0];
    const wrong = topic.questions[0].correctIndex === 0 ? 1 : 0;
    await user.click(document.getElementById(`grammar_topic_${topic.id}`)!);
    await user.click(document.getElementById(`grammar_q0_opt${wrong}`)!);
    expect(screen.getByText(new RegExp(`正解は「${topic.questions[0].options[topic.questions[0].correctIndex]}」`))).toBeInTheDocument();
  });

  it("二重に回答できない", async () => {
    const user = userEvent.setup();
    await renderGuide();
    const topic = grammarTopics[0];
    await user.click(document.getElementById(`grammar_topic_${topic.id}`)!);
    await user.click(document.getElementById("grammar_q0_opt0")!);
    const q0 = screen.getByTestId("grammar_question_0");
    for (const b of within(q0).getAllByRole("button")) expect(b).toBeDisabled();
  });

  it("正解数を数える", async () => {
    const user = userEvent.setup();
    await renderGuide();
    const topic = grammarTopics[0];
    await user.click(document.getElementById(`grammar_topic_${topic.id}`)!);
    await user.click(document.getElementById(`grammar_q0_opt${topic.questions[0].correctIndex}`)!);
    expect(screen.getByText(`1 / ${topic.questions.length} 正解`)).toBeInTheDocument();
  });

  it("誤答は正解数に数えない", async () => {
    const user = userEvent.setup();
    await renderGuide();
    const topic = grammarTopics[0];
    const wrong = topic.questions[0].correctIndex === 0 ? 1 : 0;
    await user.click(document.getElementById(`grammar_topic_${topic.id}`)!);
    await user.click(document.getElementById(`grammar_q0_opt${wrong}`)!);
    expect(screen.getByText(`0 / ${topic.questions.length} 正解`)).toBeInTheDocument();
  });
});

describe("進捗", () => {
  it("全問正解すると仕上がりになる", async () => {
    const user = userEvent.setup();
    await renderGuide();
    const topic = grammarTopics[0];
    await user.click(document.getElementById(`grammar_topic_${topic.id}`)!);
    await clearAllQuestions(user, 0);
    expect(screen.getByText("仕上がり")).toBeInTheDocument();
  });

  it("仕上がりが保存され、一覧にも印が付く", async () => {
    const user = userEvent.setup();
    await renderGuide();
    const topic = grammarTopics[0];
    await user.click(document.getElementById(`grammar_topic_${topic.id}`)!);
    await clearAllQuestions(user, 0);
    await user.click(screen.getByText("文法ガイドの一覧に戻る"));

    expect(screen.getByLabelText("仕上がり")).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem("quest_grammar_progress") || "{}");
    expect(saved[topic.id]).toHaveLength(topic.questions.length);
  });

  it("仕上げた項目は「次に読むとよい項目」から外れる", async () => {
    const user = userEvent.setup();
    await renderGuide();
    const topic = grammarTopics[0];
    const suggestions = () => {
      const heading = screen.getByText("次に読むとよい項目");
      return heading.closest("div")!.parentElement!.textContent || "";
    };
    expect(suggestions()).toContain(topic.title);

    await user.click(document.getElementById(`grammar_topic_${topic.id}`)!);
    await clearAllQuestions(user, 0);
    await user.click(screen.getByText("文法ガイドの一覧に戻る"));
    expect(suggestions()).not.toContain(topic.title);
  });
});

describe("間違えた項目の記録", () => {
  /** 最初の練習問題を、正解／不正解を指定して解く */
  async function answerFirstQuestion(user: ReturnType<typeof userEvent.setup>, correct: boolean) {
    const topic = grammarTopics.find(t => t.id === "g_present_perfect")!;
    const q = topic.questions[0];
    const index = correct
      ? q.correctIndex
      : q.options.findIndex((_, i) => i !== q.correctIndex);
    await user.click(document.getElementById(`grammar_q0_opt${index}`)!);
    return topic;
  }

  it("間違えた項目が一覧に残る", async () => {
    // 以前は正解だけを数えていたので、間違えた項目と
    // まだ手を付けていない項目が見分けられなかった
    const user = userEvent.setup();
    await renderGuide();
    await user.click(document.getElementById("grammar_topic_g_present_perfect")!);
    const topic = await answerFirstQuestion(user, false);

    await user.click(document.getElementById("btn_grammar_detail_back")!);
    const list = await screen.findByTestId("grammar_wrong_topics");
    expect(within(list).getByText(topic.title)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("quest_grammar_wrong") || "[]"))
      .toContain("g_present_perfect");
  });

  it("一覧から間違えた項目を開き直せる", async () => {
    const user = userEvent.setup();
    await renderGuide();
    await user.click(document.getElementById("grammar_topic_g_present_perfect")!);
    await answerFirstQuestion(user, false);
    await user.click(document.getElementById("btn_grammar_detail_back")!);

    await user.click(document.getElementById("grammar_wrong_g_present_perfect")!);
    expect(document.getElementById("grammar_detail")).toBeInTheDocument();
  });

  it("正解しただけの項目は一覧に出さない", async () => {
    const user = userEvent.setup();
    await renderGuide();
    await user.click(document.getElementById("grammar_topic_g_present_perfect")!);
    await answerFirstQuestion(user, true);

    await user.click(document.getElementById("btn_grammar_detail_back")!);
    expect(screen.queryByTestId("grammar_wrong_topics")).toBeNull();
  });

  it("一覧の項目に要復習の印が付く", async () => {
    const user = userEvent.setup();
    await renderGuide();
    await user.click(document.getElementById("grammar_topic_g_present_perfect")!);
    await answerFirstQuestion(user, false);
    await user.click(document.getElementById("btn_grammar_detail_back")!);

    const row = document.getElementById("grammar_topic_g_present_perfect")!;
    expect(row).toHaveTextContent("要復習");
  });
});

describe("特定の項目を開いて入る", () => {
  it("長文や辞書から渡された項目をそのまま開く", async () => {
    render(<Grammar vocabulary={[]} onBackToDashboard={vi.fn()} initialTopicId="g_present_perfect" />);
    expect(await screen.findByText("現在完了（have + 過去分詞）", { selector: "h2" })).toBeInTheDocument();
    expect(document.getElementById("grammar_detail")).toBeInTheDocument();
  });

  it("指定が無ければ一覧から始まる", async () => {
    await renderGuide();
    expect(document.getElementById("grammar_detail")).toBeNull();
  });
});
