import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AIDiary from "../src/components/AIDiary";
import { makeWord } from "./fixtures";
import { Word } from "../src/types";

/**
 * AI英語日記。
 *
 * この画面はかつて、日記を1回作るだけで setSolvedHistory({}) を呼び、
 * 全学習履歴（習熟度・習得単語数）を消していた。
 * 「作れたか」ではなく「作っても学習データが減らないか」を固定する。
 *
 * 応答の形を確かめずに描くと diaryText.length で例外になり、
 * 画面がまるごと失われる点も MapAndPuzzle と同じ。
 */

const WORDS: Word[] = Array.from({ length: 220 }, (_, i) =>
  makeWord({ id: `w${i}`, word: `word${i}`, translation: `意味${i}` })
);

/** 全語を習得済みにする（解放条件は200語） */
const MASTERED = Object.fromEntries(
  WORDS.map(w => [w.id, { correctCount: 3, attemptCount: 3 }])
);

const OK_RESPONSE = {
  title: "A Quiet Morning",
  diaryText: "I walked to the library and read a book.",
  diaryTranslation: "図書館まで歩いて本を読んだ。",
  usedWords: ["library", "book"]
};

function mockFetch(body: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => body });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function renderDiary(solvedHistory: Record<string, { correctCount: number; attemptCount: number }> = MASTERED) {
  const setSolvedHistory = vi.fn();
  const onBackToDashboard = vi.fn();
  render(
    <AIDiary
      vocabulary={WORDS}
      solvedHistory={solvedHistory}
      srsData={{}}
      setSolvedHistory={setSolvedHistory}
      onBackToDashboard={onBackToDashboard}
    />
  );
  return { setSolvedHistory, onBackToDashboard };
}

async function generate() {
  const user = userEvent.setup();
  await user.click(document.getElementById("generator_diary_btn")!);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("解放の条件", () => {
  it("200語に届いていなければ作らせない", () => {
    mockFetch(OK_RESPONSE);
    renderDiary({});
    expect(document.getElementById("generator_diary_btn")).toBeNull();
  });

  it("200語を超えたら作れる", () => {
    mockFetch(OK_RESPONSE);
    renderDiary();
    expect(document.getElementById("generator_diary_btn")).toBeInTheDocument();
  });
});

describe("日記を作る", () => {
  it("習得した単語を送る", async () => {
    const fetchMock = mockFetch(OK_RESPONSE);
    renderDiary();
    await generate();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.words).toHaveLength(WORDS.length);
    expect(body.words).toContain("word0");
  });

  it("作っても学習履歴を消さない", async () => {
    // ここで setSolvedHistory({}) を呼んでいたため、
    // 日記を1回作るだけで習熟度と習得単語数がすべて0に戻っていた
    mockFetch(OK_RESPONSE);
    const { setSolvedHistory } = renderDiary();
    await generate();

    expect((await screen.findAllByText(/A Quiet Morning/)).length).toBeGreaterThan(0);
    expect(setSolvedHistory).not.toHaveBeenCalled();
  });

  it("本文と訳を出す", async () => {
    mockFetch(OK_RESPONSE);
    renderDiary();
    await generate();
    expect(await screen.findByText(/I walked to the library/)).toBeInTheDocument();
    expect(screen.getByText(/図書館まで歩いて本を読んだ。/)).toBeInTheDocument();
  });

  it("作った日記を履歴に残す", async () => {
    mockFetch(OK_RESPONSE);
    renderDiary();
    await generate();
    await screen.findAllByText(/A Quiet Morning/);

    const saved = JSON.parse(localStorage.getItem("quest_diary_history") || "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0].title).toBe("A Quiet Morning");
  });
});

describe("AIの応答が壊れているとき", () => {
  it("本文が無ければ、画面を壊さず理由を出す", async () => {
    mockFetch({ title: "空の日記" });
    renderDiary();
    await generate();
    expect(await screen.findByText(/AIの応答を解釈できませんでした/)).toBeInTheDocument();
  });

  it("本文が空文字でも断る", async () => {
    mockFetch({ diaryText: "   " });
    renderDiary();
    await generate();
    expect(await screen.findByText(/AIの応答を解釈できませんでした/)).toBeInTheDocument();
  });

  it("題や訳が欠けていても、本文があれば出す", async () => {
    mockFetch({ diaryText: "I read a book." });
    renderDiary();
    await generate();
    expect((await screen.findAllByText(/I read a book./)).length).toBeGreaterThan(0);
    // 題が無ければ既定の題を使う
    expect(screen.getAllByText(/My customized diary/).length).toBeGreaterThan(0);
  });

  it("使った単語が配列でなくても落ちない", async () => {
    mockFetch({ diaryText: "I read a book.", usedWords: "library" });
    renderDiary();
    await generate();
    expect((await screen.findAllByText(/I read a book./)).length).toBeGreaterThan(0);
  });

  it("サーバーが断ったら理由をそのまま伝える", async () => {
    mockFetch({ error: "AI機能は現在利用できません（APIキー未設定）" }, false);
    renderDiary();
    await generate();
    expect(await screen.findByText(/APIキー未設定/)).toBeInTheDocument();
  });

  it("壊れた履歴が保存されていても開ける", async () => {
    localStorage.setItem("quest_diary_history", '{"これは":"配列ではない"}');
    mockFetch(OK_RESPONSE);
    expect(() => renderDiary()).not.toThrow();
  });
});

describe("保存済みの日記が壊れているとき", () => {
  /**
   * 保存値をそのまま DiaryEntry として使っていた。描画側は
   * diary.diaryText.length や diary.usedWords.length を無条件に読むので、
   * 形の違う値が入っていると開くたびに例外で落ちる。
   * しかも壊れた値は消えないので、読み込み直しても同じ結果になり、
   * 利用者は自力で抜け出せない。
   */
  const BROKEN = [
    ["usedWords が無い", '{"id":"d1","diaryText":"Today I studied."}'],
    ["diaryText が無い", '{"id":"d1","usedWords":["library"]}'],
    ["diaryText が文字列でない", '{"id":"d1","diaryText":123,"usedWords":[]}'],
    ["そもそも配列", "[1,2,3]"],
    ["文字列だけ", '"日記"']
  ];

  it.each(BROKEN)("%s ときは、その記録を捨てて開ける", (_name, raw) => {
    localStorage.setItem("quest_current_diary_cache", raw);
    mockFetch(OK_RESPONSE);
    expect(() => renderDiary()).not.toThrow();
    // 壊れた記録を表示しようとしていない（作る前の画面が出る）
    expect(document.body.textContent).not.toContain("Today I studied");
  });

  it("形が合っていれば、そのまま読み出す", () => {
    localStorage.setItem(
      "quest_current_diary_cache",
      JSON.stringify({
        id: "d1", date: "2026年8月24日", title: "My day",
        diaryText: "Today I visited the library.", diaryTranslation: "今日は図書館に行った。",
        usedWords: ["library"]
      })
    );
    mockFetch(OK_RESPONSE);
    renderDiary();
    // 覚えた語は色を変えるため文が複数の要素に割れる。まとめた文字列で見る
    expect(document.body.textContent).toContain("Today I visited the library.");
    expect(screen.getByText("My day")).toBeInTheDocument();
  });

  it("履歴の中に壊れた記録が混ざっていても、残りは読める", () => {
    localStorage.setItem("quest_diary_history", JSON.stringify([
      { id: "ok", date: "2026年8月24日", title: "読める記録", diaryText: "Fine.", diaryTranslation: "", usedWords: [] },
      { id: "ng", title: "壊れた記録" }
    ]));
    mockFetch(OK_RESPONSE);
    expect(() => renderDiary()).not.toThrow();
  });
});
