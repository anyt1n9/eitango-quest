import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import {
  ANGLERFISH_LURE_KIT, PHOTO_FISH_IDS, PHOTO_FISH_LENGTH, kitPointToScene, orientPhotoFish, photoFishAt, photophoreMask, type PhotoFishId,
} from "../src/ocean/photoFish";
import { DEPTH_STAGES, abundance } from "../src/ocean/depth";

/**
 * 写真から作った魚（src/ocean/assets/ocean-<id>.glb。Fish Kit の作り方、CC0）。
 *
 * GPU の無い CI では海を描かないので、出荷するファイルそのものを読んで確かめる。
 *   - 場面のコードが前提にしている作り（数値を詰めていない float の位置・法線・UV と、webp の模様1枚）
 *   - 向きと長さをそろえたあと、頭が +Z・背が +Y・長さが場面の値になること
 *   - チョウチンアンコウの提灯の位置が、形の上（頭の上の板）にあること
 *   - 出どころとライセンス（CC0）の写しが、ファイルと一緒に置いてあること
 * 形を差し替えたら（scripts/fishgen/make_photo_fish.py で作り直した・キットの新しい版）このテストを通すこと。
 */

const ASSETS = new URL("../src/ocean/assets/", import.meta.url);

type Accessor = { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string };
function readGlb(id: PhotoFishId) {
  const file = readFileSync(new URL(`ocean-${id}.glb`, ASSETS));
  const jsonLen = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLen).toString("utf8"));
  const binStart = 20 + jsonLen + 8;
  const bin = file.subarray(binStart, binStart + file.readUInt32LE(20 + jsonLen));
  const prim = json.meshes[0].primitives[0];
  const acc = (name: string): Accessor => json.accessors[prim.attributes[name]];
  const floats = (a: Accessor, size: number) => {
    const view = json.bufferViews[a.bufferView];
    const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < out.length; i++) out[i] = bin.readFloatLE(start + i * 4);
    return out;
  };
  return { file, json, prim, acc, floats };
}

describe.each(PHOTO_FISH_IDS)("写真の魚の形（%s）", (id) => {
  const g = readGlb(id);

  it("場面のコードが読める作り：float の位置・法線・UV と、webp の模様1枚（数値を詰めていない）", () => {
    expect(g.json.meshes).toHaveLength(1);
    for (const name of ["POSITION", "NORMAL", "TEXCOORD_0"]) {
      // oceanScene.ts は getAttribute(...).array をそのまま Float32Array に写す。詰めた整数だと形が崩れる
      expect(g.acc(name).componentType, name).toBe(5126);
    }
    expect(g.json.extensionsUsed ?? []).not.toContain("KHR_mesh_quantization");
    expect(g.json.extensionsUsed).toContain("EXT_texture_webp");
    expect(g.json.materials[0].pbrMetallicRoughness.baseColorTexture).toBeDefined();
    // 群れや熱帯魚は何十匹も描くので、どれも遠く用の軽い形（約700面）を使う
    expect(g.json.accessors[g.prim.indices].count / 3).toBeLessThan(1000);
    expect(g.file.byteLength).toBeLessThan(200 * 1024);
  });

  it("向きと長さをそろえると、頭が +Z・背が +Y・長さが場面の値になる", () => {
    const pos = g.floats(g.acc("POSITION"), 3);
    const nor = g.floats(g.acc("NORMAL"), 3);
    // キットの魚は頭が +X（fish-kit.js の泳ぎの計算は uSnout - x を頭からの距離にしている）
    let head = 0, back = 0;
    for (let i = 0; i < pos.length; i += 3) {
      if (pos[i] > pos[head * 3]) head = i / 3;
      if (pos[i + 1] > pos[back * 3 + 1]) back = i / 3;
    }
    const length = PHOTO_FISH_LENGTH[id];
    orientPhotoFish(pos, nor, length);

    let minZ = Infinity, maxZ = -Infinity, maxAbsX = 0;
    for (let i = 0; i < pos.length; i += 3) {
      minZ = Math.min(minZ, pos[i + 2]); maxZ = Math.max(maxZ, pos[i + 2]);
      maxAbsX = Math.max(maxAbsX, Math.abs(pos[i]));
    }
    expect(maxZ - minZ).toBeCloseTo(length, 5);
    expect(maxZ).toBeCloseTo(length / 2, 5);
    expect(pos[head * 3 + 2], "頭が前（+Z）を向いていない").toBeCloseTo(maxZ, 5);
    expect(pos[back * 3 + 1], "背が上を向いていない").toBeGreaterThan(0);
    // 横幅は体長よりずっと細い（横倒しになっていない）
    expect(maxAbsX).toBeLessThan(length * 0.25);
    // 回しただけなので、法線の長さは変わらない
    for (let i = 0; i < nor.length; i += 3) {
      expect(Math.hypot(nor[i], nor[i + 1], nor[i + 2])).toBeCloseTo(1, 2);
    }
  });

  it("出どころの説明とライセンス（CC0）の写しに、このファイルが書いてある", () => {
    const license = readFileSync(new URL("LICENSE-fish-kit.txt", ASSETS), "utf8");
    expect(license).toContain("CC0 1.0");
    expect(license).toContain(`ocean-${id}.glb`);
    const readme = readFileSync(new URL("README.md", ASSETS), "utf8");
    expect(readme).toContain(`ocean-${id}.glb`);
    expect(readme).toContain("LICENSE-fish-kit.txt");
  });
});

describe("写真の魚（全体）", () => {
  it("長さの測れない形は断る（黙って無限大の大きさにしない）", () => {
    expect(() => orientPhotoFish(new Float32Array([0, 0, 0, 0, 1, 0]), null, 1)).toThrow();
  });

  it("チョウチンアンコウの提灯は、頭の上・体の前寄りにあり、そのまわりに板（写真の提灯）がある", () => {
    const g = readGlb("anglerfish");
    const pos = g.floats(g.acc("POSITION"), 3);
    const fit = orientPhotoFish(pos, null, PHOTO_FISH_LENGTH.anglerfish);
    const [, y, z] = kitPointToScene(ANGLERFISH_LURE_KIT.x, ANGLERFISH_LURE_KIT.y, fit);
    const L = PHOTO_FISH_LENGTH.anglerfish;
    expect(z, "頭の側にない").toBeGreaterThan(L * 0.25);
    expect(y, "体より上にない").toBeGreaterThan(0);
    // 提灯の半径の2倍以内に、形の頂点がある（光らせる所に何も無い、ということにしない）
    const r = ANGLERFISH_LURE_KIT.radius * fit.scale;
    let near = 0;
    for (let i = 0; i < pos.length; i += 3) {
      if (Math.hypot(pos[i], pos[i + 1] - y, pos[i + 2] - z) < r * 2.5) near++;
    }
    expect(near).toBeGreaterThan(0);
  });

  it("取りに行くのは、その深さで泳ぐ魚だけ（浅瀬では深海の魚の分まで通信しない）", () => {
    const at = (id: string) => DEPTH_STAGES.filter(s => photoFishAt(s.depth).includes(id as PhotoFishId)).map(s => s.id);
    expect(photoFishAt(DEPTH_STAGES[0].depth)).not.toContain("anglerfish");
    expect(photoFishAt(DEPTH_STAGES[0].depth)).not.toContain("lanternfish");
    expect(at("anglerfish")).toEqual(DEPTH_STAGES.filter(s => abundance("angler", s.depth) >= 0.5).map(s => s.id));
    expect(at("wrasse")).toEqual(DEPTH_STAGES.filter(s => abundance("wrasse", s.depth) >= 0.5).map(s => s.id));
    // どの段でも、その段で見える魚の形は取りに行く
    for (const s of DEPTH_STAGES) {
      const ids = photoFishAt(s.depth);
      if (abundance("reeffish", s.depth) > 0) expect(ids, s.id).toEqual(expect.arrayContaining(["butterflyfish", "damselfish"]));
      if (abundance("fish", s.depth) > 0) expect(ids.some(i => i === "anchovy" || i === "lanternfish"), s.id).toBe(true);
    }
  });

  it("ハダカイワシの発光器は、体の模様の中の明るい青白い点だけを拾う（銀色のうろこ・暗い体・ひれは拾わない）", () => {
    // 1列の模様：発光器、銀色のうろこ、暗い体、写真の背景の青。いちばん下の行（ひれの板の所）にも同じ発光器の色を置く
    const w = 4, h = 8;
    const px = new Uint8ClampedArray(w * h * 4);
    const colors = [[150, 225, 255], [190, 195, 200], [45, 35, 35], [20, 70, 170]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set([...colors[x], 255], (y * w + x) * 4);
    const m = photophoreMask(px, w, h);
    const at = (x: number, y: number) => m[(y * w + x) * 4];
    expect(at(0, 0)).toBeGreaterThan(200);
    expect(at(1, 0)).toBe(0);
    expect(at(2, 0)).toBe(0);
    expect(at(3, 0)).toBe(0);
    // アトラスの下の 240/640 はひれの板（背景の青が透けて青白い）なので拾わない
    expect(at(0, h - 1)).toBe(0);
    expect(m[3]).toBe(255);
  });

  it("ビルドで付く名前が、サービスワーカーの「海の3D背景」の置き場所に入り、置ける数に収まる", () => {
    const config = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
    const m = /urlPattern: \(\{ url \}\) => (\/.*\/)\.test\(url\.pathname\)/.exec(config);
    expect(m, "vite.config.ts の runtimeCaching が見つからない").not.toBeNull();
    const pattern = new RegExp(m![1].slice(1, -1));
    for (const id of PHOTO_FISH_IDS) {
      expect(pattern.test(`/assets/ocean-${id}-AbC123_x.glb`), id).toBe(true);
      expect(existsSync(new URL(`ocean-${id}.glb`, ASSETS)), id).toBe(true);
    }
    // 置ける数（maxEntries）を超えると古いものから捨てられ、オフラインで海の一部が欠ける。
    // three.js と OceanBackground の2つに、assets の glb をすべて足した数より多くしておく
    const glbs = readdirSync(ASSETS).filter(f => f.endsWith(".glb")).length;
    const max = Number(/cacheName: 'ocean-3d', expiration: \{ maxEntries: (\d+) \}/.exec(config)?.[1]);
    expect(max).toBeGreaterThanOrEqual(glbs + 2);
  });
});
