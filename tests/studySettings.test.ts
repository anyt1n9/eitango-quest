import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { readQuestionCount, saveQuestionCount, readStudyLevel, saveStudyLevel, levelCounts } from "../src/studySettings";
import { makeWord } from "./fixtures";

/**
 * 学習のレベルと1回の問題数の保存。
 *
 * 「今日」と「教材」の両方が使う設定で、App が1つの state として持ち、
 * 保存は「次に開いたときに覚えておく」ためだけに使う。
 * 中学以外で学習している人が、開くたびに選び直さなくてよいように。
 */

/** localStorage の最小実装（node 環境には無い） */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
}
const store = new MemoryStorage();
(globalThis as any).localStorage = store;
afterAll(() => { delete (globalThis as any).localStorage; });
beforeEach(() => store.clear());

describe("1回の問題数", () => {
  it("既定は10問", () => {
    expect(readQuestionCount()).toBe(10);
  });

  it("保存した数で開き直す", () => {
    saveQuestionCount(100);
    expect(readQuestionCount()).toBe(100);
  });

  it("選べない数や壊れた値は既定に戻す", () => {
    for (const bad of ["abc", "7", "", "-50"]) {
      store.setItem("quest_question_count", bad);
      expect(readQuestionCount(), bad).toBe(10);
    }
  });
});

describe("学習のレベル", () => {
  it("既定は初級", () => {
    expect(readStudyLevel()).toBe("junior");
  });

  it("保存したレベルで開き直す", () => {
    saveStudyLevel("senior2");
    expect(readStudyLevel()).toBe("senior2");
  });

  it("壊れた値は初級に戻す", () => {
    store.setItem("quest_selected_level", "SENIOR");
    expect(readStudyLevel()).toBe("junior");
  });
});

describe("保存を塞いだ環境", () => {
  it("読めなくても既定値で始まる（例外を投げない）", () => {
    const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
    (globalThis as any).localStorage = throwing;
    try {
      expect(readQuestionCount()).toBe(10);
      expect(readStudyLevel()).toBe("junior");
      expect(() => saveQuestionCount(50)).not.toThrow();
      expect(() => saveStudyLevel("senior")).not.toThrow();
    } finally {
      (globalThis as any).localStorage = store;
    }
  });
});

describe("レベルごとの数", () => {
  it("習得済みは間隔反復の箱2以上で数える", () => {
    const words = [
      makeWord({ id: "a", word: "a", level: "junior" }),
      makeWord({ id: "b", word: "b", level: "junior" }),
      makeWord({ id: "c", word: "c", level: "senior" })
    ];
    const srs = { a: { box: 2, dueDate: "2099-01-01", lastReview: "2026-01-01", reps: 2, lapses: 0 } };
    expect(levelCounts(words, "junior", {}, srs)).toEqual({ total: 2, completed: 0, correct: 1, masterRate: 50 });
    expect(levelCounts(words, "advanced", {}, srs).masterRate).toBe(0);
  });
});
