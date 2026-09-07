import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * 夏時間（DST）を採る地域での次回復習日。
 *
 * 期日は「基準日 + 日数」で決めるが、これをミリ秒（24時間 × 日数）で
 * 足していたため、時計が1時間戻る日（25時間ある日）をまたぐと暦日が進まなかった。
 * その日に正解した語は期日が「今日のまま」になり、isDue() が即日 true を返し続けて、
 * 同じ語がその日のうちに何度も「復習期日超過」として出題される。
 *
 * 日本には夏時間が無いが、端末の時計は利用者の地域に従う。
 */

const original = process.env.TZ;
beforeAll(() => { process.env.TZ = "America/New_York"; });
afterAll(() => {
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
});

describe("夏時間の切り替え日をまたぐ期日計算", () => {
  it("時計が戻る日（25時間ある日）でも翌日へ進む", async () => {
    const { nextSrsState } = await import("../src/srs");
    // 2026-11-01 は America/New_York で時計が1時間戻る日
    expect(nextSrsState(undefined, true, "2026-11-01").dueDate).toBe("2026-11-02");
  });

  it("時計が進む日（23時間しかない日）でも1日だけ進む", async () => {
    const { nextSrsState } = await import("../src/srs");
    // 2026-03-08 は America/New_York で時計が1時間進む日
    expect(nextSrsState(undefined, true, "2026-03-08").dueDate).toBe("2026-03-09");
  });

  it("切り替え日に正解した語が、その日のうちに復習対象へ戻らない", async () => {
    const { nextSrsState, isDue } = await import("../src/srs");
    const state = nextSrsState(undefined, true, "2026-11-01");
    expect(isDue(state, "2026-11-01")).toBe(false);
    expect(isDue(state, "2026-11-02")).toBe(true);
  });

  it("間隔が伸びたあとも、切り替え日をまたいで正しい日数になる", async () => {
    const { nextSrsState } = await import("../src/srs");
    // ボックス2（2日後）・ボックス3（4日後）が切り替え日をまたぐ場合
    let state = nextSrsState(undefined, true, "2026-10-30");   // box1 → 1日後
    state = nextSrsState(state, true, "2026-10-31");           // box2 → 2日後
    expect(state.dueDate).toBe("2026-11-02");
    state = nextSrsState(state, true, "2026-10-31");           // box3 → 4日後
    expect(state.dueDate).toBe("2026-11-04");
  });

  it("夏時間の無い地域では、これまでと同じ結果になる", async () => {
    process.env.TZ = "Asia/Tokyo";
    const { nextSrsState } = await import("../src/srs");
    expect(nextSrsState(undefined, true, "2026-11-01").dueDate).toBe("2026-11-02");
    expect(nextSrsState(undefined, true, "2026-12-31").dueDate).toBe("2027-01-01");
    process.env.TZ = "America/New_York";
  });
});
