import { UserStats } from "./types";
import { todayStr } from "./srs";

/** ログインボーナス（7日で1周。7日目は特別に多い） */
export const LOGIN_BONUS_DAYS = Array.from({ length: 7 }, (_, i) => ({
  day: i + 1,
  points: (i + 1) * 100 + (i === 6 ? 500 : 0)
}));

/** 前の日の YYYY-MM-DD。暦日で引く（ミリ秒で引くと夏時間の日にずれる） */
export function previousDay(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return todayStr(d);
}

/**
 * いまの連続ログイン日数。
 *
 * 保存している currentStreak は「最後に受け取った日の時点の日数」なので、
 * そのあと1日以上空いていれば途切れている。起動時にも0へ戻しているが、
 * 開いたまま日をまたぐ（ホーム画面から開くと何日も閉じないことがある）と古い日数が残り、
 * 画面は「連続4日」と出し、受け取ると「1日目」と言いながら5日目の点数を足していた。
 */
export function currentLoginStreak(
  stats: Pick<UserStats, "currentStreak" | "lastLoginDate">,
  now: Date = new Date()
): number {
  if (stats.lastLoginDate !== todayStr(now) && stats.lastLoginDate !== previousDay(now)) return 0;
  return Number.isInteger(stats.currentStreak) && stats.currentStreak > 0 ? stats.currentStreak : 0;
}

/** ログインボーナスの、いまの状態（スタンプの表示と受け取りで同じものを使う） */
export function loginBonusState(
  stats: Pick<UserStats, "currentStreak" | "lastLoginDate">,
  now: Date = new Date()
) {
  const today = todayStr(now);
  const claimedToday = stats.lastLoginDate === today;
  const streak = currentLoginStreak(stats, now);
  return {
    today,
    canClaim: !claimedToday,
    streak,
    /** 7つのスタンプのうち、受け取り済みの数 */
    stampsClaimed: claimedToday ? ((Math.max(streak, 1) - 1) % 7) + 1 : streak % 7,
    /** 今日受け取ると連続何日目になるか */
    nextStreak: streak + 1,
    /** 今日受け取れる点数 */
    points: LOGIN_BONUS_DAYS[streak % 7].points
  };
}
