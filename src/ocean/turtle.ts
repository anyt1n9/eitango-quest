/**
 * ウミガメのあしの動かし方（three.js を使わない純粋なモジュール）。
 *
 * 3Dモデル（src/ocean/assets/ocean-seaturtle.glb。scripts/fishgen/make_turtle.py が上と下から見た写真から作る）は
 * 1つの形で、あしの動きはシェーダーで付ける。どの頂点があしかは、モデルの頂点に付けた印で決める
 * （_FLIPPER =（前あしの重み、後ろあしの重み、回す軸の |x|）。座標は x 横・y 上・z 前）。
 *   - 前あし：付け根（甲羅・頭と接する所）の |x| を軸に、羽ばたくように上下させる（先ほど少し遅れる）
 *   - 後ろあし：同じく付け根を軸に、小さく動かす
 * 重みは付け根で 0、そこから外へなめらかに 1 になる。甲羅と頭の重みは 0 なので、どの時刻でも動かない。
 *
 * 以前の Blender のウミガメは「甲羅の縁（|x| 0.42）より外があし」と位置だけで決めていた。前後を分ける線の置き方を誤ると
 * 前あしの先だけが動かず、動く所との間の面が引き伸ばされて「長方形の板」に見えた（実機で言われた）。写真のカメは
 * 前あしの付け根が甲羅の縁より内側（首の横）にあり、位置だけでは決められないので、作るときに部位を分けて印を付けている。
 *
 * シェーダー（oceanScene.ts の turtleMat）の式は `turtleFlipperGlsl` がこの数から作り、
 * テスト（tests/oceanTurtle.test.ts）は同じ数で `poseTurtleVertex` を動かして、出荷する3Dモデルで確かめる。
 * 数は丸めずにそのままシェーダーに書く（`glslNumber`）。丸めると、テストとGPUで違う数で動く。
 */
export const TURTLE_SWIM = {
  /** 1秒あたりの羽ばたきの進み（ラジアン） */
  speed: 1.25,
  /** 前あしの振れ幅（ラジアン）と、軸から先へ行くほどの遅れ */
  frontAngle: 0.6,
  frontLag: 1.4,
  /** 後ろあしの振れ幅（ラジアン）と、前あしとの位相のずれ */
  rearAngle: 0.3,
  rearPhase: 1.7,
} as const;

/** GLSL の小数として、丸めずに書く（3 → "3.0"、0.425 → "0.425"） */
export function glslNumber(v: number): string {
  if (!Number.isFinite(v)) throw new Error(`GLSL に書けない数: ${v}`);
  const s = String(v);
  return /[.e]/.test(s) ? s : `${s}.0`;
}

/**
 * 頂点シェーダーの中の、あしを回す角度と軸を求める部分（ax = |x|、aFlipper、uTime が要る）。
 * 求めるのは a（回す角度）・pivot（軸の |x|）・ph（羽ばたきの位相）
 */
export function turtleFlipperGlsl(): string {
  const F = TURTLE_SWIM, n = glslNumber;
  return `
        float pivot = aFlipper.z;
        float ph = uTime * ${n(F.speed)};
        float a = aFlipper.x * ${n(F.frontAngle)} * sin(ph - max(ax - pivot, 0.0) * ${n(F.frontLag)})
          + aFlipper.y * ${n(F.rearAngle)} * sin(ph + ${n(F.rearPhase)});`;
}

/**
 * シェーダー（turtleFlipperGlsl と同じ式）で動かしたときの、時刻 time の頂点の位置（z は変わらない）。
 * flipper は頂点の印（前あしの重み、後ろあしの重み、回す軸の |x|）
 */
export function poseTurtleVertex(
  x: number, y: number, z: number, time: number, flipper: readonly [number, number, number],
): [number, number, number] {
  const F = TURTLE_SWIM;
  const [front, rear, pivot] = flipper;
  const ax = Math.abs(x), sx = x < 0 ? -1 : 1;
  const ph = time * F.speed;
  const a = front * F.frontAngle * Math.sin(ph - Math.max(ax - pivot, 0) * F.frontLag)
    + rear * F.rearAngle * Math.sin(ph + F.rearPhase);
  const qx = ax - pivot;
  const c = Math.cos(a), s = Math.sin(a);
  return [sx * (pivot + qx * c - y * s), qx * s + y * c, z];
}
