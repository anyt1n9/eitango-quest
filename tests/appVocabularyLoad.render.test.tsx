import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * 起動時の単語データ読み込みが失敗したときの画面の検査。
 *
 * 単語データは 3.1MB の別チャンクなので、通信断やサービスワーカー更新の直後は
 * 取りに行けないことがある。以前は `.catch` が無く、失敗すると
 * 「単語データを読み込んでいます…」のまま何も起きず、
 * 読み直しても（失敗した約束が残るため）同じ状態から出られなかった。
 */

const loadVocabulary = vi.fn();
const reload = vi.fn();
vi.mock("../src/vocabulary", () => ({
  loadVocabulary: () => loadVocabulary(),
  loadedVocabulary: () => null
}));

const WORDS = [
  {
    id: "j1", word: "beautiful", translation: "美しい", level: "junior",
    sentence: "This flower is very [_____].", sentenceTranslation: "この花はとても美しい。",
    pos: "adjective", options: ["美しい", "小さい", "重い", "速い"],
    sentenceOptions: ["beautiful", "small", "heavy", "fast"]
  }
];

beforeEach(() => {
  localStorage.clear();
  loadVocabulary.mockReset();
  reload.mockReset();
  // jsdom の location.reload は呼ぶと未実装エラーになるので差し替える
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload }
  });
});

afterEach(() => {
  cleanup();
});

async function renderApp() {
  const { default: App } = await import("../src/App");
  return render(<App />);
}

describe("単語データの読み込みに失敗したとき", () => {
  it("待機画面のまま止まらず、失敗を伝えて押し直せる", async () => {
    loadVocabulary.mockRejectedValueOnce(new Error("chunk load failed"));
    await renderApp();

    const message = await screen.findByText(/単語データを読み込めませんでした/);
    expect(message).toBeTruthy();
    // 待ち続けている文言に戻っていないこと
    expect(screen.queryByText("単語データを読み込んでいます…")).toBeNull();

    /*
     * 押し直しは画面ごと開き直す。
     * 取得に失敗した動的 import はブラウザの module map に「失敗」として残り、
     * 同じ画面のまま import() を呼び直しても再取得されない
     * （実測: 押し直しでは通信が1回も出ず、開き直すと2回目の取得が走った）。
     * そのため「loadVocabulary をもう一度呼ぶ」ではなく reload を確かめる。
     */
    await userEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("読み込めているあいだは失敗の表示を出さない", async () => {
    loadVocabulary.mockResolvedValueOnce(WORDS);
    await renderApp();

    await waitFor(() => {
      expect(document.getElementById("vocabulary_loading_screen")).toBeNull();
    });
    expect(screen.queryByText(/単語データを読み込めませんでした/)).toBeNull();
  });
});
