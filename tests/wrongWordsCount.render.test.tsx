import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * 苦手な単語の語数は、どの画面でも一覧と同じ数にする。
 *
 * 苦手な単語は ID で保存している。収録から外した語（不適切な語の見出しなど）や、
 * 読み込みで捨てた追加単語の ID も保存には残るので、ID の数をそのまま出していた
 * 「今日」「教材」は「苦手な単語 3語」と出し、開いた一覧（単語帳にある語だけを並べる）は
 * 「1 語」だった。全部が外れた語なら、「今日」に行があるのに一覧は「ありません」になる。
 */

vi.mock("../src/vocabulary", () => ({
  loadVocabulary: () => Promise.resolve(WORDS),
  loadedVocabulary: () => null
}));

const WORDS = [
  {
    id: "j1", word: "apple", translation: "りんご", level: "junior",
    sentence: "I like [_____].", sentenceTranslation: "りんごが好きです。",
    pos: "noun", options: ["りんご", "小さい", "重い", "速い"], sentenceOptions: ["apple", "small", "heavy", "fast"]
  }
];

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, "", "/");
});
afterEach(() => cleanup());

async function renderApp() {
  const { default: App } = await import("../src/App");
  render(<App />);
  await waitFor(() => expect(document.getElementById("vocabulary_loading_screen")).toBeNull());
}

describe("単語帳に無い語の ID が苦手な単語に残っているとき", () => {
  it("「今日」「教材」「一覧」が同じ語数を出す", async () => {
    localStorage.setItem("quest_wrong_words", JSON.stringify(["j1", "removed_headword", "gone_custom"]));
    await renderApp();
    const user = userEvent.setup();

    expect(document.getElementById("review_banner")).toHaveTextContent("1語");

    await user.click(document.getElementById("tab_learn")!);
    // 教材の画面は開いたときに読み込む
    await waitFor(() => expect(document.getElementById("btn_learn_wrong_words")).not.toBeNull());
    expect(document.getElementById("btn_learn_wrong_words")).toHaveTextContent("間違えた 1語を復習");

    await user.click(document.getElementById("btn_learn_wrong_words")!);
    expect(await screen.findByText("1 語")).toBeInTheDocument();
  });

  it("どれも単語帳に無ければ、「今日」に苦手な単語の行を出さない（一覧は「ありません」）", async () => {
    localStorage.setItem("quest_wrong_words", JSON.stringify(["removed_headword"]));
    await renderApp();
    expect(document.getElementById("review_banner")).toBeNull();
  });

  it("保存からは消さない（数えるときだけ除く）", async () => {
    localStorage.setItem("quest_wrong_words", JSON.stringify(["j1", "removed_headword"]));
    await renderApp();
    expect(JSON.parse(localStorage.getItem("quest_wrong_words")!)).toEqual(["j1", "removed_headword"]);
  });
});
