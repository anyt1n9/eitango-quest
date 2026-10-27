import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Records from "../src/components/Records";
import { makeWord, makeStats } from "./fixtures";
import { ACCENT_TONE } from "../src/levelTheme";
import { todayStr } from "../src/srs";

/** 今日から n 日前の YYYY-MM-DD */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayStr(d);
}

/**
 * 記録の画面（画面下のタブの「記録」）。
 *
 * ダッシュボードの「記録」「ログインボーナス」「AIアドバイス」の3つのタブに
 * 分かれていたものを1枚にまとめた。毎日押すログインボーナスを先頭に置く。
 */

const VOCAB = [
  makeWord({ id: "j1", word: "beautiful", level: "junior" }),
  makeWord({ id: "j2", word: "quiet", level: "junior" })
];

function renderRecords(props: Partial<ComponentProps<typeof Records>> = {}) {
  const all: ComponentProps<typeof Records> = {
    // 連続1日目（昨日受け取った）。DAY1 は受取済み・DAY2 が今日ぶん
    stats: makeStats({ currentStreak: 1, lastLoginDate: daysAgo(1) }),
    setStats: vi.fn(),
    vocabulary: VOCAB,
    solvedHistory: {},
    srsData: {},
    wrongWords: [],
    ranking: [{ id: "me_id", name: "You", score: 0, avatar: "🏆", isMe: true }],
    setRanking: vi.fn(),
    dailyLog: {},
    dailyGoal: 20,
    equipped: {},
    onOpenGachaShop: vi.fn(),
    ...props
  };
  render(<Records {...all} />);
  return all;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("並び", () => {
  it("ログインボーナスを先頭に、学習カレンダーをその下に置く", () => {
    // カレンダーは縦に443pxある。毎日開くログインボーナスと並べて、続けた日が見えるようにする
    renderRecords();
    const bonus = document.getElementById("bonus_section")!;
    const panel = screen.getByTestId("calendar_in_bonus");
    expect(within(panel).getByRole("heading", { name: "学習カレンダー" })).toBeInTheDocument();
    expect(bonus.contains(panel)).toBe(true);
    const sections = ["bonus_section", "ranking_section", "ai_advisor_section"].map(id => document.getElementById(id)!);
    for (let i = 1; i < sections.length; i++) {
      expect(sections[i - 1].compareDocumentPosition(sections[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("貯めたポイントでガチャへ行ける", async () => {
    const user = userEvent.setup();
    const { onOpenGachaShop } = renderRecords();
    await user.click(document.getElementById("btn_open_gacha_from_ranking")!);
    expect(onOpenGachaShop).toHaveBeenCalledTimes(1);
  });
});

describe("AIアドバイスと弱点分析", () => {
  /**
   * この2つの欄だけ紫と赤で塗られていて、森にも海にも合っていなかった。
   * 色は他と同じ変数の組（--lv-*）で持ち、テーマごとに置き換わるようにする。
   */
  it("テーマの色を使う（紫・赤を直に書かない）", () => {
    renderRecords();
    const advice = document.getElementById("btn_get_advice")!;
    const weakness = document.getElementById("btn_get_weakness_analysis")!;
    expect(advice.className).toContain(ACCENT_TONE.advice);
    expect(weakness.className).toContain(ACCENT_TONE.weakness);
    for (const btn of [advice, weakness]) {
      expect(btn.className, "色を直に書いている").not.toMatch(/-(purple|rose|fuchsia)-\d/);
    }
    expect(document.getElementById("ai_advisor_section")!.innerHTML, "紫が残っている").not.toMatch(/-purple-\d/);
  });

  it("2つの欄は、それぞれ違う絵を使う", () => {
    renderRecords();
    const advice = document.getElementById("btn_get_advice")!.querySelector("svg");
    const weakness = document.getElementById("btn_get_weakness_analysis")!.querySelector("svg");
    expect(advice, "アドバイスに絵が無い").not.toBeNull();
    expect(weakness, "弱点分析に絵が無い").not.toBeNull();
    expect(advice!.innerHTML === weakness!.innerHTML, "同じ絵を使っている").toBe(false);
  });

  it("英語の小見出しを使わない", () => {
    renderRecords();
    const page = document.getElementById("records_page")!;
    for (const english of ["AI Study Advisor", "Weakness Analyzer", "My Records", "Daily Login Stamp Rally", "Study Calendar"]) {
      expect(page.textContent, english).not.toContain(english);
    }
  });
});

describe("ログインボーナス", () => {
  it("受け取りの入口はスタンプだけで、別のボタンは置かない", async () => {
    // スタンプと「受け取る！」ボタンの2か所から受け取れると、
    // 同じ操作の入口が分かれる。押す先はスタンプに一本化した
    const user = userEvent.setup();
    renderRecords();

    expect(document.getElementById("btn_claim_bonus")).toBeNull();
    // 光っているだけでは押せることが伝わらないので、言葉でも示す
    expect(document.getElementById("claim_bonus_hint")).not.toBeNull();
  });

  it("受け取ったあとは、押す先の案内を出さない", async () => {
    const user = userEvent.setup();
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    renderRecords({ stats: makeStats({ lastLoginDate: key }) });

    expect(document.getElementById("claim_bonus_hint")).toBeNull();
    expect(document.body.textContent).toContain("本日のログインボーナスはすべて獲得済み");
  });

  it("加点は関数形で行う（前の値に足す）", async () => {
    // 絶対値で書いていたため、二重に走っても偶然おかしくならなかっただけだった
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const setStats = vi.fn();
    renderRecords({ setStats });

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
    renderRecords({ setStats });

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
    renderRecords();

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
    renderRecords({ setStats });

    const stamp = document.getElementById("btn_claim_bonus_day_2")!;
    stamp.click();
    stamp.click();
    stamp.click();

    expect(setStats).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  /**
   * 保存している連続日数は「最後に受け取った日の時点」のもの。開いたまま日をまたぐと
   * 起動時の巻き戻しが走らず、途切れているのに「連続3日」と出したうえ、
   * 受け取ると「1日目」と言いながら4日目の点数（400P）を足していた。
   */
  it("途切れていれば、表示も点数も1日目から数え直す", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const setStats = vi.fn();
    renderRecords({ setStats, stats: makeStats({ score: 1000, currentStreak: 3, lastLoginDate: daysAgo(2) }) });

    const streakPanel = within(document.getElementById("self_records_panel")!);
    expect(streakPanel.getByText("連続ログイン").parentElement!.textContent).toContain("0日");
    const buttons = Array.from(document.querySelectorAll('[id^="btn_claim_bonus_day_"]'));
    expect(buttons.map(b => b.id), "今日ぶんが DAY1 になっていない").toEqual(["btn_claim_bonus_day_1"]);

    await user.click(document.getElementById("btn_claim_bonus_day_1")!);
    const after = setStats.mock.calls[0][0](makeStats({ score: 1000, currentStreak: 3, lastLoginDate: daysAgo(2) }));
    expect(after.score).toBe(1100);
    expect(after.currentStreak).toBe(1);
    expect(alertSpy.mock.calls[0][0]).toContain("+100 P");
    expect(alertSpy.mock.calls[0][0]).toContain("1日目");
    alertSpy.mockRestore();
  });

  it("続いていれば、次の日のスタンプと点数になる", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const setStats = vi.fn();
    renderRecords({ setStats, stats: makeStats({ currentStreak: 3, lastLoginDate: daysAgo(1) }) });

    await user.click(document.getElementById("btn_claim_bonus_day_4")!);
    expect(setStats.mock.calls[0][0](makeStats({ currentStreak: 3, lastLoginDate: daysAgo(1) })).currentStreak).toBe(4);
    expect(alertSpy.mock.calls[0][0]).toContain("+400 P");
    expect(alertSpy.mock.calls[0][0]).toContain("4日目");
    alertSpy.mockRestore();
  });

  it("受け取り済みの日には、その日ぶんのスタンプが無い", async () => {
    // 今日ぶんを受け取ったあとは、押せるスタンプが1つも無い状態になる
    const user = userEvent.setup();
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    renderRecords({ stats: makeStats({ lastLoginDate: key }) });

    expect(document.querySelectorAll('[id^="btn_claim_bonus_day_"]').length).toBe(0);
  });
});
