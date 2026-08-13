import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReviewList from "../src/components/ReviewList";
import { makeWord } from "./fixtures";
import { Word } from "../src/types";

/**
 * 苦手単語の一覧。
 *
 * この画面は「間違えた語を集めた場所」なので、
 * 一覧に出す語の取り違え（消したはずの語が残る・別の語が混ざる）は
 * そのまま学習内容の取り違えになる。
 * 出題は形式を選んでクイズ画面にまかせる（この画面は入口だけを持つ）。
 */

const WORDS: Word[] = [
  makeWord({ id: "w1", word: "library", translation: "図書館" }),
  makeWord({ id: "w2", word: "station", translation: "駅" }),
  makeWord({ id: "w3", word: "bridge", translation: "橋" })
];

function renderList(props: Partial<ComponentProps<typeof ReviewList>> = {}) {
  const setWrongWords = vi.fn();
  const onBackToDashboard = vi.fn();
  const onStartReviewQuiz = vi.fn();

  render(
    <ReviewList
      vocabulary={WORDS}
      wrongWords={["w1", "w3"]}
      setWrongWords={setWrongWords}
      onBackToDashboard={onBackToDashboard}
      onStartReviewQuiz={onStartReviewQuiz}
      {...props}
    />
  );

  return { setWrongWords, onBackToDashboard, onStartReviewQuiz };
}

/** 一覧に出ている見出し語 */
function listed(): string[] {
  const loop = document.getElementById("wrong_words_loop");
  if (!loop) return [];
  return WORDS.map(w => w.word).filter(w => within(loop).queryAllByText(w).length > 0);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("一覧", () => {
  it("苦手に入っている語だけを並べる", () => {
    renderList();
    expect(listed()).toEqual(["library", "bridge"]);
  });

  it("苦手が無ければ、一覧も形式の選択も出さない", () => {
    renderList({ wrongWords: [] });
    expect(screen.getByText("苦手な単語はありません！")).toBeInTheDocument();
    expect(document.getElementById("wrong_words_loop")).toBeNull();
    expect(document.getElementById("review_format_section")).toBeNull();
  });

  it("消えた単語IDが残っていても落ちない", () => {
    // 収録データから消えた語のIDが苦手リストに残ることがある
    expect(() => renderList({ wrongWords: ["w1", "存在しないID"] })).not.toThrow();
    expect(listed()).toEqual(["library"]);
  });
});

describe("詳細", () => {
  it("押すまで意味を出さない", () => {
    renderList();
    expect(screen.queryByText("図書館")).not.toBeInTheDocument();
  });

  it("押すと意味と例文を出す（ここは答えを見せる場所）", async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByText("library"));
    expect(screen.getByText("図書館")).toBeInTheDocument();
    // 復習用の一覧なので、例文の穴には答えを埋めて見せる
    expect(screen.getByText(/【 library 】/)).toBeInTheDocument();
  });

  it("キーボードだけでも開ける", async () => {
    // カードは div なので、role と tabIndex が無いと Tab で辿り着けない
    const user = userEvent.setup();
    renderList();
    const card = screen.getByText("library").closest('[role="button"]')!;
    expect(card).toHaveAttribute("tabindex", "0");
    (card as HTMLElement).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("図書館")).toBeInTheDocument();
  });
});

describe("削除", () => {
  it("確かめてから消す", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { setWrongWords } = renderList();

    await user.click(screen.getAllByTitle("覚えたので削除")[0]);
    expect(confirm).toHaveBeenCalled();
    const updater = setWrongWords.mock.calls.at(-1)![0] as (p: string[]) => string[];
    expect(updater(["w1", "w3"])).toEqual(["w3"]);
    confirm.mockRestore();
  });

  it("取り消したら消さない", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { setWrongWords } = renderList();

    await user.click(screen.getAllByTitle("覚えたので削除")[0]);
    expect(setWrongWords).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("削除ボタンを押しても、詳細は開かない", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderList();
    await user.click(screen.getAllByTitle("覚えたので削除")[0]);
    expect(screen.queryByText("図書館")).not.toBeInTheDocument();
    confirm.mockRestore();
  });
});

describe("苦手克服テストの入口", () => {
  it("選んだ形式を伝える", async () => {
    const user = userEvent.setup();
    const { onStartReviewQuiz } = renderList();
    await user.click(within(document.getElementById("review_format_section")!)
      .getByText("四択"));
    expect(onStartReviewQuiz).toHaveBeenCalledWith("word");
  });
});
