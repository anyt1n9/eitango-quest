import { RankingUser } from "./types";
import { todayStr } from "./srs";

/**
 * ランキングの架空ライバル（CPU）を日ごとに成長させる。
 *
 * 以前はライバルのスコアが固定値だったため、こちらが学習するほど
 * 差が開くだけで、追い抜いた後は永久に順位が変わらなかった。
 * ここでは前回起動日からの経過日数ぶん、各ライバルに
 * ランダムなスコアを加算する。
 *
 * ライバルごとに「1日あたりの伸び幅」を変えることで、
 * 上位ほどよく学習する、といった性格の違いを出す。
 * 日数はローカル日付で数え、複数日空いた場合はまとめて加算する。
 */

/** 1日に加算するスコアの範囲（ライバルIDごと） */
const DAILY_GAIN: Record<string, { min: number; max: number }> = {
  r1: { min: 90, max: 260 },  // Takashi: 熱心
  r2: { min: 70, max: 210 },  // Emily
  r3: { min: 60, max: 180 },  // Alex
  r4: { min: 40, max: 150 },  // Kenji
  r5: { min: 30, max: 130 },  // Yuki
  r6: { min: 25, max: 110 },  // Rui
  r7: { min: 20, max: 90 },   // Sara
  r8: { min: 15, max: 70 },   // Takuya
};
const DEFAULT_GAIN = { min: 20, max: 100 };

/** 何日ぶん遡って加算するかの上限（長期間空けたときに一気に離されないようにする） */
const MAX_CATCHUP_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD の2日付間の日数差（負の値は0として扱う） */
export function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T00:00:00").getTime();
  const b = new Date(to + "T00:00:00").getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

/**
 * 前回更新日から今日までのぶん、CPUのスコアを増やした新しいランキングを返す。
 * 加算が不要な場合は元の配列をそのまま返す（再描画を起こさないため）。
 */
export function growRivals(
  ranking: RankingUser[],
  lastUpdated: string | null,
  today: string = todayStr(),
  random: () => number = Math.random
): { ranking: RankingUser[]; updated: boolean } {
  if (!lastUpdated) return { ranking, updated: false };
  const days = Math.min(daysBetween(lastUpdated, today), MAX_CATCHUP_DAYS);
  if (days <= 0) return { ranking, updated: false };

  const grown = ranking.map(u => {
    if (u.isMe) return u;
    const gain = DAILY_GAIN[u.id] || DEFAULT_GAIN;
    let total = 0;
    for (let d = 0; d < days; d++) {
      total += Math.round(gain.min + random() * (gain.max - gain.min));
    }
    return { ...u, score: u.score + total };
  });

  return { ranking: grown.sort((a, b) => b.score - a.score), updated: true };
}
