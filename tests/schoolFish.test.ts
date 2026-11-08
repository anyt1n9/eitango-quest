import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { SCHOOL_FISH_LENGTH, orientSchoolFish } from "../src/ocean/schoolFish";

/**
 * 魚の群れの形（src/ocean/assets/ocean-anchovy.glb。Fish Kit のカタクチイワシ、CC0）。
 *
 * GPU の無い CI では海を描かないので、出荷するファイルそのものを読んで確かめる。
 *   - 場面のコードが前提にしている作り（数値を詰めていない float の位置・法線・UV と、webp の模様1枚）
 *   - 向きと長さをそろえたあと、頭が +Z・背が +Y・長さが群れの計算と同じ（以前の形と同じ）になること
 *   - 出どころとライセンス（CC0）の写しが、ファイルと一緒に置いてあること
 * 形を差し替えたら（キットの新しい版・別の魚）このテストを通すこと。
 */

const ASSETS = new URL("../src/ocean/assets/", import.meta.url);
const file = readFileSync(new URL("ocean-anchovy.glb", ASSETS));

type Accessor = { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string };
const gltf = (() => {
  const jsonLen = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLen).toString("utf8"));
  const binStart = 20 + jsonLen + 8;
  const bin = file.subarray(binStart, binStart + file.readUInt32LE(20 + jsonLen));
  const floats = (acc: Accessor, size: number) => {
    const view = json.bufferViews[acc.bufferView];
    const start = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const out = new Float32Array(acc.count * size);
    for (let i = 0; i < out.length; i++) out[i] = bin.readFloatLE(start + i * 4);
    return out;
  };
  return { json, floats };
})();
const prim = gltf.json.meshes[0].primitives[0];
const acc = (name: string): Accessor => gltf.json.accessors[prim.attributes[name]];

describe("魚の群れの形（カタクチイワシ）", () => {
  it("場面のコードが読める作り：float の位置・法線・UV と、webp の模様1枚（数値を詰めていない）", () => {
    expect(gltf.json.meshes).toHaveLength(1);
    for (const name of ["POSITION", "NORMAL", "TEXCOORD_0"]) {
      // oceanScene.ts は getAttribute(...).array をそのまま Float32Array に写す。詰めた整数だと形が崩れる
      expect(acc(name).componentType, name).toBe(5126);
    }
    expect(gltf.json.extensionsUsed ?? []).not.toContain("KHR_mesh_quantization");
    expect(gltf.json.extensionsUsed).toContain("EXT_texture_webp");
    expect(gltf.json.materials[0].pbrMetallicRoughness.baseColorTexture).toBeDefined();
    // 群れは何十匹も描くので軽い形（遠く用の約700面）を使う
    expect(gltf.json.accessors[prim.indices].count / 3).toBeLessThan(1000);
    expect(file.byteLength).toBeLessThan(200 * 1024);
  });

  it("向きと長さをそろえると、頭が +Z・背が +Y・長さが群れの計算と同じになる", () => {
    const pos = gltf.floats(acc("POSITION"), 3);
    const nor = gltf.floats(acc("NORMAL"), 3);
    // キットの魚は頭が +X（fish-kit.js の泳ぎの計算は uSnout - x を頭からの距離にしている）
    let head = 0, back = 0;
    for (let i = 0; i < pos.length; i += 3) {
      if (pos[i] > pos[head * 3]) head = i / 3;
      if (pos[i + 1] > pos[back * 3 + 1]) back = i / 3;
    }
    const backY = pos[back * 3 + 1];
    orientSchoolFish(pos, nor);

    let minZ = Infinity, maxZ = -Infinity, maxAbsX = 0;
    for (let i = 0; i < pos.length; i += 3) {
      minZ = Math.min(minZ, pos[i + 2]); maxZ = Math.max(maxZ, pos[i + 2]);
      maxAbsX = Math.max(maxAbsX, Math.abs(pos[i]));
    }
    expect(maxZ - minZ).toBeCloseTo(SCHOOL_FISH_LENGTH, 5);
    expect(maxZ).toBeCloseTo(SCHOOL_FISH_LENGTH / 2, 5);
    expect(pos[head * 3 + 2], "頭が前（+Z）を向いていない").toBeCloseTo(maxZ, 5);
    expect(pos[back * 3 + 1], "背が上を向いていない").toBeGreaterThan(0);
    expect(Math.sign(pos[back * 3 + 1])).toBe(Math.sign(backY));
    // 横幅は体長よりずっと細い（横倒しになっていない）
    expect(maxAbsX).toBeLessThan(SCHOOL_FISH_LENGTH * 0.25);
    // 回しただけなので、法線の長さは変わらない
    for (let i = 0; i < nor.length; i += 3) {
      expect(Math.hypot(nor[i], nor[i + 1], nor[i + 2])).toBeCloseTo(1, 2);
    }
  });

  it("長さの測れない形は断る（黙って無限大の大きさにしない）", () => {
    expect(() => orientSchoolFish(new Float32Array([0, 0, 0, 0, 1, 0]))).toThrow();
  });

  it("出どころとライセンス（CC0）の写しを、ファイルと一緒に置いている", () => {
    const license = readFileSync(new URL("LICENSE-fish-kit.txt", ASSETS), "utf8");
    expect(license).toContain("CC0 1.0");
    expect(license).toContain("ocean-anchovy.glb");
    const readme = readFileSync(new URL("README.md", ASSETS), "utf8");
    expect(readme).toContain("ocean-anchovy.glb");
    expect(readme).toContain("LICENSE-fish-kit.txt");
  });

  it("ビルドで付く名前が、サービスワーカーの「海の3D背景」の置き場所に入る（使った人の端末にだけ置く）", () => {
    const config = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
    const m = /urlPattern: \(\{ url \}\) => (\/.*\/)\.test\(url\.pathname\)/.exec(config);
    expect(m, "vite.config.ts の runtimeCaching が見つからない").not.toBeNull();
    const pattern = new RegExp(m![1].slice(1, -1));
    expect(pattern.test("/assets/ocean-anchovy-AbC123_x.glb")).toBe(true);
    expect(existsSync(new URL("ocean-anchovy.glb", ASSETS))).toBe(true);
  });
});
