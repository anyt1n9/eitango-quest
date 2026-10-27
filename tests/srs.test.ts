import { describe, it, expect } from "vitest";
import { nextSrsState, isDue, getDueWordIds, todayStr, SrsState, sanitizeSrs } from "../src/srs";

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

/**
 * 保存されていた SRS データの検査（issue #106）。
 *
 * quest_srs は readStoredObject（オブジェクトであることしか見ない）とバックアップの復元
 * （値が文字列かどうかしか見ない）を通るので、壊れた要素が入りうる。
 * null のまま使うと isDue が TypeError を投げ、App の描画ごと落ちて再読み込みしても戻らない。
 */
describe("保存データの検査（sanitizeSrs）", () => {
  const GOOD: SrsState = { box: 2, dueDate: "2026-10-20", lastReview: "2026-10-18", reps: 3, lapses: 1 };

  it("形の正しい要素はそのまま残す", () => {
    expect(sanitizeSrs({ w1: GOOD })).toEqual({ w1: GOOD });
  });

  it("null・数値でない box・範囲外の box・日付でない期日は捨てる", () => {
    const out = sanitizeSrs({
      ok: GOOD,
      nul: null,
      str: "x",
      badBox: { ...GOOD, box: "a" },
      negBox: { ...GOOD, box: -1 },
      bigBox: { ...GOOD, box: 99 },
      floatBox: { ...GOOD, box: 1.5 },
      noDue: { ...GOOD, dueDate: undefined },
      badDue: { ...GOOD, dueDate: "NaN-NaN-NaN" }
    });
    expect(Object.keys(out)).toEqual(["ok"]);
  });

  it("欠けた回数や最終解答日は補う（期日があれば復習には使える）", () => {
    expect(sanitizeSrs({ w1: { box: 1, dueDate: "2026-10-20" } })).toEqual({
      w1: { box: 1, dueDate: "2026-10-20", lastReview: "2026-10-20", reps: 0, lapses: 0 }
    });
  });

  it("オブジェクトでなければ空にする", () => {
    expect(sanitizeSrs(null)).toEqual({});
    expect(sanitizeSrs([GOOD])).toEqual({});
    expect(sanitizeSrs("x")).toEqual({});
  });

  it("検査したあとは isDue / getDueWordIds が落ちない", () => {
    const srs = sanitizeSrs({ w1: null, w2: { ...GOOD, dueDate: "2026-10-01" } });
    expect(getDueWordIds(srs, "2026-10-27")).toEqual(["w2"]);
  });

  it("壊れた前回の状態から計算しても、期日が NaN にならない", () => {
    const broken = { box: "a", dueDate: "2026-10-20", lastReview: "x", reps: "y", lapses: null } as unknown as SrsState;
    const next = nextSrsState(broken, true, "2026-10-27");
    expect(next.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(next.box).toBe(1);
    expect(next.reps).toBe(1);
    expect(next.lapses).toBe(0);
  });
});
