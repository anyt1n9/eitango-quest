import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../src/components/Dashboard";
import { makeWord, makeStats } from "./fixtures";

/**
 * 「AIで単語を1件ずつ自動追加」の連打。
 *
 * disabled が効くのは再描画のあとなので、ダブルクリックや Enter の連打では
 * 送信の処理が2本走る。どちらも押した時点の vocabulary を抱えているため、
 * 重複の確認（vocabulary.some(...)）は両方とも素通りし、
 * 同じ単語が別々のIDで2件登録される。クイズにも2件出て、
 * スコアのボーナス(+50)も二重に入り、AIの呼び出しも1回ぶん無駄になる。
 */

const AI_RESPONSE = {
  id: "ai_x1",
  word: "collaborate",
  translation: "協力する",
  level: "senior",
  pos: "verb",
  options: ["協力する", "拒否する", "記録する", "観察する"],
  sentence: "They [_____] on the project.",
  sentenceTranslation: "彼らはその企画で協力する。",
  sentenceOptions: ["collaborate", "refuse", "record", "observe"]
};

function renderDashboard() {
  const setVocabulary = vi.fn();
  const setStats = vi.fn();
  render(
    <Dashboard
      stats={makeStats()}
      setStats={setStats}
      vocabulary={[makeWord({ id: "j1", word: "beautiful", level: "junior" })]}
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
  return { setVocabulary, setStats };
}

/** AIの応答を遅らせて返す（押している最中の状態を作るため） */
function mockFetch(delayMs = 0) {
  const fn = vi.fn(() =>
    new Promise(resolve =>
      setTimeout(() => resolve({ ok: true, json: async () => ({ ...AI_RESPONSE }) }), delayMs)
    )
  );
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** AI追加のフォームは「Explore and Learn」を開くと出る */
async function openForm() {
  const user = userEvent.setup();
  await user.click(document.getElementById("btn_toggle_import_panel")!);
  return { user, input: document.getElementById("input_new_word") as HTMLInputElement };
}

describe("AI単語追加の連打", () => {
  it("2回続けて送っても、AIの呼び出しは1回だけ", async () => {
    const fetchMock = mockFetch(50);
    renderDashboard();
    const { user, input } = await openForm();
    expect(input, "AI追加のフォームが見つからない").toBeTruthy();

    await user.type(input, "collaborate");
    // 再描画を挟まずに2回送る（挟むと2回目は disabled になり、連打の再現にならない）
    const form = document.getElementById("add_word_form") as HTMLFormElement;
    act(() => {
      form.requestSubmit();
      form.requestSubmit();
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("単語の追加もスコアの加算も1回だけ", async () => {
    mockFetch(50);
    const { setVocabulary, setStats } = renderDashboard();
    const { user, input } = await openForm();

    await user.type(input, "collaborate");
    const form = document.getElementById("add_word_form") as HTMLFormElement;
    act(() => {
      form.requestSubmit();
      form.requestSubmit();
    });

    await waitFor(() => expect(setVocabulary).toHaveBeenCalled());
    expect(setVocabulary).toHaveBeenCalledTimes(1);
    expect(setStats).toHaveBeenCalledTimes(1);
  });

  it("追加し終われば、また追加できる", async () => {
    const fetchMock = mockFetch(0);
    renderDashboard();
    const { user, input } = await openForm();

    await user.type(input, "collaborate");
    await user.click(document.getElementById("btn_submit_add_word")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await user.type(document.getElementById("input_new_word") as HTMLInputElement, "evaluate");
    await user.click(document.getElementById("btn_submit_add_word")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
