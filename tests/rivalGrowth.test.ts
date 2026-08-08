import { describe, it, expect } from "vitest";
import { growRivals, daysBetween } from "../src/rivalGrowth";
import { RankingUser } from "../src/types";
import { seededRandom } from "./helpers";

const RANKING: RankingUser[] = [
  { id: "r1", name: "Takashi", score: 5000, avatar: "🦊" },
  { id: "r2", name: "Emily", score: 4200, avatar: "🐼" },
  { id: "me", name: "あなた", score: 3000, avatar: "🧑", isMe: true },
  { id: "r8", name: "Takuya", score: 900, avatar: "🐧" },
];

describe("daysBetween", () => {
  it("日数差を返す", () => {
    expect(daysBetween("2026-03-01", "2026-03-01")).toBe(0);
    expect(daysBetween("2026-03-01", "2026-03-05")).toBe(4);
    expect(daysBetween("2026-02-26", "2026-03-02")).toBe(4); // 月またぎ
    expect(daysBetween("2028-02-27", "2028-03-01")).toBe(3); // うるう年
    expect(daysBetween("2025-12-30", "2026-01-02")).toBe(3); // 年またぎ
  });

  it("未来から過去への差は0（端末の時計を戻しても減らない）", () => {
    expect(daysBetween("2026-03-10", "2026-03-01")).toBe(0);
  });

  it("不正な日付は0", () => {
    expect(daysBetween("", "2026-03-01")).toBe(0);
    expect(daysBetween("2026-03-01", "not-a-date")).toBe(0);
  });
});

describe("growRivals", () => {
  it("初回（前回更新日が無い）は何もしない", () => {
    const r = growRivals(RANKING, null, "2026-03-01", seededRandom(1));
    expect(r.updated).toBe(false);
    expect(r.ranking).toBe(RANKING); // 同一参照＝再描画を起こさない
  });

  it("同じ日に2度呼んでも加算しない", () => {
    const r = growRivals(RANKING, "2026-03-01", "2026-03-01", seededRandom(1));
    expect(r.updated).toBe(false);
    expect(r.ranking).toBe(RANKING);
  });

  it("1日経つとCPUのスコアが増える", () => {
    const r = growRivals(RANKING, "2026-02-28", "2026-03-01", seededRandom(1));
    expect(r.updated).toBe(true);
    const byId = Object.fromEntries(r.ranking.map(u => [u.id, u.score]));
    expect(byId.r1).toBeGreaterThan(5000);
    expect(byId.r2).toBeGreaterThan(4200);
    expect(byId.r8).toBeGreaterThan(900);
  });

  it("自分のスコアは絶対に変えない", () => {
    for (let s = 0; s < 20; s++) {
      const r = growRivals(RANKING, "2026-02-01", "2026-03-01", seededRandom(s));
      const me = r.ranking.find(u => u.isMe)!;
      expect(me.score).toBe(3000);
      expect(me).toEqual(RANKING.find(u => u.isMe));
    }
  });

  it("1日あたりの伸び幅が設定範囲に収まる", () => {
    for (let s = 0; s < 50; s++) {
      const r = growRivals(RANKING, "2026-02-28", "2026-03-01", seededRandom(s));
      const byId = Object.fromEntries(r.ranking.map(u => [u.id, u.score]));
      expect(byId.r1 - 5000).toBeGreaterThanOrEqual(90);
      expect(byId.r1 - 5000).toBeLessThanOrEqual(260);
      expect(byId.r8 - 900).toBeGreaterThanOrEqual(15);
      expect(byId.r8 - 900).toBeLessThanOrEqual(70);
    }
  });

  it("上位ライバルほどよく伸びる（性格の違いが出る）", () => {
    let r1Total = 0, r8Total = 0;
    for (let s = 0; s < 200; s++) {
      const r = growRivals(RANKING, "2026-02-28", "2026-03-01", seededRandom(s));
      const byId = Object.fromEntries(r.ranking.map(u => [u.id, u.score]));
      r1Total += byId.r1 - 5000;
      r8Total += byId.r8 - 900;
    }
    expect(r1Total).toBeGreaterThan(r8Total * 2);
  });

  it("空いた日数ぶんまとめて加算する", () => {
    const one = growRivals(RANKING, "2026-02-28", "2026-03-01", seededRandom(5));
    const five = growRivals(RANKING, "2026-02-24", "2026-03-01", seededRandom(5));
    const gain = (r: { ranking: RankingUser[] }) => r.ranking.find(u => u.id === "r1")!.score - 5000;
    expect(gain(five)).toBeGreaterThan(gain(one) * 3);
  });

  it("長期間空けても14日ぶんで打ち止め（復帰時に一気に離されない）", () => {
    const gain = (from: string) =>
      growRivals(RANKING, from, "2026-06-01", seededRandom(11)).ranking
        .find(u => u.id === "r1")!.score - 5000;
    const capped = gain("2026-05-18"); // ちょうど14日
    expect(gain("2025-01-01")).toBe(capped); // 500日空けても同じ
    expect(capped).toBeLessThanOrEqual(260 * 14);
  });

  it("スコア降順に並べ直す", () => {
    const r = growRivals(RANKING, "2026-02-01", "2026-03-01", seededRandom(3));
    const scores = r.ranking.map(u => u.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("人数と顔ぶれが変わらない", () => {
    const r = growRivals(RANKING, "2026-02-01", "2026-03-01", seededRandom(3));
    expect(r.ranking).toHaveLength(RANKING.length);
    expect(r.ranking.map(u => u.id).sort()).toEqual(RANKING.map(u => u.id).sort());
  });

  it("未知のIDのライバルにも既定の伸び幅を使う", () => {
    const extra: RankingUser[] = [{ id: "unknown", name: "?", score: 100, avatar: "❓" }];
    const r = growRivals(extra, "2026-02-28", "2026-03-01", seededRandom(1));
    expect(r.ranking[0].score).toBeGreaterThanOrEqual(120);
    expect(r.ranking[0].score).toBeLessThanOrEqual(200);
  });

  it("元の配列を書き換えない", () => {
    const snapshot = JSON.parse(JSON.stringify(RANKING));
    growRivals(RANKING, "2026-02-01", "2026-03-01", seededRandom(3));
    expect(RANKING).toEqual(snapshot);
  });
});
