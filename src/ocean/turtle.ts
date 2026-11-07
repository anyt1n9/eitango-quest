/**
 * ウミガメのあしの動かし方（three.js を使わない純粋なモジュール）。
 *
 * 3Dモデル（scripts/blender/make_ocean_assets.py の build_turtle）は1つの形で、あしの動きはシェーダーで付ける。
 * どの頂点があしかはモデルの中の位置で決める（座標は glTF：x 横・y 上・z 前）。
 *   - 前あし：甲羅の縁（|x| 0.42）より外。縁を軸に、羽ばたくように上下させる（先ほど少し遅れる）
 *   - 後ろあし：甲羅の後ろ（z < -0.25）で、甲羅の縁（|x| 0.3）より外。小さく動かす
 * 前あしは後ろへ反っていて、先は z = -0.2 あたりまで来る。以前は前後を z = -0.12 で切っていたため、
 * 前あしの先（約40頂点）だけが動かず、動く所との間の面が引き伸ばされて、長方形の板が付いて見えた。
 * 軸は甲羅の外形のすぐ外に置く（内側にすると甲羅の縁まで羽ばたく）。
 *
 * シェーダー（oceanScene.ts の turtleMat）は下の数でできている。動かし方を変えるときは
 * `poseTurtleVertex` も同じに直し、tests/oceanTurtle.test.ts（出荷する3Dモデルで、面が引き伸ばされないこと）を通す。
 */
export const TURTLE_FLIPPERS = {
  /** 前あしを回す軸（甲羅の縁の |x|） */
  frontPivot: 0.42,
  /** 後ろあしを回す軸（甲羅の後ろの縁の |x|） */
  rearPivot: 0.3,
  /** z がここから下がると後ろあしの側（前あしの先は z = -0.2 あたりまでなので、それより後ろ） */
  rearFrom: -0.25,
  rearTo: -0.31,
} as const;

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** シェーダーと同じ動かし方で、時刻 time のときの頂点の位置を返す（z は変わらない） */
export function poseTurtleVertex(x: number, y: number, z: number, time: number): [number, number, number] {
  const F = TURTLE_FLIPPERS;
  const ax = Math.abs(x), sx = x < 0 ? -1 : 1;
  const rearZone = ss(F.rearFrom, F.rearTo, z) * (1 - ss(0.55, 0.65, ax));
  const front = ss(F.frontPivot, F.frontPivot + 0.1, ax) * (1 - rearZone);
  const rear = ss(F.rearPivot, F.rearPivot + 0.08, ax) * rearZone;
  const ph = time * 1.25;
  const a = front * 0.6 * Math.sin(ph - Math.max(ax - F.frontPivot, 0) * 1.4) + rear * 0.3 * Math.sin(ph + 1.7);
  const pivot = rearZone > 0.5 ? F.rearPivot : F.frontPivot;
  const qx = ax - pivot;
  const c = Math.cos(a), s = Math.sin(a);
  return [sx * (pivot + qx * c - y * s), qx * s + y * c, z];
}
