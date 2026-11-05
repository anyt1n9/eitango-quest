import { describe, it, expect, afterEach } from "vitest";
import { msUntilNextDay } from "../src/useToday";

/**
 * 次の0時までの時間（src/useToday.ts）。開いたまま日をまたいだら「今日」を描き直すための時計。
 *
 * 24時間を足して求めると、夏時間の切り替わる日に0時からずれる（CLAUDE.md「日付のテスト」）。
 * 25時間の日は1時間早く鳴って前の日のまま、23時間の日は1時間遅れて0時台を前の日のまま出す。
 * 時計は利用者の地域に従うので、TZ を差し替えて確かめる。
 */

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

const HOUR = 3600_000;

describe("次の0時までの時間", () => {
  it("ふつうの日は、その日の残りの時間", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(msUntilNextDay(new Date(2026, 10, 5, 23, 59, 30))).toBe(30_000);
    expect(msUntilNextDay(new Date(2026, 10, 5, 0, 0, 0))).toBe(24 * HOUR);
  });

  it("夏時間が終わる日（25時間）でも、次の暦日の0時を指す", () => {
    process.env.TZ = "America/New_York";
    // 2026-11-01 は 2:00 に 1:00 へ戻る。0:30 から次の0時までは 24.5時間
    const now = new Date(2026, 10, 1, 0, 30, 0);
    expect(msUntilNextDay(now)).toBe(24.5 * HOUR);
    const at = new Date(now.getTime() + msUntilNextDay(now));
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([2, 0, 0]);
  });

  it("夏時間が始まる日（23時間）でも、次の暦日の0時を指す", () => {
    process.env.TZ = "America/New_York";
    // 2027-03-14 は 2:00 に 3:00 へ進む。0:30 から次の0時までは 22.5時間
    const now = new Date(2027, 2, 14, 0, 30, 0);
    expect(msUntilNextDay(now)).toBe(22.5 * HOUR);
  });

  it("0時そのものが無い日（0時に夏時間が始まる地域）でも、日付が変わったあとを指す", () => {
    process.env.TZ = "America/Santiago";
    // 2026-09-06 の 0:00 は 1:00 に飛ぶ。前の日の 23:59 からは1分後
    const now = new Date(2026, 8, 5, 23, 59, 0);
    const at = new Date(now.getTime() + msUntilNextDay(now));
    expect(at.getDate()).toBe(6);
    expect(msUntilNextDay(now)).toBeLessThanOrEqual(HOUR);
  });
});
