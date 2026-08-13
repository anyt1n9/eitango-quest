import type { ReactElement } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import StudyCalendar from "../src/components/StudyCalendar";
import SimpleMarkdown from "../src/components/SimpleMarkdown";
import ErrorBoundary from "../src/components/ErrorBoundary";
import { PrivacyPolicy, TermsOfService } from "../src/components/LegalPages";
import { todayStr } from "../src/srs";

/**
 * 小さな部品の描画。
 *
 * どれも1画面の一部だが、壊れても型検査は通る：
 *   - 学習カレンダーの連続日数の数え違い（今日まだ解いていない日の扱い）
 *   - AIの応答が Markdown のまま生で出る
 *   - 例外でアプリ全体が白紙になる
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** n日前の日付キー */
function daysAgo(n: number): string {
  return todayStr(new Date(Date.now() - n * DAY_MS));
}

function log(...days: number[]): Record<string, { count: number; correct: number }> {
  return Object.fromEntries(days.map(d => [daysAgo(d), { count: 10, correct: 8 }]));
}

describe("学習カレンダー", () => {
  it("今日から続いている日数を数える", () => {
    render(<StudyCalendar dailyLog={log(0, 1, 2)} dailyGoal={20} />);
    expect(within(screen.getByText(/連続学習/).closest("div")!).getByText("3")).toBeInTheDocument();
  });

  it("今日まだ解いていなくても、昨日までの連続は途切れない", () => {
    // ここを今日起点で数えると、朝いちばんに開いたとき記録が0に見える
    render(<StudyCalendar dailyLog={log(1, 2, 3)} dailyGoal={20} />);
    expect(within(screen.getByText(/連続学習/).closest("div")!).getByText("3")).toBeInTheDocument();
  });

  it("1日空いたら途切れる", () => {
    render(<StudyCalendar dailyLog={log(0, 2, 3)} dailyGoal={20} />);
    expect(within(screen.getByText(/連続学習/).closest("div")!).getByText("1")).toBeInTheDocument();
  });

  it("記録が無ければ0日", () => {
    render(<StudyCalendar dailyLog={{}} dailyGoal={20} />);
    expect(within(screen.getByText(/連続学習/).closest("div")!).getByText("0")).toBeInTheDocument();
  });

  it("累計と学習した日数を出す", () => {
    render(<StudyCalendar dailyLog={log(0, 1)} dailyGoal={20} />);
    expect(screen.getByText(/学習した日/).textContent).toContain("2");
    expect(screen.getByText(/累計解答/).textContent).toContain("20");
  });

  it("未来のマスには記録を出さない", () => {
    render(<StudyCalendar dailyLog={{}} dailyGoal={20} />);
    // 今日のマスには日付入りの説明が付く
    const today = document.querySelector(`[title^="${todayStr()}"]`);
    expect(today).toBeInTheDocument();
  });
});

describe("かんたんMarkdown", () => {
  it("見出しと太字を記号のまま出さない", () => {
    render(<SimpleMarkdown text={"## 今日の課題\n**動詞**が弱いです。"} />);
    expect(screen.getByText("今日の課題")).toBeInTheDocument();
    expect(screen.getByText("動詞").tagName).toBe("STRONG");
    expect(document.body.textContent).not.toContain("**");
    expect(document.body.textContent).not.toContain("##");
  });

  it("箇条書きを一覧にする", () => {
    render(<SimpleMarkdown text={"- 名詞\n- 動詞\n* 形容詞"} />);
    const items = screen.getAllByRole("listitem").map(li => li.textContent);
    expect(items).toEqual(["名詞", "動詞", "形容詞"]);
  });

  it("箇条書きのあとの本文を一覧に巻き込まない", () => {
    render(<SimpleMarkdown text={"- 名詞\nがんばりましょう。"} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("がんばりましょう。").tagName).toBe("P");
  });

  it("空文字でも落ちない", () => {
    expect(() => render(<SimpleMarkdown text="" />)).not.toThrow();
  });

  it("HTMLは文字として出す（差し込まれない）", () => {
    render(<SimpleMarkdown text={"<img src=x onerror=alert(1)>"} />);
    expect(document.querySelector("img")).toBeNull();
    expect(document.body.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});

describe("エラーバウンダリ", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React は捕捉した例外をコンソールにも出す。テストの出力を汚さないよう黙らせる
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  function Boom(): ReactElement {
    throw new Error("puzzle.filter is not a function");
  }

  it("ふだんは中身をそのまま出す", () => {
    render(<ErrorBoundary><p>ダッシュボード</p></ErrorBoundary>);
    expect(screen.getByText("ダッシュボード")).toBeInTheDocument();
  });

  it("例外が出ても白紙にせず、復帰の手段を出す", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText("画面の表示中に問題が発生しました")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再読み込みする" })).toBeInTheDocument();
    // 学習データが消えないことを伝える
    expect(document.body.textContent).toContain("失われません");
  });

  it("原因を画面に出す（問い合わせの手がかりにする）", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText("puzzle.filter is not a function")).toBeInTheDocument();
  });
});

describe("規約とプライバシー", () => {
  it("戻る手段を必ず持つ", () => {
    const onBack = vi.fn();
    const { unmount } = render(<PrivacyPolicy onBack={onBack} />);
    expect(screen.getByRole("button", { name: /戻る/ })).toBeInTheDocument();
    unmount();

    render(<TermsOfService onBack={onBack} />);
    expect(screen.getByRole("button", { name: /戻る/ })).toBeInTheDocument();
  });
});
