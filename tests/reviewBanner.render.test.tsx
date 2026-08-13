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
 * 入口はヘッダーの小さなボタン1つだけで、長文や AI日記のような
 * 目立つ案内が無かった。ダッシュボードに同じ大きさの案内を置く。
 *
 * 大きさそのものは見た目の話なので、ここでは
 *   - 他の案内と同じ形（見出し・説明・ボタン）を持つこと
 *   - 対象語数を出すこと
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

function banner() {
  return document.getElementById("srs_review_banner")!;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("今日の復習の案内", () => {
  it("長文・AI日記と同じ並びに置く", () => {
    renderDashboard();
    const reading = document.getElementById("reading_banner")!;
    const diary = document.getElementById("diary_banner_dashboard")!;
    expect(banner()).toBeInTheDocument();
    // 3つとも同じ親の中に、この順で並ぶ
    expect(reading.parentElement).toBe(banner().parentElement);
    expect(diary.parentElement).toBe(banner().parentElement);
    expect(diary.compareDocumentPosition(banner()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("他の案内と同じ形（見出し・説明・ボタン）を持つ", () => {
    renderDashboard();
    expect(within(banner()).getByRole("heading")).toBeInTheDocument();
    expect(within(banner()).getByRole("button")).toBeInTheDocument();
    // 説明文があること（見出しとボタンだけの飾りにしない）
    expect(banner().textContent!.length).toBeGreaterThan(80);
  });

  it("復習する語があれば語数を出す", () => {
    renderDashboard({ dueCount: 12 });
    expect(within(banner()).getByText(/12 語が復習日/)).toBeInTheDocument();
    expect(within(banner()).getByRole("button", { name: /復習を始める/ })).toBeInTheDocument();
  });

  it("無ければ完了と伝え、様子を見に行ける", () => {
    renderDashboard({ dueCount: 0 });
    expect(within(banner()).getByText("今日は完了")).toBeInTheDocument();
    expect(within(banner()).getByRole("button", { name: /復習の状況を見る/ })).toBeInTheDocument();
  });

  it("押すと復習が始まる", async () => {
    const user = userEvent.setup();
    const { onStartSrsReview } = renderDashboard({ dueCount: 3 });
    await user.click(document.getElementById("dashboard_open_srs_review_btn")!);
    expect(onStartSrsReview).toHaveBeenCalledTimes(1);
  });

  it("押せる大きさがある（スマホでも指で押せる）", () => {
    renderDashboard({ dueCount: 3 });
    const btn = document.getElementById("dashboard_open_srs_review_btn")!;
    // 他の案内のボタンと同じ最小の高さを使う
    expect(btn.className).toContain("min-h-11");
  });
});

describe("ログインボーナス", () => {
  it("すばやく2回押しても、受け取りは1回だけ", async () => {
    // checkCanClaimToday() は描画時点の stats を見るので、
    // 再描画の前に2回押すとどちらも通ってしまう。
    // 3連打で受け取りの処理が3回走り、お知らせも3つ出ていた
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const setStats = vi.fn();
    const setRanking = vi.fn();
    renderDashboard({ setStats, setRanking });

    await user.click(document.getElementById("tab_btn_bonus")!);
    const claim = document.getElementById("btn_claim_bonus")!;
    claim.click();
    claim.click();
    claim.click();

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(setStats).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  it("加点は関数形で行う（前の値に足す）", async () => {
    // 絶対値で書いていたため、二重に走っても偶然おかしくならなかっただけだった
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const setStats = vi.fn();
    renderDashboard({ setStats });

    await user.click(document.getElementById("tab_btn_bonus")!);
    await user.click(document.getElementById("btn_claim_bonus")!);

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
});
