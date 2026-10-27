import { describe, it, expect } from "vitest";
import { currentLoginStreak, loginBonusState, previousDay } from "../src/loginBonus";

/**
 * ログインボーナスの「いまの連続日数」と、今日受け取れる点数。
 * 保存している currentStreak は最後に受け取った日の時点の日数なので、
 * 1日以上空いていれば途切れている（開いたまま日をまたいでも同じ）。
 */

const NOW = new Date(2026, 9, 27, 9, 0, 0); // 2026-10-27

describe("連続日数", () => {
  it("昨日か今日に受け取っていれば続いている", () => {
    expect(currentLoginStreak({ currentStreak: 3, lastLoginDate: "2026-10-26" }, NOW)).toBe(3);
    expect(currentLoginStreak({ currentStreak: 4, lastLoginDate: "2026-10-27" }, NOW)).toBe(4);
  });

  it("1日以上空いていれば0", () => {
    expect(currentLoginStreak({ currentStreak: 3, lastLoginDate: "2026-10-25" }, NOW)).toBe(0);
    expect(currentLoginStreak({ currentStreak: 3, lastLoginDate: null }, NOW)).toBe(0);
  });

  it("前の日は暦日で引く（月・年をまたぐ）", () => {
    expect(previousDay(new Date(2026, 10, 1, 9))).toBe("2026-10-31");
    expect(previousDay(new Date(2027, 0, 1, 9))).toBe("2026-12-31");
  });
});

describe("今日受け取れるもの", () => {
  it("続いていれば次の日の点数", () => {
    const s = loginBonusState({ currentStreak: 3, lastLoginDate: "2026-10-26" }, NOW);
    expect(s).toMatchObject({ canClaim: true, streak: 3, nextStreak: 4, stampsClaimed: 3, points: 400 });
  });

  it("途切れていれば1日目から（古い日数の点数を使わない）", () => {
    const s = loginBonusState({ currentStreak: 3, lastLoginDate: "2026-10-24" }, NOW);
    expect(s).toMatchObject({ canClaim: true, streak: 0, nextStreak: 1, stampsClaimed: 0, points: 100 });
  });

  it("7日目は特別に多く、8日目からまた1周する", () => {
    expect(loginBonusState({ currentStreak: 6, lastLoginDate: "2026-10-26" }, NOW).points).toBe(1200);
    const s = loginBonusState({ currentStreak: 7, lastLoginDate: "2026-10-26" }, NOW);
    expect(s).toMatchObject({ nextStreak: 8, stampsClaimed: 0, points: 100 });
  });

  it("今日受け取ったあとは、受け取った日までスタンプが埋まる", () => {
    expect(loginBonusState({ currentStreak: 7, lastLoginDate: "2026-10-27" }, NOW))
      .toMatchObject({ canClaim: false, stampsClaimed: 7 });
    expect(loginBonusState({ currentStreak: 8, lastLoginDate: "2026-10-27" }, NOW).stampsClaimed).toBe(1);
  });
});
