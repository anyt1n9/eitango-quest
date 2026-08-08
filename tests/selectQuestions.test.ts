import { describe, it, expect } from "vitest";
import { selectQuizWords } from "../src/selectQuestions";
import { SrsState } from "../src/srs";
import { Word } from "../src/types";

const TODAY = "2026-03-01";

const w = (id: string): Word => ({
  id,
  word: id,
  translation: id,
  level: "junior",
  options: [id],
  sentence: "[_____]",
  sentenceTranslation: "",
  sentenceOptions: [id]
});

const pool = (n: number, prefix = "w") => Array.from({ length: n }, (_, i) => w(`${prefix}${i}`));

const srs = (dueDate: string): SrsState =>
  ({ box: 1, dueDate, lastReview: "2026-02-01", reps: 1, lapses: 0 });

const solved = { correctCount: 1, attemptCount: 1 };

describe("selectQuizWords", () => {
  it("要求数ちょうどを返す", () => {
    const out = selectQuizWords({ pool: pool(50), count: 10, solvedHistory: {}, srsData: {}, today: TODAY });
    expect(out).toHaveLength(10);
  });

  it("同じ単語を重複して出題しない", () => {
    // 層をまたいで詰めるため、実装を誤ると同じ語が2回出る
    for (let i = 0; i < 50; i++) {
      const p = pool(30);
      const srsData: Record<string, SrsState> = {};
      const history: Record<string, typeof solved> = {};
      p.slice(0, 8).forEach(x => { srsData[x.id] = srs("2026-02-20"); history[x.id] = solved; });
      p.slice(8, 20).forEach(x => { history[x.id] = solved; });
      const out = selectQuizWords({ pool: p, count: 10, solvedHistory: history, srsData, today: TODAY });
      expect(out).toHaveLength(10);
      expect(new Set(out.map(x => x.id)).size).toBe(10);
    }
  });

  it("プールが要求数より少なければある分だけ返す", () => {
    const out = selectQuizWords({ pool: pool(3), count: 10, solvedHistory: {}, srsData: {}, today: TODAY });
    expect(out).toHaveLength(3);
  });

  it("空プール・0問なら空配列", () => {
    expect(selectQuizWords({ pool: [], count: 10, solvedHistory: {}, srsData: {}, today: TODAY })).toEqual([]);
    expect(selectQuizWords({ pool: pool(10), count: 0, solvedHistory: {}, srsData: {}, today: TODAY })).toEqual([]);
  });

  it("復習期日を過ぎた語を優先して出す", () => {
    const p = pool(100);
    const srsData: Record<string, SrsState> = {};
    const history: Record<string, typeof solved> = {};
    p.slice(0, 20).forEach(x => { srsData[x.id] = srs("2026-02-20"); history[x.id] = solved; });
    const dueIds = new Set(p.slice(0, 20).map(x => x.id));
    const out = selectQuizWords({ pool: p, count: 10, solvedHistory: history, srsData, today: TODAY });
    const dueCount = out.filter(x => dueIds.has(x.id)).length;
    expect(dueCount).toBe(6); // 10問 × DUE_RATIO 0.6
  });

  it("期日超過だけで埋め尽くさない（新しい語に進める）", () => {
    // 期日超過が大量にあっても、未習語の枠が残る
    const p = pool(100);
    const srsData: Record<string, SrsState> = {};
    const history: Record<string, typeof solved> = {};
    p.slice(0, 80).forEach(x => { srsData[x.id] = srs("2026-02-20"); history[x.id] = solved; });
    const unseenIds = new Set(p.slice(80).map(x => x.id));
    const out = selectQuizWords({ pool: p, count: 10, solvedHistory: history, srsData, today: TODAY });
    expect(out.filter(x => unseenIds.has(x.id)).length).toBe(4);
  });

  it("期日超過が少なければ残りを未習語で埋める", () => {
    const p = pool(100);
    const srsData: Record<string, SrsState> = { w0: srs("2026-02-20") };
    const history: Record<string, typeof solved> = { w0: solved };
    const out = selectQuizWords({ pool: p, count: 10, solvedHistory: history, srsData, today: TODAY });
    expect(out).toHaveLength(10);
    expect(out.some(x => x.id === "w0")).toBe(true);
  });

  it("期日前の解答済み語より未習語を先に出す", () => {
    const p = pool(40);
    const history: Record<string, typeof solved> = {};
    const srsData: Record<string, SrsState> = {};
    // 30語は解答済みかつ期日前、10語は未習
    p.slice(0, 30).forEach(x => { history[x.id] = solved; srsData[x.id] = srs("2026-04-01"); });
    const unseenIds = new Set(p.slice(30).map(x => x.id));
    const out = selectQuizWords({ pool: p, count: 10, solvedHistory: history, srsData, today: TODAY });
    expect(out.filter(x => unseenIds.has(x.id)).length).toBe(10);
  });

  it("未習語に体系的に到達する（完全ランダムより桁違いに速い）", () => {
    // 以前はレベル内から完全ランダムだったため、初級1,062語すべてに
    // 1回触れるまで10問クイズを約800回解く必要があった。
    const p = pool(1000);
    const history: Record<string, typeof solved> = {};
    const srsData: Record<string, SrsState> = {};
    const seen = new Set<string>();
    let quizzes = 0;
    while (seen.size < p.length && quizzes < 1000) {
      const out = selectQuizWords({ pool: p, count: 10, solvedHistory: history, srsData, today: TODAY });
      for (const x of out) {
        seen.add(x.id);
        history[x.id] = solved;
        srsData[x.id] = srs("2026-04-01"); // 期日はまだ先
      }
      quizzes++;
    }
    expect(seen.size).toBe(p.length);
    expect(quizzes).toBeLessThanOrEqual(120); // 理論値100回にごく近い
  });

  it("出題順がクイズごとに変わる", () => {
    const p = pool(50);
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      orders.add(selectQuizWords({ pool: p, count: 10, solvedHistory: {}, srsData: {}, today: TODAY })
        .map(x => x.id).join(","));
    }
    expect(orders.size).toBeGreaterThan(1);
  });
});
