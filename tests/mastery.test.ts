import { describe, it, expect } from "vitest";
import { isMastered, countMastered, MASTERY_BOX } from "../src/mastery";
import { SrsState } from "../src/srs";

const srs = (box: number): SrsState =>
  ({ box, dueDate: "2026-03-01", lastReview: "2026-03-01", reps: box, lapses: 0 });

describe("isMastered", () => {
  it("SRSボックスが基準以上なら習得済み", () => {
    expect(isMastered("w1", {}, { w1: srs(MASTERY_BOX) })).toBe(true);
    expect(isMastered("w1", {}, { w1: srs(MASTERY_BOX + 3) })).toBe(true);
  });

  it("1回当たっただけ（ボックス1）では習得済みにしない", () => {
    // 四択は当てずっぽうでも25%当たるため、1回の正解で習得済みとしない
    expect(isMastered("w1", {}, { w1: srs(1) })).toBe(false);
    expect(isMastered("w1", {}, { w1: srs(0) })).toBe(false);
  });

  it("SRSデータがある場合は解答履歴より優先する", () => {
    // 間違えてボックスが下がった語は、過去に何度正解していても習得済みに戻さない
    const history = { w1: { correctCount: 9, attemptCount: 9 } };
    expect(isMastered("w1", history, { w1: srs(0) })).toBe(false);
  });

  it("SRS導入前のデータは正解2回以上で習得済みとみなす", () => {
    expect(isMastered("w1", { w1: { correctCount: 2, attemptCount: 4 } }, {})).toBe(true);
    expect(isMastered("w1", { w1: { correctCount: 1, attemptCount: 1 } }, {})).toBe(false);
  });

  it("履歴もSRSも無い語は未習得", () => {
    expect(isMastered("w1", {}, {})).toBe(false);
  });
});

describe("countMastered", () => {
  it("習得済みの語だけを数える", () => {
    const ids = ["a", "b", "c", "d"];
    const history = { c: { correctCount: 2, attemptCount: 2 } };
    const srsData = { a: srs(3), b: srs(1) };
    expect(countMastered(ids, history, srsData)).toBe(2); // a と c
  });

  it("空配列なら0", () => {
    expect(countMastered([], {}, {})).toBe(0);
  });
});
