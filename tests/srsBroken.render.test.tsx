import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

/**
 * 保存されていた SRS データが壊れていても、アプリが開ける（issue #106）。
 *
 * 以前は quest_srs に `{"w1":null}` があると、復習の対象を数える useMemo の中で
 * isDue が TypeError を投げ、エラー画面になった。読み直しても同じデータで再発するので、
 * 利用者は二度と先へ進めなかった。
 */

vi.mock("../src/vocabulary", () => ({
  loadVocabulary: () => Promise.resolve(WORDS),
  loadedVocabulary: () => null
}));

const word = (id: string, w: string, t: string) => ({
  id, word: w, translation: t, level: "junior",
  sentence: `I like [_____].`, sentenceTranslation: "好きです。",
  pos: "noun", options: [t, "小さい", "重い", "速い"], sentenceOptions: [w, "small", "heavy", "fast"]
});
const WORDS = [word("j1", "apple", "りんご"), word("j2", "book", "本"), word("j3", "cat", "猫")];

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("壊れた quest_srs", () => {
  it("null や数値でない box が混ざっていても開け、正しい要素だけで復習を数える", async () => {
    localStorage.setItem("quest_srs", JSON.stringify({
      j1: null,
      j2: { box: "a", dueDate: "2020-01-01" },
      j3: { box: 1, dueDate: "2020-01-01", lastReview: "2019-12-31", reps: 1, lapses: 0 }
    }));
    const { default: App } = await import("../src/App");
    render(<App />);

    await waitFor(() => expect(document.getElementById("vocabulary_loading_screen")).toBeNull());
    expect(screen.queryByText("画面の表示中に問題が発生しました")).toBeNull();
    // 復習の対象は壊れていない j3 の1語だけ
    expect(await screen.findByTestId("tab_badge_today")).toHaveTextContent("1");
  });
});

describe("壊れた quest_vocab_custom（追加した単語）", () => {
  it("null や綴りの無い要素が混ざっていても開け、使える語だけを単語帳に入れる", async () => {
    // 読み込みは「配列であること」しか見ていなかったので、null が1件あるだけで
    // 単語帳を走査するところ（復習の対象・辞書の検索など）が例外を投げていた
    localStorage.setItem("quest_vocab_custom", JSON.stringify([
      null,
      "zebra",
      { id: "c1" },
      { id: "c2", word: "zebra", translation: "シマウマ", level: "junior" },
      { id: "j1", word: "duplicate", translation: "収録語と同じID" }
    ]));
    window.history.pushState({}, "", "/dictionary");
    const { default: App } = await import("../src/App");
    render(<App />);

    await waitFor(() => expect(document.getElementById("vocabulary_loading_screen")).toBeNull());
    expect(await screen.findByText("zebra", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText("画面の表示中に問題が発生しました")).toBeNull();
    expect(screen.queryByText("duplicate")).toBeNull();
    // 単語帳に入れられなかった要素は、次の保存で消える前に別のキーへ控えてある
    expect(JSON.parse(localStorage.getItem("quest_vocab_custom_rejected") || "[]")).toEqual([
      "zebra",
      { id: "c1" },
      { id: "j1", word: "duplicate", translation: "収録語と同じID" }
    ]);
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("quest_vocab_custom") || "[]").map((w: { id: string }) => w.id)).toEqual(["c2"])
    );
    window.history.pushState({}, "", "/");
  });
});
