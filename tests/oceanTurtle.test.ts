import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { TURTLE_FLIPPERS, glslNumber, poseTurtleVertex, turtleFlipperGlsl } from "../src/ocean/turtle";

/**
 * ウミガメのあしの動かし方（src/ocean/turtle.ts）を、出荷する3Dモデル（src/ocean/assets/ocean.glb）で確かめる。
 *
 * 動かす頂点はモデルの中の位置で決めているので、モデルの形と決め方が食い違うと、
 * あしの一部だけが動かずに面が引き伸ばされる。実機で「前あしに長方形のようなものが付いている」と言われた
 * （前後を z = -0.12 で切っていて、後ろへ反った前あしの先が動いていなかった）。
 * 型検査にもふだんの描画テストにも出ない（GPU の無い CI では海を描かない）ので、ここで頂点を動かして測る。
 */

type Mesh = { pos: Float32Array; index: ArrayLike<number> };
const meshes: Record<string, Mesh> = {};

beforeAll(async () => {
  const buf = readFileSync(new URL("../src/ocean/assets/ocean.glb", import.meta.url));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const root = await new Promise<THREE.Object3D>((res, rej) => new GLTFLoader().parse(ab, "", g => res(g.scene), rej));
  root.updateMatrixWorld(true);
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.name.startsWith("turtle_")) return;
    // アプリと同じく、数値を詰めた形を float に戻してから置いた位置に直す（oceanScene.ts の plainGeometry）
    const a = m.geometry.getAttribute("position");
    const v = new THREE.Vector3();
    const pos = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) {
      v.set(a.getX(i), a.getY(i), a.getZ(i)).applyMatrix4(m.matrixWorld);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    meshes[m.name] = { pos, index: m.geometry.index!.array };
  });
});

/** 時刻 t であしを動かしたとき、いちばん伸びた辺が元の何倍になるか */
function worstStretch(mesh: Mesh, t: number): number {
  const n = mesh.pos.length / 3;
  const posed = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    posed.set(poseTurtleVertex(mesh.pos[i * 3], mesh.pos[i * 3 + 1], mesh.pos[i * 3 + 2], t), i * 3);
  }
  const len = (p: Float32Array, a: number, b: number) =>
    Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);
  let worst = 1;
  for (let k = 0; k < mesh.index.length; k += 3) {
    const tri = [mesh.index[k], mesh.index[k + 1], mesh.index[k + 2]];
    for (let e = 0; e < 3; e++) {
      const a = tri[e], b = tri[(e + 1) % 3];
      const rest = len(mesh.pos, a, b);
      if (rest > 1e-4) worst = Math.max(worst, len(posed, a, b) / rest);
    }
  }
  return worst;
}

describe("ウミガメのあし", () => {
  it("3Dモデルに高・中・低の3つがある", () => {
    expect(Object.keys(meshes).sort()).toEqual(["turtle_0", "turtle_1", "turtle_2"]);
  });

  it("羽ばたいても、面が引き伸ばされない（あしの一部だけが取り残されない）", () => {
    for (const [name, mesh] of Object.entries(meshes)) {
      // 1回の羽ばたき（約5秒）を細かく見る
      for (let t = 0; t < 5.1; t += 0.25) {
        expect(worstStretch(mesh, t), `${name} @${t.toFixed(2)}s`).toBeLessThan(1.5);
      }
    }
  });

  it("前あしは先まで動く", () => {
    const mesh = meshes.turtle_0;
    let tipMoved = 0, tips = 0;
    for (let i = 0; i < mesh.pos.length / 3; i++) {
      const [x, y, z] = [mesh.pos[i * 3], mesh.pos[i * 3 + 1], mesh.pos[i * 3 + 2]];
      if (Math.abs(x) <= 0.8) continue;
      tips++;
      // 羽ばたきのいちばん上（前あしの付け根で sin が 1 になるころ）
      const [px, py] = poseTurtleVertex(x, y, z, (Math.PI / 2) / TURTLE_FLIPPERS.speed);
      if (Math.hypot(px - x, py - y) > 0.02) tipMoved++;
    }
    expect(tips).toBeGreaterThan(0);
    expect(tipMoved, "前あしの先が動いていない").toBe(tips);
  });

  it("どの時刻でも、甲羅（あしと頭より上の y > 0.03）は動かない", () => {
    // 後ろあしは前あしと位相がずれる（rearPhase）ので、1点の時刻だけでは見逃す
    for (const [name, mesh] of Object.entries(meshes)) {
      for (let t = 0; t < 5.1; t += 0.25) {
        let worst = 0;
        for (let i = 0; i < mesh.pos.length / 3; i++) {
          const [x, y, z] = [mesh.pos[i * 3], mesh.pos[i * 3 + 1], mesh.pos[i * 3 + 2]];
          if (y <= 0.03) continue;
          const [px, py] = poseTurtleVertex(x, y, z, t);
          worst = Math.max(worst, Math.hypot(px - x, py - y));
        }
        expect(worst, `${name} @${t.toFixed(2)}s`).toBeLessThan(0.005);
      }
    }
  });

  it("あしを回す軸は、3Dモデルの甲羅の外形より外にある（内側にすると甲羅の縁まで羽ばたく）", () => {
    for (const [name, mesh] of Object.entries(meshes)) {
      let dome = 0, domeBack = 0;
      for (let i = 0; i < mesh.pos.length / 3; i++) {
        const [x, y, z] = [mesh.pos[i * 3], mesh.pos[i * 3 + 1], mesh.pos[i * 3 + 2]];
        if (y <= 0.03) continue;
        dome = Math.max(dome, Math.abs(x));
        if (z < TURTLE_FLIPPERS.rearZoneZ[1]) domeBack = Math.max(domeBack, Math.abs(x));
      }
      expect(TURTLE_FLIPPERS.frontEdges[0], `${name} 前あし`).toBeGreaterThan(dome);
      expect(TURTLE_FLIPPERS.rearEdges[0], `${name} 後ろあし`).toBeGreaterThan(domeBack);
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
    for (const v of Object.values(TURTLE_FLIPPERS).flat()) expect(glsl, String(v)).toContain(glslNumber(v));
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
