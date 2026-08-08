import { describe, it, expect, afterEach, vi } from "vitest";
import { shuffleQuestion } from "../src/readingQuiz";
import { passages, PassageQuestion } from "../src/data/passages";
import { seededRandom } from "./helpers";

/**
 * 長文読解の設問はデータ上、正解が必ず options[0] に置かれている。
 * 表示時の並べ替えが唯一の防波堤なので、ここを重点的に確認する。
 */

const Q: PassageQuestion = {
  question: "この物語の主人公は何をしましたか。",
  options: ["図書館へ行った", "海で泳いだ", "友人に手紙を書いた", "電車に乗り遅れた"],
  correctIndex: 0
};

afterEach(() => vi.restoreAllMocks());

describe("shuffleQuestion", () => {
  it("並べ替え後も correctIndex が正解の文言を指す", () => {
    for (let i = 0; i < 200; i++) {
      const s = shuffleQuestion(Q);
      expect(s.options[s.correctIndex]).toBe(Q.options[Q.correctIndex]);
    }
  });

  it("選択肢の顔ぶれと数が変わらない", () => {
    const s = shuffleQuestion(Q);
    expect(s.options).toHaveLength(Q.options.length);
    expect([...s.options].sort()).toEqual([...Q.options].sort());
  });

  it("設問文はそのまま", () => {
    expect(shuffleQuestion(Q).question).toBe(Q.question);
  });

  it("元の設問を書き換えない", () => {
    const snapshot = JSON.parse(JSON.stringify(Q));
    shuffleQuestion(Q);
    expect(Q).toEqual(snapshot);
  });

  it("正解の位置が4箇所に散らばる（先頭固定を解消できている）", () => {
    const spy = vi.spyOn(Math, "random").mockImplementation(seededRandom(4242));
    const counts = [0, 0, 0, 0];
    const N = 20000;
    for (let i = 0; i < N; i++) counts[shuffleQuestion(Q).correctIndex]++;
    spy.mockRestore();
    for (const c of counts) expect(Math.abs(c / N - 0.25)).toBeLessThan(0.02);
  });

  it("収録済みの全設問で正解が保たれる", () => {
    for (const p of passages) {
      for (const q of p.questions || []) {
        const s = shuffleQuestion(q);
        expect(s.options[s.correctIndex]).toBe(q.options[q.correctIndex]);
      }
    }
  });
});
