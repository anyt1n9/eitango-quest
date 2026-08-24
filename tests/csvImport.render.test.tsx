import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../src/components/Dashboard";
import { makeWord, makeStats } from "./fixtures";
import { Word } from "../src/types";

/**
 * CSV からの単語の取り込み。
 *
 * 例文の穴あけは `src/fillIn.ts` の `toFillInSentence()` にまとめてあるが、
 * この経路だけが独自の処理を持っていた。そのため2つの穴があった。
 *
 *   - 例文に最初から `[_____]` があると穴あけを丸ごと省いていた。
 *     答えの綴りが本文に残ったまま出題される
 *   - 単語境界を見ずに置換していた。`art` を取り込むと `start` の
 *     一部まで穴になる
 *
 * `tests/importWords.test.ts` は AI・PDF 経由の正規化しか見ておらず、
 * ここは素通りしていた。
 */

const VOCAB = [makeWord({ id: "j1", word: "beautiful", level: "junior" })];

/** CSV を読み込ませて、保存された単語を返す */
async function importCsv(csv: string): Promise<Word[]> {
  const setVocabulary = vi.fn();
  vi.spyOn(window, "alert").mockImplementation(() => {});

  render(
    <Dashboard
      stats={makeStats()}
      setStats={vi.fn()}
      vocabulary={VOCAB}
      setVocabulary={setVocabulary}
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
      onStartSrsReview={vi.fn()}
    />
  );

  const user = userEvent.setup();
  await user.click(document.getElementById("btn_toggle_import_panel")!);
  const input = document.getElementById("csv_file_input") as HTMLInputElement;
  await user.upload(input, new File([csv], "words.csv", { type: "text/csv" }));

  // FileReader は非同期なので、保存が呼ばれるまで待つ
  await vi.waitFor(() => expect(setVocabulary).toHaveBeenCalled());
  const updater = setVocabulary.mock.calls[0][0];
  return typeof updater === "function" ? updater(VOCAB) : updater;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("CSVの例文の穴あけ", () => {
  it("答えの綴りを穴にする", async () => {
    const words = await importCsv("library,図書館,junior,I went to the library today.,今日は図書館に行った。");
    const added = words.find(w => w.word === "library")!;
    expect(added.sentence).toBe("I went to the [_____] today.");
  });

  it("すでに穴がある例文でも、答えが残っていれば穴にする", async () => {
    // ここが素通りしていた。穴があることを理由に穴あけを省いていたため、
    // 答えの見える問題が出ていた
    const words = await importCsv("library,図書館,junior,The library has [_____] books.,図書館には本がある。");
    const added = words.find(w => w.word === "library")!;
    expect(added.sentence).not.toMatch(/\blibrary\b/i);
    expect(added.sentence).toContain("[_____]");
  });

  it("他の語の一部は穴にしない", async () => {
    // 単語境界を見ていなかったので "start" の中の "art" まで置き換えていた
    const words = await importCsv("art,芸術,junior,We start the art class at noon.,正午に美術の授業を始める。");
    const added = words.find(w => w.word === "art")!;
    expect(added.sentence).toContain("start");
    expect(added.sentence).toBe("We start the [_____] class at noon.");
  });

  it("例文に答えが無ければ末尾に穴を足す", async () => {
    const words = await importCsv("library,図書館,junior,I read a book there.,そこで本を読んだ。");
    const added = words.find(w => w.word === "library")!;
    expect(added.sentence).toBe("I read a book there. [_____]");
  });

  it("例文が空なら定型の例文と訳を入れる", async () => {
    const words = await importCsv("library,図書館,junior");
    const added = words.find(w => w.word === "library")!;
    expect(added.sentence).toContain("[_____]");
    expect(added.sentenceTranslation).toContain("勉強したい");
  });

  it("例文があるのに訳が無いときは、定型の訳で埋めない", async () => {
    // 埋めると本文と訳が食い違う
    const words = await importCsv("library,図書館,junior,I went to the library today.");
    const added = words.find(w => w.word === "library")!;
    expect(added.sentenceTranslation).toBe("");
  });
});
