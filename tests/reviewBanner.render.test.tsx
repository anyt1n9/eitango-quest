import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../src/components/Dashboard";
import { makeWord, makeStats } from "./fixtures";

/**
 * 今日の復習の入口。
 *
 * 忘却曲線にもとづく復習はこのアプリでいちばん効く学習だが、
 * 入口はヘッダーの小さなボタン1つだけだった時期がある。
 * いまは長文・AI日記とともに「学習メニュー」にまとめ、
 * 押したときに一覧として出す（3つを大きな案内として積むと
 * スマホ幅で約800pxあり、その下の出題ボタンまで遠かったため）。
 *
 * まとめたことで復習が埋もれないよう、
 *   - 畳んだままでも復習の語数が見えること
 *   - 開けば他の2つと同じ並びにあり、見出し・説明・ボタンを持つこと
 *   - 押すと復習が始まること
 * を固定する。実際の見え方は e2e のコントラスト検査が見る。
 */

const VOCAB = [
  makeWord({ id: "j1", word: "beautiful", level: "junior" }),
  makeWord({ id: "j2", word: "quiet", level: "junior" })
];

function renderDashboard(props: Partial<ComponentProps<typeof Dashboard>> = {}) {
  const onStartSrsReview = vi.fn();
  render(
    <Dashboard
      stats={makeStats()}
      setStats={vi.fn()}
      vocabulary={VOCAB}
      setVocabulary={vi.fn()}
      solvedHistory={{}}
      srsData={{}}
      wrongWords={[]}
      onStartQuiz={vi.fn()}
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
      dueCount={0}
      onStartSrsReview={onStartSrsReview}
      {...props}
    />
  );
  return { onStartSrsReview };
}

/** 学習メニューを開く */
async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(document.getElementById("btn_toggle_study_menu")!);
}

function banner() {
  return screen.getByTestId("study_menu_srs");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("今日の復習の案内", () => {
  it("畳んでいる間も、復習する語数が見える", () => {
    // まとめた結果いちばん効く学習が埋もれる、ということが起きないようにする
    renderDashboard({ dueCount: 12 });
    expect(screen.queryByTestId("study_menu_list")).toBeNull();
    expect(within(document.getElementById("btn_toggle_study_menu")!).getByText(/復習 12 語/))
      .toBeInTheDocument();
  });

  it("押すと長文・AI日記とともに一覧が出る", async () => {
    const user = userEvent.setup();
    renderDashboard();
    expect(document.getElementById("btn_toggle_study_menu")).toHaveAttribute("aria-expanded", "false");

    await openMenu(user);
    expect(document.getElementById("btn_toggle_study_menu")).toHaveAttribute("aria-expanded", "true");

    const list = screen.getByTestId("study_menu_list");
    const reading = screen.getByTestId("study_menu_reading");
    const diary = screen.getByTestId("study_menu_diary");
    // 3つとも同じ一覧の中に、この順で並ぶ
    expect(list).toContainElement(reading);
    expect(list).toContainElement(diary);
    expect(list).toContainElement(banner());
    expect(diary.compareDocumentPosition(banner()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("もう一度押すと畳む", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await openMenu(user);
    await openMenu(user);
    expect(screen.queryByTestId("study_menu_list")).toBeNull();
  });

  it("他の案内と同じ形（見出し・説明・ボタン）を持つ", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await openMenu(user);
    expect(within(banner()).getByRole("heading")).toBeInTheDocument();
    expect(within(banner()).getByRole("button")).toBeInTheDocument();
    // 説明文があること（見出しとボタンだけの飾りにしない）
    expect(banner().textContent!.length).toBeGreaterThan(80);
  });

  it("復習する語があれば語数を出す", async () => {
    const user = userEvent.setup();
    renderDashboard({ dueCount: 12 });
    await openMenu(user);
    expect(within(banner()).getByText(/12 語が復習日/)).toBeInTheDocument();
    expect(within(banner()).getByRole("button", { name: /復習を始める/ })).toBeInTheDocument();
  });

  it("無ければ完了と伝え、様子を見に行ける", async () => {
    const user = userEvent.setup();
    renderDashboard({ dueCount: 0 });
    await openMenu(user);
    expect(within(banner()).getByText("今日は完了")).toBeInTheDocument();
    expect(within(banner()).getByRole("button", { name: /復習の状況を見る/ })).toBeInTheDocument();
  });

  it("押すと復習が始まる", async () => {
    const user = userEvent.setup();
    const { onStartSrsReview } = renderDashboard({ dueCount: 3 });
    await openMenu(user);
    await user.click(document.getElementById("dashboard_open_srs_review_btn")!);
    expect(onStartSrsReview).toHaveBeenCalledTimes(1);
  });

  it("押せる大きさがある（スマホでも指で押せる）", async () => {
    const user = userEvent.setup();
    renderDashboard({ dueCount: 3 });
    await openMenu(user);
    // 開くボタンと、中のボタンの両方
    expect(document.getElementById("btn_toggle_study_menu")!.className).toContain("min-h-11");
    expect(document.getElementById("dashboard_open_srs_review_btn")!.className).toContain("min-h-11");
  });
});

describe("学習メニューのアイコン", () => {
  /**
   * lucide の汎用アイコンを当てていたとき、「学習メニュー」の見出しと
   * その中の「長文ストーリー」がどちらも同じコンパスの絵だった。
   * 見出しと中の1項目が見分けられず、AIを使う機能はどれもキラキラで
   * 何をする場所なのかも分からなかった。
   * いまは場所ごとに描き起こしてある（src/components/AppIcons.tsx）。
   */
  function glyph(testId: string) {
    return screen.getByTestId(testId).querySelector("svg")!.innerHTML;
  }

  it("見出しと3つの項目が、それぞれ違う絵を使う", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await openMenu(user);

    const header = document.getElementById("btn_toggle_study_menu")!
      .querySelector("svg")!.innerHTML;
    const marks = [
      header,
      glyph("study_menu_reading"),
      glyph("study_menu_diary"),
      glyph("study_menu_srs")
    ];
    expect(new Set(marks).size, "同じ絵が2か所に出ている").toBe(4);
    for (const m of marks) expect(m.length).toBeGreaterThan(0);
  });
});

describe("ログインボーナス", () => {
  it("受け取りの入口はスタンプだけで、別のボタンは置かない", async () => {
    // スタンプと「受け取る！」ボタンの2か所から受け取れると、
    // 同じ操作の入口が分かれる。押す先はスタンプに一本化した
    const user = userEvent.setup();
    renderDashboard();
    await user.click(document.getElementById("tab_btn_bonus")!);

    expect(document.getElementById("btn_claim_bonus")).toBeNull();
    // 光っているだけでは押せることが伝わらないので、言葉でも示す
    expect(document.getElementById("claim_bonus_hint")).not.toBeNull();
  });

  it("受け取ったあとは、押す先の案内を出さない", async () => {
    const user = userEvent.setup();
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    renderDashboard({ stats: makeStats({ lastLoginDate: key }) });
    await user.click(document.getElementById("tab_btn_bonus")!);

    expect(document.getElementById("claim_bonus_hint")).toBeNull();
    expect(document.body.textContent).toContain("本日のログインボーナスはすべて獲得済み");
  });

  it("加点は関数形で行う（前の値に足す）", async () => {
    // 絶対値で書いていたため、二重に走っても偶然おかしくならなかっただけだった
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const setStats = vi.fn();
    renderDashboard({ setStats });

    await user.click(document.getElementById("tab_btn_bonus")!);
    await user.click(document.getElementById("btn_claim_bonus_day_2")!);

    const updater = setStats.mock.calls[0][0];
    expect(typeof updater, "関数を渡していない").toBe("function");
    const before = { score: 500, currentStreak: 0, lastLoginDate: null };
    const after = updater(before);
    expect(after.score).toBeGreaterThan(500);
    // すでに今日受け取っていれば何も足さない
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(updater({ ...before, lastLoginDate: key }).score).toBe(500);
    alertSpy.mockRestore();
  });

  it("その日のスタンプを押しても受け取れる", async () => {
    // 「受け取る」ボタンはスタンプ7個の下にあり、
    // スマホでは今日のスタンプを押してから目と指を下に運ぶことになる。
    // 今日ぶんのスタンプ自体を押しても受け取れるようにした
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const setStats = vi.fn();
    renderDashboard({ setStats });

    await user.click(document.getElementById("tab_btn_bonus")!);
    // 連続1日目なので、DAY1 は受取済み・DAY2 が今日ぶん
    await user.click(document.getElementById("btn_claim_bonus_day_2")!);

    expect(setStats).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  it("受け取り済みの日と、まだ先の日は押せない", async () => {
    // 押しても何も起きないものをボタンにすると、
    // 読み上げにも「ボタン」と伝わり、押せると誤解させる
    const user = userEvent.setup();
    renderDashboard();
    await user.click(document.getElementById("tab_btn_bonus")!);

    expect(document.getElementById("btn_claim_bonus_day_1"), "受取済みの日が押せる").toBeNull();
    expect(document.getElementById("btn_claim_bonus_day_3"), "先の日が押せる").toBeNull();
    const buttons = Array.from(document.querySelectorAll('[id^="btn_claim_bonus_day_"]'));
    expect(buttons.map(b => b.id), "押せるのは今日ぶんだけ").toEqual(["btn_claim_bonus_day_2"]);
  });

  it("スタンプを連打しても、受け取りは1回だけ", async () => {
    // checkCanClaimToday() は描画時点の stats を見るので、
    // 再描画の前に2回押すとどちらも通ってしまう。
    // 3連打で受け取りの処理が3回走り、お知らせも3つ出ていた
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const setStats = vi.fn();
    renderDashboard({ setStats });

    await user.click(document.getElementById("tab_btn_bonus")!);
    const stamp = document.getElementById("btn_claim_bonus_day_2")!;
    stamp.click();
    stamp.click();
    stamp.click();

    expect(setStats).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  it("受け取り済みの日には、その日ぶんのスタンプが無い", async () => {
    // 今日ぶんを受け取ったあとは、押せるスタンプが1つも無い状態になる
    const user = userEvent.setup();
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    renderDashboard({ stats: makeStats({ lastLoginDate: key }) });

    await user.click(document.getElementById("tab_btn_bonus")!);
    expect(document.querySelectorAll('[id^="btn_claim_bonus_day_"]').length).toBe(0);
  });
});
