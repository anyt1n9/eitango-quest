import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VerbFormsScreen from "../src/components/VerbForms";
import { makeWord } from "./fixtures";
import { Word } from "../src/types";

/**
 * 動詞の活用表の画面。
 *
 * 活用の計算（src/verbForms.ts）は単体テストで固めてあるが、
 * その結果が「原形・過去形・過去分詞・ing形」の正しい列に入っているか、
 * 絞り込みと検索が効いているかは描画してみないと分からない。
 * 列がずれた表は、学習者にそのまま間違いを覚えさせる。
 */

function verb(over: Partial<Word>): Word {
  return makeWord({ pos: "verb", ...over });
}

const VERBS: Word[] = [
  verb({ id: "v_go", word: "go", translation: "行く", level: "junior" }),
  verb({ id: "v_buy", word: "buy", translation: "買う", level: "junior" }),
  verb({ id: "v_cut", word: "cut", translation: "切る", level: "junior" }),
  verb({ id: "v_come", word: "come", translation: "来る", level: "junior" }),
  verb({ id: "v_walk", word: "walk", translation: "歩く", level: "senior" }),
  verb({ id: "v_prefer", word: "prefer", translation: "〜の方を好む", level: "senior2" })
];

function renderScreen(vocabulary: Word[] = VERBS) {
  const onBackToDashboard = vi.fn();
  render(<VerbFormsScreen vocabulary={vocabulary} onBackToDashboard={onBackToDashboard} />);
  return { onBackToDashboard };
}

/** 表の行を「原形 → 4つの活用形と意味」の形で取り出す */
function rows(): Record<string, string[]> {
  const table = document.querySelector("table");
  if (!table) return {};
  const out: Record<string, string[]> = {};
  for (const tr of Array.from(table.querySelectorAll("tbody tr"))) {
    const tds = Array.from(tr.querySelectorAll("td"));
    const cells = tds.map(td => td.textContent || "");
    // 1列目は「原形＋発音ボタン＋変化の型」。最初の span が原形なのでそれを鍵にする
    const base = tds[0].querySelector("span")?.textContent?.trim() || "";
    out[base] = cells;
  }
  return out;
}

describe("活用表", () => {
  it("原形・過去形・過去分詞・ing形を正しい列に並べる", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole("button", { name: /^すべて/ }));
    const r = rows();

    expect(r["go"][1]).toBe("went");
    expect(r["go"][2]).toBe("gone");
    expect(r["go"][3]).toBe("going");
    expect(r["go"][4]).toBe("行く");

    expect(r["buy"].slice(1, 4)).toEqual(["bought", "bought", "buying"]);
    expect(r["cut"].slice(1, 4)).toEqual(["cut", "cut", "cutting"]);
    expect(r["come"].slice(1, 4)).toEqual(["came", "come", "coming"]);
    // 規則変化。語末の子音を重ねる語も表に出る
    expect(r["walk"].slice(1, 4)).toEqual(["walked", "walked", "walking"]);
    expect(r["prefer"].slice(1, 4)).toEqual(["preferred", "preferred", "preferring"]);
  });

  it("変化の型を各行に添える", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole("button", { name: /^すべて/ }));
    const r = rows();
    expect(r["go"][0]).toContain("ABC");    // go - went - gone
    expect(r["buy"][0]).toContain("ABB");   // buy - bought - bought
    expect(r["cut"][0]).toContain("AAA");   // cut - cut - cut
    expect(r["come"][0]).toContain("ABA");  // come - came - come
    expect(r["walk"][0]).toContain("規則変化");
  });

  it("型の意味を凡例で説明する", () => {
    renderScreen();
    for (const p of ["AAA", "ABA", "ABB", "ABC"]) {
      expect(screen.getAllByText(p).length).toBeGreaterThan(0);
    }
  });
});

describe("絞り込み", () => {
  it("初期表示は不規則動詞だけに絞る", () => {
    renderScreen();
    const r = rows();
    expect(Object.keys(r).sort()).toEqual(["buy", "come", "cut", "go"]);
    expect(r["walk"]).toBeUndefined();
  });

  it("変化の型で絞り込める", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole("button", { name: /^ABC/ }));
    expect(Object.keys(rows())).toEqual(["go"]);
  });

  it("レベルで絞り込める", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole("button", { name: /^すべて/ }));
    await user.click(screen.getByRole("button", { name: "中級2 (高2)" }));
    expect(Object.keys(rows())).toEqual(["prefer"]);
  });

  it("日本語訳でも活用形でも検索できる", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole("button", { name: /^すべて/ }));
    const box = screen.getByLabelText("動詞を検索");

    await user.type(box, "買う");
    expect(Object.keys(rows())).toEqual(["buy"]);

    await user.clear(box);
    await user.type(box, "went");   // 原形を知らなくても過去形から引ける
    expect(Object.keys(rows())).toEqual(["go"]);
  });

  it("条件に合う語が無ければその旨を伝える", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.type(screen.getByLabelText("動詞を検索"), "存在しない語");
    expect(screen.getByText("条件に合う動詞が見つかりませんでした。")).toBeInTheDocument();
    expect(document.querySelector("table")).toBeNull();
  });
});

describe("画面の操作", () => {
  it("活用をまとめて読み上げられる", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByLabelText("go の活用を発音する"));
    const spoken = vi.mocked(window.speechSynthesis.speak).mock.calls[0][0] as unknown as { text: string };
    expect(spoken.text).toBe("go, went, gone");
  });

  it("ダッシュボードに戻れる", async () => {
    const user = userEvent.setup();
    const { onBackToDashboard } = renderScreen();
    await user.click(screen.getByText("ダッシュボードに戻る"));
    expect(onBackToDashboard).toHaveBeenCalled();
  });

  it("動詞以外は表に載せない", () => {
    renderScreen([makeWord({ id: "n_apple", word: "apple", translation: "りんご", pos: "noun" })]);
    expect(within(document.getElementById("verb_forms_screen")!).getByText("0 語")).toBeInTheDocument();
  });
});
