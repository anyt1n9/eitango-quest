import { describe, it, expect } from "vitest";
import { nextSrsState, isDue, getDueWordIds, todayStr, SrsState } from "../src/srs";

describe("todayStr", () => {
  it("ローカル日付を YYYY-MM-DD で返す", () => {
    expect(todayStr(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(todayStr(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("UTCではなくローカル日付を使う（日付がずれない）", () => {
    // ローカル時刻の 23:30。UTC 換算だと翌日になる地域があるが、
    // 学習記録は端末のローカル日付で扱う。
    const d = new Date(2026, 5, 10, 23, 30);
    expect(todayStr(d)).toBe("2026-06-10");
  });
});

describe("nextSrsState", () => {
  it("初回正解でボックス1・翌日が期日になる", () => {
    const s = nextSrsState(undefined, true, "2026-03-01");
    expect(s.box).toBe(1);
    expect(s.dueDate).toBe("2026-03-02");
    expect(s.reps).toBe(1);
    expect(s.lapses).toBe(0);
    expect(s.lastReview).toBe("2026-03-01");
  });

  it("初回不正解でもボックスは0未満にならない", () => {
    const s = nextSrsState(undefined, false, "2026-03-01");
    expect(s.box).toBe(0);
    expect(s.lapses).toBe(1);
  });

  it("正解を重ねるとボックスが上がり間隔が伸びる", () => {
    const intervals = [1, 1, 2, 4, 7, 14, 30, 60];
    let s: SrsState | undefined;
    let day = new Date(2026, 0, 1);
    for (let i = 0; i < intervals.length + 2; i++) {
      const today = todayStr(day);
      s = nextSrsState(s, true, today);
      const expectedBox = Math.min(i + 1, intervals.length - 1);
      expect(s.box).toBe(expectedBox);
      const expected = new Date(day.getTime() + intervals[expectedBox] * 86400000);
      expect(s.dueDate).toBe(todayStr(expected));
      day = expected;
    }
    // 最大ボックスで頭打ちになる
    expect(s!.box).toBe(intervals.length - 1);
  });

  it("不正解でボックスが1つ下がり lapses が増える", () => {
    const prev: SrsState = {
      box: 4, dueDate: "2026-03-01", lastReview: "2026-02-22", reps: 9, lapses: 2
    };
    const s = nextSrsState(prev, false, "2026-03-05");
    expect(s.box).toBe(3);
    expect(s.dueDate).toBe("2026-03-09"); // box3 = 4日後
    expect(s.reps).toBe(10);
    expect(s.lapses).toBe(3);
  });

  it("月をまたぐ・うるう年でも期日計算がずれない", () => {
    const prev: SrsState = {
      box: 5, dueDate: "2028-02-01", lastReview: "2028-02-01", reps: 6, lapses: 0
    };
    // box6 = 30日後。2028年はうるう年なので 2/28 + 30日 = 3/29
    const s = nextSrsState(prev, true, "2028-02-28");
    expect(s.box).toBe(6);
    expect(s.dueDate).toBe("2028-03-29");
  });
});

describe("isDue / getDueWordIds", () => {
  const mk = (dueDate: string): SrsState =>
    ({ box: 1, dueDate, lastReview: "2026-01-01", reps: 1, lapses: 0 });

  it("期日が今日以前なら復習対象", () => {
    expect(isDue(mk("2026-03-01"), "2026-03-01")).toBe(true);
    expect(isDue(mk("2026-02-28"), "2026-03-01")).toBe(true);
    expect(isDue(mk("2026-03-02"), "2026-03-01")).toBe(false);
  });

  it("年をまたぐ比較でも文字列比較が壊れない", () => {
    expect(isDue(mk("2025-12-31"), "2026-01-01")).toBe(true);
    expect(isDue(mk("2026-01-02"), "2025-12-31")).toBe(false);
  });

  it("期日超過の単語IDだけを返す", () => {
    const srs = {
      a: mk("2026-02-20"),
      b: mk("2026-03-01"),
      c: mk("2026-03-10")
    };
    expect(getDueWordIds(srs, "2026-03-01").sort()).toEqual(["a", "b"]);
    expect(getDueWordIds({}, "2026-03-01")).toEqual([]);
  });
});
