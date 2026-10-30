import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import Grammar from "../src/components/Grammar";

/**
 * 文法データ（別チャンク）を読み込めなかったときの文法ガイド。
 *
 * loadGrammar() は失敗すると空の一覧を返す（長文や辞書の補足は、無くても学習を続けられるため）。
 * 文法ガイドは空の一覧をそのまま使っていたので、
 *   - 「間違えた項目」の掃除が「どの項目も見つからない」と判断して一覧を空にし、
 *     そのまま保存していた（通信が1回途切れただけで、間違えた記録が消える）
 *   - 画面は「0 項目」「条件に合う項目が見つかりませんでした」と出し、読み込みの失敗に見えなかった
 */

// 取り出しで投げる＝動的 import の失敗と同じく、loadGrammar の catch に入る
vi.mock("../src/data/grammar", () => ({
  get grammarTopics(): never {
    throw new Error("Failed to fetch dynamically imported module");
  }
}));

const reload = vi.fn();

beforeEach(() => {
  localStorage.clear();
  reload.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // jsdom の location.reload は呼ぶと未実装エラーになるので差し替える
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload }
  });
});

describe("文法データを読み込めなかったとき", () => {
  it("間違えた項目の記録を消さない", async () => {
    localStorage.setItem("quest_grammar_wrong", JSON.stringify(["present-perfect", "relative-pronoun"]));
    localStorage.setItem("quest_grammar_progress", JSON.stringify({ "present-perfect": [0] }));
    render(<Grammar vocabulary={[]} onBackToDashboard={vi.fn()} />);

    await screen.findByRole("alert");
    // 掃除の effect → 再描画 → 保存の effect まで流しきってから見る
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(JSON.parse(localStorage.getItem("quest_grammar_wrong")!)).toEqual(["present-perfect", "relative-pronoun"]);
    expect(JSON.parse(localStorage.getItem("quest_grammar_progress")!)).toEqual({ "present-perfect": [0] });
  });

  it("「0 項目」の目次ではなく、読み込めなかったことと押し直しを出す", async () => {
    const onBack = vi.fn();
    render(<Grammar vocabulary={[]} onBackToDashboard={onBack} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("文法データを読み込めませんでした");
    expect(screen.queryByText(/条件に合う項目が見つかりませんでした/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 項目/)).not.toBeInTheDocument();

    // 画面ごと開き直す（失敗した import() は同じ画面では取り直されない）
    screen.getByRole("button", { name: "もう一度読み込む" }).click();
    expect(reload).toHaveBeenCalledTimes(1);

    screen.getByRole("button", { name: "戻る" }).click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
