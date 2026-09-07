import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import StudyCalendar from "../src/components/StudyCalendar";

/**
 * 学習カレンダー（直近17週間のマス目）。
 *
 * マスの日付をミリ秒（24時間 × 日数）で進めていたため、夏時間で
 * 時計が1時間戻る日をまたぐと同じ暦日が2度並び、最後の1日が押し出されていた。
 * 4ヶ月ぶんを並べるこの表は、夏時間のある地域では必ず切り替え日をまたぐ。
 * 連続学習日数を遡って数える側も同じ計算だったので、
 * 時計が進む日をまたぐと1日飛ばして記録が途切れて見えた。
 */

const originalTz = process.env.TZ;
beforeAll(() => { process.env.TZ = "America/New_York"; });
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
  vi.useRealTimers();
});
afterEach(() => {
  cleanup();
  // 時計を戻してから次のテストへ。入れっぱなしにすると、次に
  // useFakeTimers を呼んでも前の時刻のままになる
  vi.useRealTimers();
});

/** マスの title 属性から日付を取り出す（"2026-11-01: 3問 (正解 2)"） */
function renderedDays(): string[] {
  return [...document.querySelectorAll("[title]")]
    .map(el => (el.getAttribute("title") || "").split(":")[0].trim())
    .filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t));
}

describe("夏時間をまたぐマス目", () => {
  it("同じ日が2度並ばない（時計が戻る日をまたいでも）", () => {
    // 2026-11-01 が切り替え日。それを含む期間を表示させる
    vi.useFakeTimers({ now: new Date("2026-11-20T12:00:00").getTime(), toFake: ["Date"] });
    render(<StudyCalendar dailyLog={{}} dailyGoal={20} />);
    const days = renderedDays();
    expect(days.length).toBeGreaterThan(100);
    expect(new Set(days).size, "同じ日付のマスが複数ある").toBe(days.length);
  });

  it("日付が1日ずつ連続する（飛びも戻りもない）", () => {
    vi.useFakeTimers({ now: new Date("2026-11-20T12:00:00").getTime(), toFake: ["Date"] });
    render(<StudyCalendar dailyLog={{}} dailyGoal={20} />);
    const days = renderedDays();
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1] + "T00:00:00");
      prev.setDate(prev.getDate() + 1);
      const expected = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
      expect(days[i], `${days[i - 1]} の次`).toBe(expected);
    }
  });

  it("連続学習日数が、時計の進む日をまたいでも途切れない", () => {
    // 2026-03-08 が「時計が1時間進む日」。その前後を続けて学習している
    vi.useFakeTimers({ now: new Date("2026-03-10T12:00:00").getTime(), toFake: ["Date"] });
    const log: Record<string, { count: number; correct: number }> = {};
    for (const d of ["2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"]) {
      log[d] = { count: 10, correct: 8 };
    }
    const { container } = render(<StudyCalendar dailyLog={log} dailyGoal={20} />);
    expect(container.textContent).toContain("連続学習");
    // 5日続けているので 5 日と出る（1日飛ばすと 2 日で止まる）
    const streak = container.textContent!.match(/連続学習\s*(\d+)\s*日/);
    expect(streak?.[1]).toBe("5");
  });
});
