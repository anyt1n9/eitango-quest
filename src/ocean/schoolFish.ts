/**
 * 魚の群れの1匹の形（three.js を使わない純粋なモジュール）。
 *
 * 形は Fish Kit（CC0。src/ocean/assets/README.md）のカタクチイワシ（ocean-anchovy.glb）。
 * キットの魚は「頭が +X・背が +Y・長さ方向が X・単位はメートル（実物の大きさ）」で作られている
 * （キットの fish-kit.js は Y 軸まわりに -90° 回して +Z を向かせる）。この海の生き物は頭が +Z なので、
 * 同じように回し、群れの計算（boids）が前提にしている長さにそろえる。
 */

/**
 * 群れの1匹の長さ（場面の単位）。以前その場で作っていた形（体が z ±0.26、尾びれの先が -0.36）と同じにして、
 * 群れの計算・尾の振り（シェーダーの `tail`）・大きさのばらつき（fScale）をそのまま使う。
 * 実物（13cm）よりずっと大きいのは、数m先を泳ぐので実物大では点にしか見えないため（熱帯魚と同じ）
 */
export const SCHOOL_FISH_LENGTH = 0.62;

/**
 * キットの魚の位置と法線を、その場で書き換えて群れの向きと長さにそろえる。
 * 頭が +Z、背が +Y、長さの中央が原点になる。戻り値は元の長さ（メートル）
 */
export function orientSchoolFish(position: Float32Array, normal: Float32Array | null = null): number {
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < position.length; i += 3) {
    minX = Math.min(minX, position[i]);
    maxX = Math.max(maxX, position[i]);
  }
  const length = maxX - minX;
  if (!(length > 0)) throw new Error("魚の形の長さが測れません");
  const mid = (minX + maxX) / 2, s = SCHOOL_FISH_LENGTH / length;
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
  return length;
}
