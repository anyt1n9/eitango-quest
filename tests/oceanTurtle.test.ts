import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { TURTLE_SWIM, glslNumber, poseTurtleVertex, turtleFlipperGlsl } from "../src/ocean/turtle";

/**
 * ウミガメのあしの動かし方（src/ocean/turtle.ts）を、出荷する3Dモデル（src/ocean/assets/ocean-seaturtle.glb）で確かめる。
 *
 * あしの頂点には、作るとき（scripts/fishgen/make_turtle.py）に印 _FLIPPER =（前あしの重み、後ろあしの重み、回す軸の |x|）を
 * 付けている。印の付け方を誤ると、あしの一部だけが動かずに面が引き伸ばされたり（以前の Blender のウミガメで、実機で
 * 「前あしに長方形のようなものが付いている」と言われた）、甲羅まで羽ばたいたりする。
 * 型検査にもふだんの描画テストにも出ない（GPU の無い CI では海を描かない）ので、ここで頂点を動かして測る。
 */

type Flip = [number, number, number];
let pos: Float32Array;
let flips: Flip[];
let index: ArrayLike<number>;
let hasUv = false;

beforeAll(() => {
  // GPU も画像の読み込みも無い所で読むので、glb の中身をそのまま読む（場面のコードは float の値をそのまま使う）
  const file = readFileSync(new URL("../src/ocean/assets/ocean-seaturtle.glb", import.meta.url));
  const jsonLen = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLen).toString("utf8"));
  const bin = file.subarray(20 + jsonLen + 8);
  const prim = json.meshes[0].primitives[0];
  const read = (acc: number, size: number) => {
    const a = json.accessors[acc], v = json.bufferViews[a.bufferView];
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < out.length; i++) out[i] = bin.readFloatLE((v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * 4);
    return out;
  };
  pos = read(prim.attributes.POSITION, 3);
  const f = read(prim.attributes._FLIPPER, 3);
  flips = Array.from({ length: f.length / 3 }, (_, i) => [f[i * 3], f[i * 3 + 1], f[i * 3 + 2]] as Flip);
  const ia = json.accessors[prim.indices], iv = json.bufferViews[ia.bufferView];
  const idx = new Uint32Array(ia.count);
  for (let i = 0; i < ia.count; i++) {
    idx[i] = ia.componentType === 5123 ? bin.readUInt16LE((iv.byteOffset ?? 0) + i * 2) : bin.readUInt32LE((iv.byteOffset ?? 0) + i * 4);
  }
  index = idx;
  hasUv = prim.attributes.TEXCOORD_0 !== undefined;
});

const vertex = (i: number) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]] as const;
const pose = (i: number, t: number) => { const [x, y, z] = vertex(i); return poseTurtleVertex(x, y, z, t, flips[i]); };

/**
 * 時刻 t であしを動かしたとき、いちばん伸びた辺が元の何倍になるか。
 * 見える所（3つの頂点とも厚みのある所）の三角形だけを見る（輪郭の外は模様で切り抜くので見えない）
 */
function worstStretch(t: number): number {
  const n = pos.length / 3;
  const posed = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) posed.set(pose(i, t), i * 3);
  const len = (p: Float32Array, a: number, b: number) =>
    Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);
  let worst = 1;
  for (let k = 0; k < index.length; k += 3) {
    const tri = [index[k], index[k + 1], index[k + 2]];
    if (tri.some(v => Math.abs(pos[v * 3 + 1]) < 1e-4)) continue;
    for (let e = 0; e < 3; e++) {
      const a = tri[e], b = tri[(e + 1) % 3];
      const rest = len(pos, a, b);
      if (rest > 1e-4) worst = Math.max(worst, len(posed, a, b) / rest);
    }
  }
  return worst;
}

describe("ウミガメのあし", () => {
  it("3Dモデルに、あしの印（前あし・後ろあしの重みと軸）と模様の UV がある", () => {
    expect(hasUv).toBe(true);
    expect(flips.length).toBe(pos.length / 3);
    const front = flips.filter(f => f[0] > 0.99).length, rear = flips.filter(f => f[1] > 0.99).length;
    expect(front, "前あし").toBeGreaterThan(50);
    expect(rear, "後ろあし").toBeGreaterThan(20);
    // 重みは 0〜1。前と後ろの両方に重みのある頂点は無い
    for (const [f, r] of flips) {
      expect(f).toBeGreaterThanOrEqual(0); expect(f).toBeLessThanOrEqual(1);
      expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(1);
      expect(f * r).toBe(0);
    }
  });

  it("羽ばたいても、面が引き伸ばされない（あしの一部だけが取り残されない）", () => {
    // 1回の羽ばたき（約5秒）を細かく見る
    for (let t = 0; t < 5.1; t += 0.25) {
      expect(worstStretch(t), `@${t.toFixed(2)}s`).toBeLessThan(1.5);
    }
  });

  it("前あしは先まで動く", () => {
    // 前あしの先：前あしの印が 1 の頂点のうち、いちばん外の1割
    const front = flips.map((f, i) => [i, f[0]] as const).filter(([, w]) => w > 0.99).map(([i]) => i);
    const ax = front.map(i => Math.abs(pos[i * 3]));
    const cut = [...ax].sort((a, b) => a - b)[Math.floor(ax.length * 0.9)];
    const tips = front.filter((_, k) => ax[k] >= cut);
    // 羽ばたきのいちばん上（前あしの付け根で sin が 1 になるころ）
    const t = (Math.PI / 2) / TURTLE_SWIM.speed;
    const moved = tips.filter(i => { const [x, y] = vertex(i); const [px, py] = pose(i, t); return Math.hypot(px - x, py - y) > 0.05; });
    expect(tips.length).toBeGreaterThan(0);
    expect(moved.length, "前あしの先が動いていない").toBe(tips.length);
  });

  it("どの時刻でも、甲羅と頭（あしの印の無い所）は動かない。甲羅の盛り上がった所（y > 0.1）にあしの印は無い", () => {
    // あしは付け根が腕のように太い（背の側で y 0.05 ほど）が、甲羅の盛り上がり（0.22 まで）には届かない
    for (let i = 0; i < flips.length; i++) {
      if (pos[i * 3 + 1] > 0.1) expect(flips[i][0] + flips[i][1], `頂点 ${i}`).toBe(0);
    }
    // 後ろあしは前あしと位相がずれる（rearPhase）ので、1点の時刻だけでは見逃す
    for (let t = 0; t < 5.1; t += 0.25) {
      let worst = 0;
      for (let i = 0; i < flips.length; i++) {
        if (flips[i][0] + flips[i][1] > 0) continue;
        const [x, y] = vertex(i); const [px, py] = pose(i, t);
        worst = Math.max(worst, Math.hypot(px - x, py - y));
      }
      expect(worst, `@${t.toFixed(2)}s`).toBeLessThan(1e-6);
    }
  });

  /**
   * 頭とあしの厚みは、はじめ輪郭からの距離に比例させていたので、横から見ると薄いくさび形の板だった
   * （頭の高さ 0.11、あしの厚み 0.03。「頭・腕・足が平たい」と言われた）。いまは丸い断面にしている
   */
  it("頭・前あし・後ろあしは平たい板ではない（上下に厚みがある）", () => {
    const height = (sel: (i: number) => boolean) => {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < flips.length; i++) if (sel(i)) { lo = Math.min(lo, pos[i * 3 + 1]); hi = Math.max(hi, pos[i * 3 + 1]); }
      return hi - lo;
    };
    expect(height(i => pos[i * 3 + 2] > 0.55), "頭（甲羅より前）").toBeGreaterThan(0.14);
    expect(height(i => flips[i][0] > 0), "前あし").toBeGreaterThan(0.07);
    expect(height(i => flips[i][1] > 0), "後ろあし").toBeGreaterThan(0.07);
  });

  it("あしを回す軸は、あしの付け根の近く（甲羅の半分の幅 0.40 より内側、首より外）にある", () => {
    for (const [f, r, pivot] of flips) {
      if (f + r === 0) continue;
      expect(pivot).toBeGreaterThan(0.08);
      expect(pivot).toBeLessThan(0.4);
    }
  });
});

describe("シェーダーに書く数", () => {
  it("丸めずにそのまま書く（丸めると、テストとGPUで違う数で動く）", () => {
    expect(glslNumber(0.425)).toBe("0.425");
    expect(glslNumber(3)).toBe("3.0");
    expect(glslNumber(-0.31)).toBe("-0.31");
    expect(() => glslNumber(NaN)).toThrow();
    const glsl = turtleFlipperGlsl();
    for (const v of Object.values(TURTLE_SWIM)) expect(glsl, String(v)).toContain(glslNumber(v));
  });

  /**
   * GLSL の smoothstep は、小さい端を先に渡さないと結果が決まっていない（仕様上は未定義で、GPU によって
   * 0 や NaN になる）。逆順でも JavaScript の計算やソフトウェアの描画では動いてしまうので、書き方で止める
   */
  it("smoothstep の端は、小さい方から渡す", () => {
    const sources = [readFileSync(new URL("../src/ocean/oceanScene.ts", import.meta.url), "utf8"), turtleFlipperGlsl()];
    const reversed: string[] = [];
    for (const src of sources) {
      for (const m of src.matchAll(/smoothstep\(\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)\s*,/g)) {
        if (Number(m[1]) >= Number(m[2])) reversed.push(m[0]);
      }
    }
    expect(reversed).toEqual([]);
  });
});
