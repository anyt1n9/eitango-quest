import { abundance } from "./depth";

/**
 * 写真から作った魚（three.js を使わない純粋なモジュール）。
 *
 * どれも Fish Kit（CC0。src/ocean/assets/README.md）の作り方で、真横の写真1枚から形を起こしたもの。
 * カタクチイワシ（魚の群れ）はキットのモデルそのまま、ほかの5種は ChatGPT の画像生成で作った写真から
 * scripts/fishgen/make_photo_fish.py で作った（src/ocean/assets/ocean-<id>.glb）。
 *
 * キットの魚は「頭が +X・背が +Y・長さ方向が X・単位はメートル（実物の大きさ）」で作られている
 * （キットの fish-kit.js は Y 軸まわりに -90° 回して +Z を向かせる）。この海の生き物は頭が +Z なので、
 * 同じように回し、場面での長さにそろえる。
 */
export type PhotoFishId = "anchovy" | "lanternfish" | "butterflyfish" | "damselfish" | "wrasse" | "anglerfish";

export const PHOTO_FISH_IDS: readonly PhotoFishId[] = ["anchovy", "lanternfish", "butterflyfish", "damselfish", "wrasse", "anglerfish"];

/**
 * 場面での長さ（頭の先から尾の先まで）。実物よりずっと大きいのは、数m先を泳ぐので実物大では点にしか見えないため。
 *  - anchovy … 群れの計算（boids）と尾の振りが前提にしている長さ。以前その場で作っていた形（体が z ±0.26、尾びれの先が -0.36）と同じ
 *  - lanternfish … イワシの7割。写真の形を使う前は、深い所で群れの大きさを7割に縮めていた
 *  - butterflyfish / damselfish … 以前その場で作っていた形と同じ（1匹ごとの大きさは場面の rfScale で変える）
 *  - wrasse … 以前の Blender の形と同じ長さ
 *  - anglerfish … 以前の Blender の形（提灯を前へ突き出していた）の体と同じくらい
 */
export const PHOTO_FISH_LENGTH: Record<PhotoFishId, number> = {
  anchovy: 0.62,
  lanternfish: 0.434,
  butterflyfish: 0.18,
  damselfish: 0.18,
  wrasse: 1.64,
  anglerfish: 1.2,
};

/** orientPhotoFish がどうそろえたか（キットの座標の点を場面の座標へ移すのに使う） */
export interface PhotoFishFit {
  /** 元の長さ（メートル） */
  length: number;
  /** 長さ方向の中央（キットの X） */
  mid: number;
  /** 拡大率 */
  scale: number;
}

/**
 * キットの魚の位置と法線を、その場で書き換えて場面の向きと長さにそろえる。
 * 頭が +Z、背が +Y、長さの中央が原点になる
 */
export function orientPhotoFish(position: Float32Array, normal: Float32Array | null, length: number): PhotoFishFit {
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < position.length; i += 3) {
    minX = Math.min(minX, position[i]);
    maxX = Math.max(maxX, position[i]);
  }
  const original = maxX - minX;
  if (!(original > 0)) throw new Error("魚の形の長さが測れません");
  const mid = (minX + maxX) / 2, s = length / original;
  // Y 軸まわりに -90°：x' = -z、z' = x（+X の頭が +Z へ向く。回すだけなので裏表は変わらない）
  for (let i = 0; i < position.length; i += 3) {
    const x = position[i], y = position[i + 1], z = position[i + 2];
    position[i] = -z * s;
    position[i + 1] = y * s;
    position[i + 2] = (x - mid) * s;
  }
  if (normal) {
    for (let i = 0; i < normal.length; i += 3) {
      const x = normal[i], z = normal[i + 2];
      normal[i] = -z;
      normal[i + 2] = x;
    }
  }
  return { length: original, mid, scale: s };
}

/** キットの座標で体の真ん中の面（Z=0）にある点を、orientPhotoFish でそろえた場面の座標へ */
export function kitPointToScene(x: number, y: number, fit: PhotoFishFit): [number, number, number] {
  return [0, y * fit.scale, (x - fit.mid) * fit.scale];
}

/**
 * チョウチンアンコウの提灯（写真の頭の上の白い玉）の中心と半径。キットの座標（メートル）。
 * scripts/fishgen/make_photo_fish.py が写真から測って出す値（ANGLERFISH_LURE_KIT）と同じにする。
 * 提灯は背びれと同じ「体の真ん中の板」に写真ごと貼られているので、海ではこの点のまわりを光らせ、
 * この点からの光で顔を照らす
 */
export const ANGLERFISH_LURE_KIT = { x: 0.17, y: 0.0823, radius: 0.0157 };

/**
 * その水深で泳がせる写真の魚。使わない深さの魚は取りに行かない
 * （はじめて海を開いた人は浅瀬にいるので、深海の魚の分まで通信しない）。
 * 見せるかどうかの決め方（oceanScene.ts の applyHabitat）と合わせる
 */
export function photoFishAt(depth: number): PhotoFishId[] {
  const out: PhotoFishId[] = [];
  const school = abundance("fish", depth) > 0, lantern = abundance("lantern", depth);
  if (school && lantern < 1) out.push("anchovy");
  if (school && lantern > 0) out.push("lanternfish");
  if (abundance("reeffish", depth) > 0) out.push("butterflyfish", "damselfish");
  if (abundance("wrasse", depth) >= 0.5) out.push("wrasse");
  if (abundance("angler", depth) >= 0.5) out.push("anglerfish");
  return out;
}

const ss = (e0: number, e1: number, x: number) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};
const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

/**
 * ハダカイワシの模様（アトラス。RGBA、上の行から）から、発光器（明るい青白い点）だけを拾って、光の強さ（0〜255）を
 * 同じ大きさの RGBA に書く。海ではこれを光らせる。
 *
 * 模様を描くときにその場で色から拾うと、遠くで小さく縮めた模様（mipmap）では点が体の暗い色と混ざって拾えず、
 * 群れが黒い影にしか見えなかった。拾った結果を別の模様にしておけば、縮めても「点がまばらに光る」平均の明るさが残る。
 * 体の模様はアトラスの上の 400/640 だけ（下はひれの板。ひれは写真の背景の青が透けて青白く、点と見分けにくい）
 */
export function photophoreMask(rgba: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  const bodyRows = Math.floor(height * (400 / 640));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let m = 0;
      if (y < bodyRows) {
        const r = toLinear(rgba[i]), g = toLinear(rgba[i + 1]), b = toLinear(rgba[i + 2]);
        m = ss(0.4, 0.65, b) * ss(0.18, 0.32, b - r) * ss(0.25, 0.4, g);
      }
      const v = Math.round(m * 255);
      out[i] = out[i + 1] = out[i + 2] = v;
      out[i + 3] = 255;
    }
  }
  return out;
}
