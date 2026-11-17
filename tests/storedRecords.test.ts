import { describe, it, expect } from "vitest";
import { sanitizeDailyLog, sanitizeRanking } from "../src/storedRecords";

/**
 * 保存されていたランキング・学習ログの読み込み（#151・#152）。
 * 読み込み（readStoredArray / readStoredObject）は配列・オブジェクトであることしか見ず、
 * バックアップの復元も値が文字列かしか見ないので、形の合わない要素がそのまま画面に届いていた。
 */
describe("sanitizeRanking", () => {
  it("null・id の無いもの・点数が数でないものを捨て、残りはそのまま", () => {
    const me = { id: "me", name: "あなた", score: 10, avatar: "M", isMe: true };
    const rival = { id: "r1", name: "R", score: 20, avatar: "R" };
    expect(sanitizeRanking([null, me, "x", { name: "no id", score: 1 }, { id: "nan", score: NaN }, { id: "s", score: "9" }, rival]))
      .toEqual([me, rival]);
  });

  it("名前や絵が欠けていても、空の文字にして残す（描くときに落ちない）", () => {
    expect(sanitizeRanking([{ id: "r", score: 5 }])).toEqual([{ id: "r", name: "", score: 5, avatar: "" }]);
  });

  it("isMe は true のときだけ付ける", () => {
    expect(sanitizeRanking([{ id: "r", name: "R", score: 1, avatar: "", isMe: "yes" }])[0]).not.toHaveProperty("isMe");
  });

  it("配列でなければ空", () => {
    expect(sanitizeRanking({ id: "me" })).toEqual([]);
    expect(sanitizeRanking(null)).toEqual([]);
  });
});

describe("sanitizeDailyLog", () => {
  it("null の日・count が数でない日を捨て、正解数が欠けていれば 0 にする", () => {
    expect(sanitizeDailyLog({
      "2026-11-01": null,
      "2026-11-02": { count: "3" },
      "2026-11-03": { count: Infinity },
      "2026-11-04": { count: 5, correct: 4 },
      "2026-11-05": { count: 2 }
    })).toEqual({ "2026-11-04": { count: 5, correct: 4 }, "2026-11-05": { count: 2, correct: 0 } });
  });

  it("オブジェクトでなければ空", () => {
    expect(sanitizeDailyLog(null)).toEqual({});
    expect(sanitizeDailyLog([{ count: 1 }])).toEqual({});
  });
});
