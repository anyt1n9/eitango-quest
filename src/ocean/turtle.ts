/**
 * ウミガメのあしの動かし方（three.js を使わない純粋なモジュール）。
 *
 * 3Dモデル（scripts/blender/make_ocean_assets.py の build_turtle）は1つの形で、あしの動きはシェーダーで付ける。
 * どの頂点があしかはモデルの中の位置で決める（座標は glTF：x 横・y 上・z 前）。
 *   - 前あし：甲羅の縁（|x| 0.42）より外。縁を軸に、羽ばたくように上下させる（先ほど少し遅れる）
 *   - 後ろあし：甲羅の後ろ（z < -0.25）で、甲羅の縁（|x| 0.3）より外。小さく動かす
 * 前あしは後ろへ反っていて、先は z = -0.2 あたりまで来る。以前は前後を z = -0.12 で切っていたため、
 * 前あしの先（約40頂点）だけが動かず、動く所との間の面が引き伸ばされて、長方形の板が付いて見えた。
 * 軸は甲羅の外形のすぐ外に置く（内側にすると甲羅の縁まで羽ばたく）。前後の境目では軸もなだらかに移す
 * （段差にすると、境目の近くの隣り合う頂点が別の軸で回って離れる）。
 *
 * シェーダー（oceanScene.ts の turtleMat）の式は `turtleFlipperGlsl` がこの数から作り、
 * テスト（tests/oceanTurtle.test.ts）は同じ数で `poseTurtleVertex` を動かして、出荷する3Dモデルで確かめる。
 * 数は丸めずにそのままシェーダーに書く（`glslNumber`）。丸めると、テストとGPUで違う数で動く。
 */
export const TURTLE_FLIPPERS = {
  /** 前あしの重みが 0→1 になる |x| の幅。始まりが前あしを回す軸（甲羅の縁） */
  frontEdges: [0.42, 0.52],
  /** 後ろあしの重みが 0→1 になる |x| の幅。始まりが後ろあしを回す軸（甲羅の後ろの縁） */
  rearEdges: [0.3, 0.38],
  /** z がこの幅で下がると後ろあしの側になる（前あしの先は z = -0.2 あたりまでなので、それより後ろ） */
  rearZoneZ: [-0.31, -0.25],
  /** 後ろあしの側でも、|x| がこの幅を越える所（前あしの先）は後ろあしにしない */
  rearZoneMaxAx: [0.55, 0.65],
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
 * 頂点シェーダーの中の、あしの重みと回す角度・軸を求める部分（ax = |x|、p = 頂点の位置、uTime が要る）。
 * smoothstep は小さい端を先に渡す（逆順は GLSL では未定義で、GPU によって 0 や NaN になる）
 */
export function turtleFlipperGlsl(): string {
  const F = TURTLE_FLIPPERS, n = glslNumber;
  return `
        float rearZone = (1.0 - smoothstep(${n(F.rearZoneZ[0])}, ${n(F.rearZoneZ[1])}, p.z))
          * (1.0 - smoothstep(${n(F.rearZoneMaxAx[0])}, ${n(F.rearZoneMaxAx[1])}, ax));
        float front = smoothstep(${n(F.frontEdges[0])}, ${n(F.frontEdges[1])}, ax) * (1.0 - rearZone);
        float rear = smoothstep(${n(F.rearEdges[0])}, ${n(F.rearEdges[1])}, ax) * rearZone;
        float ph = uTime * ${n(F.speed)};
        float a = front * ${n(F.frontAngle)} * sin(ph - max(ax - ${n(F.frontEdges[0])}, 0.0) * ${n(F.frontLag)})
          + rear * ${n(F.rearAngle)} * sin(ph + ${n(F.rearPhase)});
        float pivot = mix(${n(F.frontEdges[0])}, ${n(F.rearEdges[0])}, rearZone);`;
}

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** シェーダー（turtleFlipperGlsl と同じ式）で動かしたときの、時刻 time の頂点の位置（z は変わらない） */
export function poseTurtleVertex(x: number, y: number, z: number, time: number): [number, number, number] {
  const F = TURTLE_FLIPPERS;
  const ax = Math.abs(x), sx = x < 0 ? -1 : 1;
  const rearZone = (1 - ss(F.rearZoneZ[0], F.rearZoneZ[1], z)) * (1 - ss(F.rearZoneMaxAx[0], F.rearZoneMaxAx[1], ax));
  const front = ss(F.frontEdges[0], F.frontEdges[1], ax) * (1 - rearZone);
  const rear = ss(F.rearEdges[0], F.rearEdges[1], ax) * rearZone;
  const ph = time * F.speed;
  const a = front * F.frontAngle * Math.sin(ph - Math.max(ax - F.frontEdges[0], 0) * F.frontLag)
    + rear * F.rearAngle * Math.sin(ph + F.rearPhase);
  const pivot = F.frontEdges[0] + (F.rearEdges[0] - F.frontEdges[0]) * rearZone;
  const qx = ax - pivot;
  const c = Math.cos(a), s = Math.sin(a);
  return [sx * (pivot + qx * c - y * s), qx * s + y * c, z];
}
