import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeWord } from "./fixtures";
import { todayProps, TodayHarness } from "./todayProps";
import { LEVEL_TONE } from "../src/levelTheme";
import { LEVEL_LABELS } from "../src/levelLabels";
import { todayStr, tomorrowOf } from "../src/srs";

/**
 * 「今日」の画面（起動して最初に見える画面）の入口。
 *
 * 以前のダッシュボードは、5つのタブ・学習メニューの折りたたみ・レベルと問題数・
 * 7つの形式のボタン・単語の取り込みを1枚に積んでいて、スマホの最初の1画面に
 * 出題の開始ボタンがほとんど見えなかった。いまは「今日やること」だけを置き、
 * レベル・問題数・形式を「学習を始める」のすぐそばにまとめる。
 *
 * 「一問一答」だけが問題数を選ぶモーダルを開いていた時期もある。
 * 1回の問題数は1か所の設定で、7形式すべてがそれを使う。
 */

const VOCAB = [
  makeWord({ id: "j1", word: "beautiful", level: "junior" }),
  makeWord({ id: "j2", word: "quiet", level: "junior" })
];

function renderToday(overrides: Parameters<typeof todayProps>[0] = {}) {
  const props = todayProps({ vocabulary: VOCAB, ...overrides });
  render(<TodayHarness {...props} />);
  return props;
}

function levelSelect() {
  return document.getElementById("select_study_level") as HTMLSelectElement;
}

beforeEach(() => {
  localStorage.clear();
});


describe("1回の問題数", () => {
  it("選べる数を並べる", () => {
    renderToday();
    const picker = screen.getByTestId("count_picker");
    for (const label of ["10問", "50問", "100問"]) {
      expect(within(picker).getByText(label), label).toBeInTheDocument();
    }
  });

  it("既定は10問", () => {
    renderToday();
    expect(document.getElementById("btn_question_count_10")).toHaveAttribute("aria-pressed", "true");
  });

  it("選んだ数を App へ伝える（教材の画面と共有するため）", async () => {
    // 覚えておく（保存する）のは App の役目。保存は tests/studySettings.test.ts が見る
    const user = userEvent.setup();
    const { onQuestionCountChange } = renderToday();
    await user.click(document.getElementById("btn_question_count_50")!);
    expect(document.getElementById("btn_question_count_50")).toHaveAttribute("aria-pressed", "true");
    expect(onQuestionCountChange).toHaveBeenCalledWith(50);
  });

  it("渡された数で開く", () => {
    renderToday({ questionCount: 100 });
    expect(document.getElementById("btn_question_count_100")).toHaveAttribute("aria-pressed", "true");
  });

  it("開始ボタンに、何問・何分かを書く", async () => {
    const user = userEvent.setup();
    renderToday();
    const start = () => document.getElementById("btn_junior_word")!;
    expect(start()).toHaveTextContent("初級（中学）から10問・約1分");
    await user.click(document.getElementById("btn_question_count_50")!);
    expect(start()).toHaveTextContent("初級（中学）から50問・約5分");
  });
});

describe("7つの形式の入口", () => {
  const FORMATS: [string, string][] = [
    ["btn_junior_word", "word"],
    ["btn_junior_sentence", "sentence"],
    ["btn_junior_listening", "listening"],
    ["btn_junior_reverse", "reverse"],
    ["btn_junior_spelling", "spelling"],
    ["btn_junior_synonym", "synonym"],
    ["btn_junior_sense", "sense"]
  ];

  it("どの形式もすぐ始まる（片方だけモーダルを挟まない）", async () => {
    for (const [id, type] of FORMATS) {
      const user = userEvent.setup();
      const { onStartQuiz } = renderToday();
      await user.click(document.getElementById(id)!);
      expect(onStartQuiz, id).toHaveBeenCalledWith("junior", type, 10);
      screen.getByTestId("question_count_picker"); // まだ「今日」の画面にいる
      document.body.innerHTML = "";
    }
  });

  it("選んだ問題数がすべての形式に効く", async () => {
    const user = userEvent.setup();
    const { onStartQuiz } = renderToday();
    await user.click(document.getElementById("btn_question_count_50")!);

    await user.click(document.getElementById("btn_junior_spelling")!);
    expect(onStartQuiz).toHaveBeenCalledWith("junior", "spelling", 50);

    await user.click(document.getElementById("btn_junior_word")!);
    expect(onStartQuiz).toHaveBeenCalledWith("junior", "word", 50);
  });

  it("出題数を選ぶモーダルは残っていない", async () => {
    const user = userEvent.setup();
    renderToday();
    await user.click(document.getElementById("btn_junior_word")!);
    expect(document.getElementById("word_count_modal")).toBeNull();
  });

  it("リスニングと綴りの絵は、他の画面と同じ線画を使う", () => {
    // 絵文字（🎧 ✏️）は端末ごとに絵柄も色も違い、ほかの線画と並ぶと浮く。
    // 同じ描き方のアイコンに揃える（src/components/AppIcons.tsx）
    renderToday();
    const marks: string[] = [];
    for (const form of ["listening", "spelling"]) {
      const svg = document.getElementById(`btn_junior_${form}`)!.querySelector("svg");
      expect(svg, `${form} に絵が無い`).not.toBeNull();
      marks.push(svg!.innerHTML);
    }
    expect(new Set(marks).size, "2つの形式が同じ絵を使っている").toBe(2);
  });

  it("出題形式のボタンに絵文字を使わない", () => {
    // 国旗（🇯🇵）は端末によっては字の並び（JP）で出るなど見え方が定まらない
    renderToday();
    for (const [, form] of FORMATS) {
      const btn = document.getElementById(`btn_junior_${form}`)!;
      expect(btn.textContent, `${form} に絵文字が残っている`)
        .not.toMatch(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
  });
});

describe("レベル", () => {
  it("5つのレベルを、どの画面とも同じ呼び方で選べる", () => {
    // 以前は同じレベルが「中学」「初級 (中学生レベル)」「初級 (中学)」と画面ごとに違った
    renderToday();
    const options = Array.from(levelSelect().options).map(o => o.textContent ?? "");
    expect(options).toHaveLength(5);
    for (const label of Object.values(LEVEL_LABELS)) {
      expect(options.some(o => o.startsWith(label)), label).toBe(true);
    }
  });

  it("選ぶと、そのレベルで始まる", async () => {
    const user = userEvent.setup();
    const { onStartQuiz } = renderToday();
    await user.selectOptions(levelSelect(), "advanced");

    expect(document.getElementById("btn_junior_word")).toBeNull();
    expect(document.getElementById("btn_advanced_word")).toHaveTextContent(LEVEL_LABELS.advanced);
    await user.click(document.getElementById("btn_advanced_spelling")!);
    expect(onStartQuiz).toHaveBeenCalledWith("advanced", "spelling", 10);
  });

  it("開始ボタンと問題数は、選んでいるレベルの色になる", async () => {
    // 色そのものは CSS 側（.level-*）にあり、明るいテーマは森・暗いテーマは海で置き換わる
    const user = userEvent.setup();
    renderToday();
    const count = () => document.getElementById("btn_question_count_50")!;
    expect(count().className).toContain(LEVEL_TONE.junior);
    expect(document.getElementById("btn_junior_word")!.className).toContain(LEVEL_TONE.junior);

    await user.selectOptions(levelSelect(), "advanced");
    expect(count().className).toContain(LEVEL_TONE.advanced);
    expect(document.getElementById("btn_advanced_word")!.className).toContain(LEVEL_TONE.advanced);
    expect(count().className, "色を直に書いている").not.toMatch(/-(indigo|blue|amber)-\d/);

    // 選んでいる問題数は塗りつぶし、他は淡い地（レベルの色で）
    expect(document.getElementById("btn_question_count_10")!.className).toContain("bg-[var(--lv-solid)]");
    expect(count().className).toContain("bg-[var(--lv-bg)]");
  });

  it("選んだレベルを App へ伝える（教材の画面と共有するため）", async () => {
    const user = userEvent.setup();
    const { onLevelChange } = renderToday();
    await user.selectOptions(levelSelect(), "senior2");
    expect(onLevelChange).toHaveBeenCalledWith("senior2");
  });

  it("渡されたレベルで開く", () => {
    renderToday({ level: "senior3" });
    expect(levelSelect().value).toBe("senior3");
    expect(document.getElementById("btn_senior3_word")).toBeInTheDocument();
  });
});

describe("今日の復習", () => {
  it("復習がある日は、いちばん上に語数と開始ボタンを出す", async () => {
    const user = userEvent.setup();
    const { onStartSrsReview } = renderToday({ dueCount: 12 });
    const card = document.getElementById("today_review_card")!;
    expect(within(card).getByText("12語")).toBeInTheDocument();
    // 設定の台より前（上）にある
    const settings = document.getElementById("level_selection_section")!;
    expect(card.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(within(card).getByRole("button", { name: "復習を始める" }));
    expect(onStartSrsReview).toHaveBeenCalledTimes(1);
  });

  it("復習がある日は、塗りつぶしのボタンを復習の1つにする", () => {
    // 塗りつぶしが2つ並ぶと、どちらから手を付ければよいのか分からない
    renderToday({ dueCount: 12 });
    const start = document.getElementById("btn_junior_word")!;
    expect(start).toHaveTextContent("新しい単語を学ぶ");
    expect(start.className).not.toContain("bg-[var(--lv-solid)]");
    expect(start.className).not.toContain("glass-chip");
    expect(document.getElementById("today_headline")).toHaveTextContent("復習のあとに10問");
  });

  it("復習が無い日は、開始ボタンを主役にして、その旨を書く", () => {
    renderToday({ dueCount: 0 });
    expect(document.getElementById("today_review_card")).toBeNull();
    expect(document.getElementById("btn_junior_word")).toHaveTextContent("学習を始める");
    expect(document.getElementById("btn_junior_word")!.className).toContain("bg-[var(--lv-solid)]");
    // まだ何も解いていなければ、次の復習も無い
    expect(screen.getByTestId("today_review_status")).toHaveTextContent("まだありません");
  });

  it("押せる大きさがある（スマホでも指で押せる）", () => {
    renderToday({ dueCount: 3 });
    expect(document.getElementById("dashboard_open_srs_review_btn")!.className).toContain("min-h-12");
  });
});

describe("今日の進み具合", () => {
  it("今日の目標までの数を出す", () => {
    renderToday({ todayCount: 8, dailyGoal: 20 });
    expect(document.getElementById("today_goal_count")).toHaveTextContent("8 / 20問");
  });

  it("目標に届いたら、そう書く", () => {
    renderToday({ todayCount: 20, dailyGoal: 20 });
    expect(document.getElementById("today_goal_count")).toHaveTextContent("達成！");
  });

  it("苦手な単語があるときだけ、復習の入口を出す", async () => {
    const user = userEvent.setup();
    renderToday();
    expect(document.getElementById("btn_start_review")).toBeNull();

    document.body.innerHTML = "";
    const { onStartReview } = renderToday({ wrongWords: ["j1", "j2"] });
    expect(document.getElementById("review_banner")).toHaveTextContent("2語");
    await user.click(document.getElementById("btn_start_review")!);
    expect(onStartReview).toHaveBeenCalledTimes(1);
  });

  it("ログインボーナスを受け取っていなければ、記録の画面へ案内する", async () => {
    const user = userEvent.setup();
    const { onOpenRecords } = renderToday({ bonusClaimable: true });
    await user.click(document.getElementById("btn_go_bonus")!);
    expect(onOpenRecords).toHaveBeenCalledTimes(1);
  });

  it("受け取ったあとは案内を出さない", () => {
    renderToday({ bonusClaimable: false });
    expect(document.getElementById("today_bonus_hint")).toBeNull();
  });
});

describe("画面の詰まりを減らす", () => {
  it("ほかの画面の入口（学習メニュー・タブ・取り込み）は置かない", () => {
    // これらは画面下のタブ（教材・記録など）に移した
    renderToday();
    for (const id of ["btn_toggle_study_menu", "btn_toggle_import_panel", "tab_btn_progress", "tab_btn_bonus"]) {
      expect(document.getElementById(id), id).toBeNull();
    }
    expect(screen.queryByTestId("dashboard_tabs")).toBeNull();
    expect(screen.queryByTestId("calendar_in_bonus")).toBeNull();
  });

  it("英語の小見出しや等幅の数字を使わない", () => {
    // 「EXPLORE AND LEARN」「STORY XP PROGRESS」のような飾りの英語と等幅フォントは、
    // 学習アプリというより開発ツールのような印象になっていた
    renderToday({ wrongWords: ["j1"], dueCount: 2 });
    const page = document.getElementById("dashboard_page")!;
    expect(page.querySelector(".font-mono"), "等幅フォントが残っている").toBeNull();
    expect(page.textContent).not.toMatch(/[A-Z]{3,} [A-Z]{3,}/);
  });
});

/**
 * 「覚えた」は同じ語に2回正解して入る（src/mastery.ts）。はじめて解いた日は
 * 9問正解しても「覚えた0語・習熟度0%」のままで、記録が保存されていないように見えた。
 */
describe("解いたあとの手ごたえ", () => {
  const NINE = Array.from({ length: 9 }, (_, i) => makeWord({ id: `n${i}`, word: `word${i}`, level: "junior" }));
  const tomorrow = tomorrowOf(todayStr());
  const answeredOnce = Object.fromEntries(
    NINE.map(w => [w.id, { box: 1, dueDate: tomorrow, lastReview: todayStr(), reps: 1, lapses: 0 }])
  );

  it("1回正解した語を「覚えかけ」として数え、あと何をすれば「覚えた」に入るかを書く", () => {
    renderToday({ vocabulary: NINE, srsData: answeredOnce });
    expect(document.getElementById("level_mastery_summary")).toHaveTextContent("覚えた 0語・覚えかけ 9語 ／ 全 9語");
    expect(document.getElementById("learning_hint")).toHaveTextContent("もう1回正解すると「覚えた」に入ります");
  });

  it("覚えかけが無ければ、説明は出さない", () => {
    renderToday({ vocabulary: NINE });
    expect(document.getElementById("learning_hint")).toBeNull();
  });

  it("今日の復習が無い日は、次にいつ何語来るかを出す", () => {
    renderToday({ vocabulary: NINE, srsData: answeredOnce });
    expect(document.getElementById("next_review_text")).toHaveTextContent("今日はなし・明日に9語");
  });

  it("収録から外した語の古い記録は、次の復習に数えない", () => {
    renderToday({ vocabulary: NINE.slice(0, 3), srsData: answeredOnce });
    expect(document.getElementById("next_review_text")).toHaveTextContent("明日に3語");
  });
});

describe("今日の復習と苦手な単語の違い", () => {
  it("並べて出すときは、それぞれが何かを一言添える", () => {
    renderToday({ wrongWords: ["j1"] });
    expect(screen.getByTestId("today_review_status")).toHaveTextContent("解いた語を、忘れかけたころにもう一度出します");
    expect(document.getElementById("review_banner")).toHaveTextContent("間違えた語。いつでも解き直せて、復習で正解すると外れます");
  });
});
