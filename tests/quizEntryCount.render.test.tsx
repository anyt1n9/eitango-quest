import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";

/**
 * ダッシュボードで選んだ問題数が、実際に始まるクイズに届いているかの検査。
 *
 * ダッシュボードの側（onStartQuiz に数が渡ること）は dashboardEntry.render.test.tsx が見ている。
 * ここではその先、App がクイズ画面に数を渡しているところまでを通しで確かめる。
 * 例文穴埋めだけは App が数を渡しておらず、50問・100問を選んでも
 * 常に10問で終わっていた（部品の既定値10がそのまま使われていた）。
 */

const loadVocabulary = vi.fn();
vi.mock("../src/vocabulary", () => ({
  loadVocabulary: () => loadVocabulary(),
  loadedVocabulary: () => null
}));

/** 綴り（vi.mock の中からも使うので hoisted で先に作る） */
const { spell } = vi.hoisted(() => ({
  spell: (i: number) => `word${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`
}));

// 類義語・語義分別のデータも、この60語で組む
vi.mock("../src/data/synonyms", () => ({
  wordSynonyms: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [
    `t${i}`,
    { same: [`t${(i + 1) % 60}`], distractors: [`t${(i + 2) % 60}`, `t${(i + 3) % 60}`, `t${(i + 4) % 60}`] }
  ]))
}));
vi.mock("../src/data/senseQuiz", () => ({
  senseQuiz: Array.from({ length: 60 }, (_, i) => ({
    word: spell(i),
    senses: [
      { meaning: `意味A${i}`, example: `This is {${spell(i)}}.`, translation: "これです。" },
      { meaning: `意味B${i}`, example: `That is {${spell(i)}}.`, translation: "あれです。" }
    ]
  }))
}));

/** 60語。どの形式でも出題できる形にしておく */
const WORDS = Array.from({ length: 60 }, (_, i) => ({
  id: `t${i}`,
  word: spell(i),
  translation: `訳${i}`,
  level: "junior",
  sentence: `This is the [_____] number ${i}.`,
  sentenceTranslation: `これは${i}番目です。`,
  pos: "noun",
  options: [`訳${i}`, `訳${(i + 1) % 60}`, `訳${(i + 2) % 60}`, `訳${(i + 3) % 60}`],
  sentenceOptions: [`w${i}`, `w${i}x`, `w${i}y`, `w${i}z`]
})).map(w => ({ ...w, sentenceOptions: [w.word, ...w.sentenceOptions.slice(1)] }));

beforeEach(() => {
  localStorage.clear();
  loadVocabulary.mockReset();
  loadVocabulary.mockResolvedValue(WORDS);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
});

async function startFromDashboard(buttonId: string) {
  const { default: App } = await import("../src/App");
  render(<App />);
  // 画面は遅延読み込みなので、テストをまとめて走らせて重いときは1秒を超える
  await waitFor(() => {
    expect(document.getElementById(buttonId)).not.toBeNull();
  }, { timeout: 5000 });
  act(() => {
    (document.getElementById(buttonId) as HTMLButtonElement).click();
  });
}

describe("選んだ問題数でクイズが始まる", () => {
  for (const [label, buttonId] of [
    ["四択", "btn_junior_word"],
    ["例文穴埋め", "btn_junior_sentence"],
    ["日→英", "btn_junior_reverse"],
    ["綴り", "btn_junior_spelling"],
    ["類義語", "btn_junior_synonym"],
    ["語義分別", "btn_junior_sense"]
  ] as const) {
    it(`${label}: 50問を選ぶと50問出る`, async () => {
      localStorage.setItem("quest_question_count", "50");
      await startFromDashboard(buttonId);
      expect(await screen.findByText(/1 \/ 50/, {}, { timeout: 5000 })).toBeTruthy();
    });
  }
});
