import { describe, it, expect } from "vitest";
import { MANTA_RADIUS, SWIM_SPREAD_MAX, swimSpread } from "../src/ocean/swim";

/**
 * 生き物が泳ぐ範囲の横の広がり（src/ocean/swim.ts）。
 *
 * 画面の形によらず同じ範囲を泳がせていたときは、PC の横長の画面でマンタも魚の群れも
 * ほとんどの時間を中央のカードの列の真裏で過ごし、左右の余白は空のままだった。
 * ここでは oceanScene.ts と同じ見え方（カメラは z=3、マンタの輪の中心は z=-11、
 * 横長の画面の視野は縦55度）で、マンタの道筋の端がどこに来るかを計算して確かめる。
 */

const CAMERA_TO_MANTA = 3 - -11;
const FOV_WIDE = 55;
/** 画面の中身の列（main の max-w-4xl = 896px、左右の余白 16px を除く）の半分 */
const COLUMN_HALF_PX = (896 - 32) / 2;

/** 横長の画面で、マンタの輪の端が画面のどこに来るか（中央 0、左右の端 1） */
function mantaEdge(width: number, height: number): { edge: number; column: number } {
  const aspect = width / height;
  const halfWidth = CAMERA_TO_MANTA * Math.tan((FOV_WIDE / 2) * (Math.PI / 180)) * aspect;
  return {
    edge: (MANTA_RADIUS * swimSpread(aspect)) / halfWidth,
    column: Math.min(COLUMN_HALF_PX, width / 2) / (width / 2),
  };
}

describe("泳ぐ範囲の広がり", () => {
  it("スマホ・タブレットの縦では広げない（カードが幅いっぱいで、余白が無い）", () => {
    expect(swimSpread(390 / 844)).toBe(1);
    expect(swimSpread(820 / 1180)).toBe(1);
    expect(swimSpread(1)).toBe(1);
  });

  it("横長の画面ほど広げるが、上限で止める", () => {
    expect(swimSpread(16 / 9)).toBeGreaterThan(swimSpread(4 / 3));
    expect(swimSpread(32 / 9)).toBe(SWIM_SPREAD_MAX);
  });

  it("おかしな値では広げない", () => {
    expect(swimSpread(NaN)).toBe(1);
    expect(swimSpread(0)).toBe(1);
    expect(swimSpread(Infinity)).toBe(1);
  });

  // 「生き物が見えない」と言われた PC の画面（1858×943）と、よくある横長の画面
  for (const [w, h] of [[1858, 943], [1280, 720], [1440, 900], [1920, 1080], [2560, 1080]]) {
    it(`${w}×${h} では、マンタの道筋の端がカードの列の外に出て、画面の中に収まる`, () => {
      const { edge, column } = mantaEdge(w, h);
      expect(edge).toBeGreaterThan(column);
      expect(edge).toBeLessThan(0.95);
    });
  }
});
