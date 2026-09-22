import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import Dashboard from "../src/components/Dashboard";
import Reading from "../src/components/Reading";
import { makeWord, makeStats } from "./fixtures";

/**
 * localStorage へのアクセス自体が例外を投げる環境で、画面が出るか。
 *
 * Cookie を完全に塞いだ設定のブラウザや、埋め込み表示では
 * `localStorage.getItem` を呼んだだけで例外になる。
 * useState の初期化子で生のまま呼んでいると、そこで投げた例外を
 * ErrorBoundary が受け止めて「再読み込み」の画面になるが、
 * 読み直しても同じ初期化子がまた投げるため、利用者は二度と先へ進めない。
 * 保存できないことより、**開けないこと**のほうが重い。
 */

/** 触った瞬間に投げる localStorage */
function blockStorage() {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");
  const throwing = {
    get length(): number { throw new Error("blocked"); },
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
    clear() { throw new Error("blocked"); },
    key() { throw new Error("blocked"); }
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: throwing });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: throwing });
  return () => {
    if (original) Object.defineProperty(window, "localStorage", original);
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: window.localStorage });
  };
}

const VOCAB = [
  makeWord({ id: "j1", word: "beautiful", level: "junior" }),
  makeWord({ id: "j2", word: "quiet", level: "junior" })
];

function renderDashboard() {
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
      onStartSrsReview={vi.fn()}
    />
  );
}

afterEach(() => cleanup());

describe("localStorage が使えない環境", () => {
  it("ダッシュボードが開ける", () => {
    const restore = blockStorage();
    try {
      expect(() => renderDashboard()).not.toThrow();
      expect(document.getElementById("btn_junior_word")).toBeTruthy();
    } finally {
      restore();
    }
  });

  it("出題の設定は既定値で始まる（保存が読めなくても止まらない）", () => {
    const restore = blockStorage();
    try {
      renderDashboard();
      // 1回の問題数は既定の10問が選ばれている
      const picked = document.querySelector('[data-testid="count_picker"] button[aria-pressed="true"]');
      expect(picked?.textContent).toContain("10問");
    } finally {
      restore();
    }
  });

  it("長文の画面が開ける", () => {
    const restore = blockStorage();
    try {
      expect(() =>
        render(
          <Reading
            stats={makeStats()}
            setStats={vi.fn()}
            onBackToDashboard={vi.fn()}
            updateRankingScore={vi.fn()}
            vocabulary={VOCAB}
            wrongWords={[]}
            setWrongWords={vi.fn()}
            onOpenGrammar={vi.fn()}
            initialPassageId={null}
            onOpenPassageChange={vi.fn()}
          />
        )
      ).not.toThrow();
    } finally {
      restore();
    }
  });
});
