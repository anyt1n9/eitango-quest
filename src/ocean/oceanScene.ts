/**
 * 海の3D背景（three.js）。
 *
 * 画像ファイルは使わない。光の筋・水底の光の網目・漂う粒・魚の群れはその場で計算して描き、
 * マンタ・サンゴ・岩・海草は Blender でプログラム生成した3Dモデル（src/ocean/assets/ocean.glb、
 * 生成は scripts/blender/make_ocean_assets.py）を読む。
 *
 * 水は赤い光から吸収するので、深いほど赤が消えて青だけが残る（色はすべて
 * 「日光が水を通ってどれだけ残るか」から計算する）。水深は覚えた語数で決まり
 * （src/ocean/depth.ts）、そこに住む生き物の数も水深から決める（`abundance`）。
 * 水深が変わったときは、数秒かけて潜る（浮かぶ）。
 *
 * このファイルは three.js ごと大きいので、背景を「海（3D）」にした人にだけ読み込む
 * （src/components/OceanBackground.tsx から動的に import する）。
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { judge, tierSpecs, type OceanTier, isSoftwareRenderer } from "./quality";
import { ANGLER_RADIUS, MANTA_RADIUS, SCHOOL_SWAY, TURTLE_RADIUS, WHALESHARK_RADIUS, WRASSE_RADIUS, swimSpread } from "./swim";
import { abundance, depthAlong, type Dweller } from "./depth";

export interface OceanStatus {
  tier: OceanTier;
  fps: number;
  /** ブラウザが毎秒30コマに制限しているとみなしたか */
  throttled: boolean;
  /** 「低」でも重いため、止めた1枚にしたか */
  frozen: boolean;
  modelsLoaded: boolean;
}

export interface OceanScene {
  /** false にすると描くのをやめる（出題中・画面が裏に回ったとき） */
  setActive(active: boolean): void;
  /** false にすると止めた1枚だけを描く（「視差効果を減らす」・メニューの「背景の動き」） */
  setMotion(motion: boolean): void;
  /**
   * 水深（m）を変える。animate なら数秒かけて潜る（浮かぶ）。描いていないあいだ（出題中・裏に回った）は
   * 待っておき、次に描きはじめたときに潜る。止めた1枚（motion=false）のときは、すぐその深さを描く
   */
  setDepth(depth: number, animate: boolean): void;
  dispose(): void;
}

export interface OceanOptions {
  modelUrl: string;
  motion: boolean;
  /** はじめの水深（m）。省くと6m */
  depth?: number;
  onStatus?: (s: OceanStatus) => void;
  /**
   * 描き続けられなくなった（3Dモデルを取れない・WebGL を失って戻らない）。
   * 呼ばれたら、呼び出し側は片付けて静かな地に切り替える
   */
  onFail?: (reason: "model" | "context-lost") => void;
}

/** 日光が水を1m 通るごとに弱まる割合（赤・緑・青）。赤が最初に消える */
const KD: [number, number, number] = [0.2, 0.06, 0.028];
/** 水深を渡されなかったときの水深（m）。段階③の前はこの深さだけを描いていた */
const DEFAULT_DEPTH = 6;
/** 水の見通し（大きいほどかすむ。試作で「モデルがかすんで見えない」と言われて半分以下にした） */
const FOG = 0.45;
const HALF_SPAN = 2.1;
/** 水深を変えるときに潜る（浮かぶ）秒数 */
const DESCENT_SEC = 5;
/**
 * 目の慣れ（露出）の上限。暗いほど持ち上げるが、上限が高いと薄明の海（90m）が浅い海と
 * 同じ明るさの青になり、潜った感じがしない。35m（2.9）までは上限に当たらない
 */
const EXPOSURE_MAX = 3;

const exposureFor = (d: number) => Math.min(Math.max(Math.pow(Math.exp(-KD[1] * d), -0.5), 1), EXPOSURE_MAX);

/* ------------------------------------------------------------------ GLSL */
const WATER = /* glsl */ `
uniform float uTime;
uniform float uDepth;
uniform float uExposure;
uniform vec3 uKd;
uniform vec3 uSun;
uniform vec3 uSunDir;
uniform float uCaustic;
uniform float uFog;
uniform float uGlow;
uniform float uSnow;
uniform float uLantern;

vec3 sunAt(float d) { return uSun * exp(-uKd * max(d, 0.0)); }
vec3 waterTint(float d) { return vec3(0.07, 0.42, 0.64) * sunAt(d); }
vec3 horizonCol() { return waterTint(uDepth) * 0.55; }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 finalize(vec3 c) { return pow(aces(c * uExposure), vec3(1.0 / 2.2)); }
vec3 throughWater(vec3 surf, float dist) {
  vec3 T = exp(-(uKd * 0.6 + vec3(0.045)) * uFog * dist);
  T *= 1.0 - smoothstep(45.0, 85.0, dist);
  return surf * T + horizonCol() * (1.0 - T);
}
float h12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 h22(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), u.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), u.x), u.y);
}
// Distance between the two nearest moving cell points: small along cell borders,
// which gives the bright net of focused sunlight on a shallow sea floor.
float cellEdge(vec2 uv, float t) {
  vec2 i = floor(uv), f = fract(uv);
  float f1 = 8.0, f2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = h22(i + g);
    o = 0.5 + 0.45 * sin(t * (0.6 + o) + 6.2831 * o);
    vec2 r = g + o - f;
    float dd = dot(r, r);
    if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) { f2 = dd; }
  }
  return sqrt(f2) - sqrt(f1);
}
float causticRaw(vec2 uv, float t) {
  // bend the straight cell borders into the wavy lines real caustics have
  uv += vec2(vnoise(uv * 0.7 + t * 0.12), vnoise(uv * 0.7 + 5.3 - t * 0.1)) * 0.9;
  float c = pow(1.0 - smoothstep(0.0, 0.26, cellEdge(uv, t)), 3.0);
  if (uCaustic > 0.8) {
    c = c * 0.55 + pow(1.0 - smoothstep(0.0, 0.2, cellEdge(uv * 1.63 + 7.3, t * 1.27)), 3.0) * 0.45;
  }
  return c;
}
float causticAt(vec3 wp, float d) {
  if (uCaustic <= 0.0) return 0.0;
  vec2 uv = wp.xz * 2.1 + vec2(sin(uTime * 0.05) * 0.6, uTime * 0.02);
  float c = causticRaw(uv, uTime * 0.9);
  c *= 0.55 + 0.45 * vnoise(wp.xz * 0.12 + uTime * 0.04);
  return c * uCaustic * exp(-max(d, 0.0) / 12.0) * 1.2;
}
`;

const OBJ_FRAG = WATER + /* glsl */ `
  varying vec3 vWorld; varying vec3 vN; varying vec3 vColor;
  void main() {
    float d = uDepth - vWorld.y;
    vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
    vec3 L = sunAt(d);
    float c = causticAt(vWorld, d) * smoothstep(0.1, 0.8, n.y);
    float det = 0.8 + 0.35 * vnoise(vWorld.xz * 7.0 + vWorld.y * 5.0);
    vec3 alb = vColor * det;
    vec3 lit = alb * (L * (0.2 + 0.8 * max(n.y * 0.85 + 0.15, 0.0)) * (0.6 + 1.5 * c) + waterTint(d) * 0.32);
    gl_FragColor = vec4(finalize(throughWater(lit, length(vWorld - cameraPosition))), 1.0);
  }`;

/** 泳ぐ生き物（マンタ・ウミガメ・ナポレオンフィッシュ）の色：頂点色に、深さの光と水底の光の網目を当てる */
const CREATURE_FRAG = WATER + /* glsl */ `
  varying vec3 vWorld; varying vec3 vN; varying vec3 vColor;
  void main() {
    float d = uDepth - vWorld.y;
    vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
    vec3 L = sunAt(d);
    float c = causticAt(vWorld, d) * smoothstep(0.2, 0.8, n.y);
    vec3 lit = vColor * (L * (0.25 + 0.75 * max(n.y, 0.0)) * (0.7 + 1.2 * c) + waterTint(d) * 0.4);
    gl_FragColor = vec4(finalize(throughWater(lit, length(vWorld - cameraPosition))), 1.0);
  }`;

const REEF_VERT = /* glsl */ `
  uniform float uTime;
  attribute vec3 aCol; attribute vec3 aTint;
  varying vec3 vWorld; varying vec3 vN; varying vec3 vColor;
  void main() {
    vec3 p = position;
    #ifdef FAN_SWAY
      float h = clamp(p.y, 0.0, 1.6);
      p.z += sin(uTime * 0.8 + instanceMatrix[3].x * 1.3) * 0.05 * h * h;
    #endif
    #ifdef GRASS_SWAY
      // The surge pushes the meadow back and forth as a travelling wave;
      // each blade lags a little so a clump never moves as one sheet.
      float h = clamp(p.y / 0.75, 0.0, 1.0);
      float ph = uTime * 1.1 - instanceMatrix[3].z * 0.35 + instanceMatrix[3].x * 0.15 + (p.x + p.z) * 7.0;
      vec2 sway = vec2(sin(ph) * 0.13 + sin(uTime * 2.3 + p.x * 23.0) * 0.015, cos(ph * 0.7) * 0.05) * h * h;
      p.xz += sway;
      p.y -= dot(sway, sway) * 0.8;
    #endif
    vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vWorld = wp.xyz; vColor = aCol * aTint;
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

/* ------------------------------------------------------------------ JS helpers */
function hash3(x: number, y: number, z: number) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    r += (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w) * hash3(xi + dx, yi + dy, zi + dz);
  }
  return r;
}
function fbm2(x: number, z: number) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < 4; i++) { s += a * vnoise3(x * f, 0.5, z * f); f *= 2.03; a *= 0.5; }
  return s;
}
/** 海底の高さ（カメラが y=0。奥へ行くほど少しずつ深くなる） */
export function seabedY(x: number, z: number) {
  return -4.6 + 0.06 * z + (fbm2(x * 0.07 + 3.1, z * 0.07 - 1.7) - 0.5) * 3.2 + (vnoise3(x * 0.6, 2.0, z * 0.6) - 0.5) * 0.25;
}
function smooth(a: number, b: number, x: number) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** クラゲが漂う高さの範囲（カメラが y=0）。下の端で現れ、上の端で消える（どちらも大きさで溶かす） */
const JELLY_BOTTOM = -4.2;
const JELLY_TOP = 2.6;

/**
 * クラゲ1匹ぶんの形（傘・触手・口腕）。Blender のモデルにしなかったのは、ほとんど透けた
 * 薄い形で、その場で計算するほうが軽く、動かし方（傘の脈打ち）もシェーダーで決めるため。
 * aPart: 0=傘 1=触手 2=口腕。aT: 付け根 0 → 先 1（傘は 0）
 */
function jellyGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], part: number[] = [], tt: number[] = [], idx: number[] = [];
  // bell: a lathe of a dome profile that turns slightly inward at the rim
  const profile = [[0.0, 0.3], [0.1, 0.29], [0.19, 0.25], [0.26, 0.18], [0.3, 0.1], [0.31, 0.03], [0.28, -0.01]];
  const SEG = 18;
  const lathe = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), SEG);
  lathe.computeVertexNormals();
  const lp = lathe.attributes.position, ln = lathe.attributes.normal;
  for (let i = 0; i < lp.count; i++) {
    pos.push(lp.getX(i), lp.getY(i), lp.getZ(i));
    nor.push(ln.getX(i), ln.getY(i), ln.getZ(i));
    part.push(0); tt.push(0);
  }
  idx.push(...Array.from(lathe.index!.array));
  lathe.dispose();
  // a strip hanging from (x, y, z), facing outward along angle a
  const strip = (a: number, r: number, y0: number, len: number, width: number, kind: number) => {
    const N = 10, base = pos.length / 3;
    const cx = Math.cos(a), cz = Math.sin(a);
    for (let s = 0; s <= N; s++) {
      const t = s / N;
      const w = width * (1 - t * 0.7);
      const x = cx * r * (1 - t * 0.25), z = cz * r * (1 - t * 0.25), y = y0 - t * len;
      pos.push(x - cz * w, y, z + cx * w, x + cz * w, y, z - cx * w);
      nor.push(cx, 0, cz, cx, 0, cz);
      part.push(kind, kind); tt.push(t, t);
      if (s < N) {
        const i = base + s * 2;
        idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
      }
    }
  };
  const TENTACLES = 10;
  for (let k = 0; k < TENTACLES; k++) {
    const a = (k / TENTACLES) * Math.PI * 2;
    strip(a, 0.27, 0.0, 0.9 + ((k * 7) % 5) * 0.12, 0.008, 1);
  }
  for (let k = 0; k < 4; k++) strip((k / 4) * Math.PI * 2 + 0.4, 0.05, 0.08, 0.55, 0.035, 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("aPart", new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute("aT", new THREE.Float32BufferAttribute(tt, 1));
  g.setIndex(idx);
  return g;
}

/** glTF のメッシュ（数値を詰めて保存されている）を、扱いやすい float の形に直す */
function plainGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const copy = (src: string, size: number, name: string) => {
    const a = mesh.geometry.getAttribute(src);
    if (!a) return;
    const arr = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) {
      arr[i * size] = a.getX(i);
      if (size > 1) arr[i * size + 1] = a.getY(i);
      if (size > 2) arr[i * size + 2] = a.getZ(i);
    }
    g.setAttribute(name, new THREE.BufferAttribute(arr, size));
  };
  copy("position", 3, "position");
  copy("normal", 3, "normal");
  copy("color", 3, "aCol");
  if (!g.getAttribute("aCol")) {
    const n = g.getAttribute("position").count;
    g.setAttribute("aCol", new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.6), 3));
  }
  if (mesh.geometry.index) g.setIndex(Array.from(mesh.geometry.index.array));
  mesh.updateWorldMatrix(true, false);
  g.applyMatrix4(mesh.matrixWorld);
  return g;
}

interface ReefPlan {
  name: string;
  /** 水深ごとの数を決める種類（src/ocean/depth.ts の abundance） */
  kind: Dweller;
  count: number;
  size: [number, number];
  squash: [number, number];
  sink: number;
  meadow?: boolean;
  tints: [number, number, number][];
}

/** 海底に並べるもの（数は画質「高」で、そのものがいちばん多い水深のとき） */
const REEF_PLAN: ReefPlan[] = [
  { name: "rock_a", kind: "rock", count: 16, size: [0.7, 1.7], squash: [0.6, 0.9], sink: 0.18, tints: [[1, 1, 1], [0.9, 0.92, 0.95], [1.08, 1.02, 0.95]] },
  { name: "rock_b", kind: "rock", count: 14, size: [0.5, 1.3], squash: [0.6, 0.9], sink: 0.15, tints: [[1, 1, 1], [0.95, 1, 0.92]] },
  { name: "staghorn_a", kind: "staghorn", count: 16, size: [0.9, 1.6], squash: [0.9, 1.1], sink: 0.03, tints: [[1, 1, 1], [0.92, 0.95, 1.12], [1.12, 0.96, 0.82]] },
  { name: "staghorn_b", kind: "staghorn", count: 14, size: [0.9, 1.5], squash: [0.9, 1.1], sink: 0.03, tints: [[1, 1, 1], [1.05, 0.85, 1.05]] },
  { name: "brain", kind: "brain", count: 14, size: [0.3, 0.75], squash: [0.9, 1.1], sink: 0.04, tints: [[1, 1, 1], [0.85, 1.1, 0.85], [1.1, 0.9, 0.8]] },
  { name: "fan", kind: "fan", count: 12, size: [0.8, 1.4], squash: [1, 1], sink: 0.02, tints: [[1, 1, 1], [0.8, 0.7, 1.3], [1.3, 0.9, 0.6]] },
  { name: "seagrass", kind: "seagrass", count: 150, size: [1.1, 1.9], squash: [0.7, 1.3], sink: 0, meadow: true, tints: [[1, 1, 1], [0.9, 1.08, 0.88], [1.12, 1.0, 0.82]] },
];

/* ------------------------------------------------------------------ scene */
export function createOceanScene(canvas: HTMLCanvasElement, opts: OceanOptions): OceanScene {
  // WebGL を使えない端末ではここで投げる（呼び出し側が静かな背景に切り替える）
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  // GPU ではなく CPU で描いている WebGL では3Dを描かない（呼び出し側が海の色の地に切り替える）
  {
    const gl = renderer.getContext();
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    if (isSoftwareRenderer(name)) {
      renderer.dispose();
      renderer.forceContextLoss();
      throw new Error(`GPU の無い WebGL のため3Dを描きません（${name}）`);
    }
  }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const dpr = window.devicePixelRatio || 1;
  const TIERS = tierSpecs(dpr);
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 160);
  const camBase = new THREE.Vector3(0, 0, 3);
  // 生き物の泳ぐ範囲の横の広がり。画面の形で決まるので resize() でだけ計算し直す（src/ocean/swim.ts）
  let spread = 1;
  const lookBase = new THREE.Vector3(0, -2.6, -10);

  const startDepth = opts.depth && opts.depth > 0 ? opts.depth : DEFAULT_DEPTH;
  const U = {
    uTime: { value: 0 },
    uDepth: { value: startDepth },
    uExposure: { value: exposureFor(startDepth) },
    uKd: { value: new THREE.Vector3(...KD) },
    uSun: { value: new THREE.Vector3(1.0, 0.97, 0.9).multiplyScalar(1.8) },
    uSunDir: { value: new THREE.Vector3(0.25, 1.0, -0.35).normalize() },
    uCaustic: { value: 1 },
    uFog: { value: FOG },
    /** 生き物の光（クラゲ・光る粒）の強さ。日の光が消える深さから */
    uGlow: { value: abundance("glow", startDepth) },
    /** マリンスノー（沈んでいく白い粒）の見えやすさ */
    uSnow: { value: abundance("snow", startDepth) },
    /** 魚の群れのうちハダカイワシの割合（深いほど 1。黒い体に、腹の発光器を光らせる） */
    uLantern: { value: abundance("lantern", startDepth) },
  };
  const mat = (o: THREE.ShaderMaterialParameters & { uniforms?: Record<string, THREE.IUniform> }) =>
    new THREE.ShaderMaterial({ ...o, uniforms: { ...U, ...(o.uniforms || {}) } });
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };

  /* ---- water behind everything ---- */
  const bgMat = track(mat({
    uniforms: { uInvVP: { value: new THREE.Matrix4() } },
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vNdc; void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: WATER + `
      uniform mat4 uInvVP; varying vec2 vNdc;
      void main() {
        vec4 p = uInvVP * vec4(vNdc, 1.0, 1.0);
        vec3 dir = normalize(p.xyz / p.w - cameraPosition);
        float up = dir.y;
        vec3 col = waterTint(max(uDepth - up * 60.0, 0.0)) * 0.55;
        float shallow = exp(-uDepth / 18.0);
        float window = smoothstep(0.12, 0.85, up);
        vec2 suv = dir.xz / max(up, 0.06) * 4.0;
        float rip = causticRaw(suv, uTime * 0.8);
        col += uSun * shallow * window * (0.22 + 0.3 * rip) * 0.55;
        col += uSun * shallow * pow(max(dot(dir, uSunDir), 0.0), 18.0) * 1.2;
        gl_FragColor = vec4(finalize(col), 1.0);
      }`,
  }));
  const bg = new THREE.Mesh(track(new THREE.PlaneGeometry(2, 2)), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -1000;
  scene.add(bg);

  /* ---- sea floor ---- */
  const floorGeo = track(new THREE.PlaneGeometry(120, 120, 120, 120));
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(0, 0, -30);
  {
    const p = floorGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, seabedY(p.getX(i), p.getZ(i)));
    floorGeo.computeVertexNormals();
  }
  const floorMat = track(mat({
    vertexShader: `varying vec3 vWorld; varying vec3 vN;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: WATER + `
      varying vec3 vWorld; varying vec3 vN;
      void main() {
        float d = uDepth - vWorld.y;
        vec3 n = normalize(vN);
        float rip = sin(vWorld.x * 3.1 + sin(vWorld.z * 0.7) * 1.6) * 0.5 + 0.5;
        vec3 alb = vec3(0.64, 0.6, 0.48) * (0.86 + 0.14 * rip) * (0.85 + 0.25 * vnoise(vWorld.xz * 0.45));
        vec3 L = sunAt(d);
        float c = causticAt(vWorld, d);
        vec3 lit = alb * (L * (0.22 + 0.78 * max(n.y, 0.0)) * (0.62 + 1.1 * c) + waterTint(d) * 0.3);
        gl_FragColor = vec4(finalize(throughWater(lit, length(vWorld - cameraPosition))), 1.0);
      }`,
  }));
  scene.add(new THREE.Mesh(floorGeo, floorMat));

  const R = rng(7);

  /* ---- light shafts from the surface ---- */
  const rayGeo = track(new THREE.PlaneGeometry(1, 1));
  rayGeo.translate(0, -0.5, 0);
  const rays: THREE.Object3D[] = [];
  for (let i = 0; i < TIERS.high.rays; i++) {
    const m = track(mat({
      uniforms: { uSeed: { value: R() } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; varying float vDist;
        void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vDist = length(wp.xyz - cameraPosition);
          gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: WATER + `
        uniform float uSeed; varying vec2 vUv; varying float vDist;
        void main() {
          float x = vUv.x, y = vUv.y;
          float edge = smoothstep(0.0, 0.5, x) * smoothstep(1.0, 0.5, x);
          float shimmer = 0.5 + 0.5 * sin(uTime * 0.55 + uSeed * 17.0) * sin(uTime * 0.31 + uSeed * 29.0 + x * 2.0);
          float streak = 0.65 + 0.35 * sin(x * 14.0 + uSeed * 40.0 + uTime * 0.25);
          float fall = pow(y, 1.8);
          float nearFade = smoothstep(1.5, 5.0, vDist);
          float shallow = exp(-uDepth / 30.0);
          vec3 c = sunAt(uDepth) * edge * edge * shimmer * streak * fall * nearFade * shallow * exp(-vDist * 0.035) * 0.08;
          gl_FragColor = vec4(1.0 - exp(-c * uExposure), 1.0);
        }`,
    }));
    const mesh = new THREE.Mesh(rayGeo, m);
    mesh.scale.set(1.2 + R() * 3.2, 24 + R() * 10, 1);
    mesh.rotation.z = 0.2;
    const holder = new THREE.Object3D();
    holder.position.set((R() - 0.5) * 30, 7, -3 - R() * 34);
    holder.add(mesh);
    scene.add(holder);
    rays.push(holder);
  }

  /* ---- drifting particles (plankton, sand and marine snow catching the light) ---- */
  const BOX = new THREE.Vector3(30, 16, 40);
  const pGeo = track(new THREE.BufferGeometry());
  {
    const n = TIERS.high.particles;
    const pos = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (R() - 0.5) * BOX.x; pos[i * 3 + 1] = (R() - 0.5) * BOX.y; pos[i * 3 + 2] = (R() - 0.5) * BOX.z;
      size[i] = 0.5 + Math.pow(R(), 3) * 2.4; seed[i] = R();
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    pGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  }
  const pMat = track(mat({
    uniforms: { uBox: { value: BOX }, uPR: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime; uniform vec3 uBox; uniform float uPR;
      attribute float aSize; attribute float aSeed;
      varying float vDist; varying float vSeed;
      void main() {
        vSeed = aSeed;
        vec3 p = position;
        p.x += sin(uTime * 0.15 + aSeed * 30.0) * 0.6;
        p.z += cos(uTime * 0.12 + aSeed * 17.0) * 0.6;
        p.y += -uTime * 0.05 * (0.4 + aSeed);
        vec3 c = cameraPosition + vec3(0.0, -2.0, -14.0);
        p = mod(p - c + uBox * 0.5, uBox) - uBox * 0.5 + c;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vDist = -mv.z;
        gl_PointSize = aSize * uPR * (110.0 / max(vDist, 0.5));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: WATER + `
      varying float vDist; varying float vSeed;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard;
        float fall = exp(-r * 3.0) * exp(-vDist * 0.05);
        vec3 lit = (sunAt(uDepth) * 0.45 + waterTint(uDepth) * 0.35) * fall * 0.3;
        // marine snow: pale flecks that stay faintly visible after the sunlight has gone
        lit += vec3(0.5, 0.58, 0.68) * uSnow * fall * 0.05;
        // bioluminescence: one fleck in seven flashes now and then
        float blink = step(vSeed, 0.14) * pow(max(sin(uTime * 0.9 + vSeed * 400.0), 0.0), 14.0);
        lit += vec3(0.25, 0.85, 1.0) * uGlow * blink * exp(-r * 2.0) * exp(-vDist * 0.03) * 0.9;
        gl_FragColor = vec4(1.0 - exp(-lit * uExposure), 1.0);
      }`,
  }));
  const particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  scene.add(particles);

  /* ---- fish school (boids) ---- */
  const fishBody = track(new THREE.SphereGeometry(1, 12, 8));
  fishBody.scale(0.045, 0.085, 0.26);
  const fishGeo = track(new THREE.BufferGeometry());
  {
    const bp = fishBody.attributes.position.array, bn = fishBody.attributes.normal.array;
    const tailP = [0, 0, -0.2, 0, 0.1, -0.36, 0, -0.1, -0.36], tailN = [1, 0, 0, 1, 0, 0, 1, 0, 0];
    const pos = new Float32Array(bp.length + 9), nor = new Float32Array(bn.length + 9);
    pos.set(bp); pos.set(tailP, bp.length); nor.set(bn); nor.set(tailN, bn.length);
    const base = bp.length / 3;
    const idx = Array.from(fishBody.index!.array);
    idx.push(base, base + 1, base + 2);
    fishGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    fishGeo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    fishGeo.setIndex(idx);
  }
  const fishMat = track(mat({
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      attribute float aPhase;
      varying vec3 vWorld; varying vec3 vN; varying float vSide; varying vec3 vLocal;
      void main() {
        vec3 p = position;
        float tail = smoothstep(0.05, -0.3, p.z);
        p.x += sin(uTime * 9.0 + aPhase * 6.2831 - p.z * 9.0) * 0.05 * tail;
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vWorld = wp.xyz; vSide = normal.y; vLocal = position;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: WATER + `
      varying vec3 vWorld; varying vec3 vN; varying float vSide; varying vec3 vLocal;
      void main() {
        float d = uDepth - vWorld.y;
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        // dark back, silver belly: how open-water fish hide from above and below
        vec3 alb = mix(vec3(0.85, 0.88, 0.9), vec3(0.1, 0.2, 0.3), smoothstep(-0.15, 0.55, vSide));
        // lanternfish in the deep: a dark body
        alb = mix(alb, vec3(0.03, 0.04, 0.06), uLantern);
        vec3 L = sunAt(d);
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 H = normalize(V + vec3(0.0, 1.0, 0.0));
        float spec = pow(max(dot(n, H), 0.0), 36.0) * 1.8 * (1.0 - uLantern);
        vec3 lit = alb * (L * max(n.y * 0.7 + 0.3, 0.0) * 0.9 + waterTint(d) * 0.4) + L * spec;
        float dist = length(vWorld - cameraPosition);
        vec3 col = finalize(throughWater(lit, dist));
        // ...with rows of photophores along the belly that glow blue
        float row = 1.0 - smoothstep(0.012, 0.024, abs(vLocal.y + 0.045));
        float dots = smoothstep(0.32, 0.12, abs(fract(vLocal.z * 26.0) - 0.5));
        col += vec3(0.25, 0.7, 1.0) * row * dots * uLantern * exp(-dist * 0.04) * 1.3;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  const MAX_FISH = TIERS.high.fish;
  const fish = new THREE.InstancedMesh(fishGeo, fishMat, MAX_FISH);
  fish.frustumCulled = false;
  {
    const ph = new Float32Array(MAX_FISH);
    for (let i = 0; i < MAX_FISH; i++) ph[i] = R();
    fish.geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(ph, 1));
  }
  scene.add(fish);
  const SCHOOL_C = new THREE.Vector3(-1, -0.8, -10);
  const fPos = new Float32Array(MAX_FISH * 3), fVel = new Float32Array(MAX_FISH * 3), fScale = new Float32Array(MAX_FISH);
  for (let i = 0; i < MAX_FISH; i++) {
    fPos[i * 3] = SCHOOL_C.x + (R() - 0.5) * 4; fPos[i * 3 + 1] = SCHOOL_C.y + (R() - 0.5) * 1.5; fPos[i * 3 + 2] = SCHOOL_C.z + (R() - 0.5) * 4;
    fVel[i * 3] = 1.2; fVel[i * 3 + 1] = 0; fVel[i * 3 + 2] = (R() - 0.5) * 0.4;
    fScale[i] = 0.6 + R() * 0.35;
  }

  /* ---- manta ray (model from Blender; wings flap here) ---- */
  const manta = new THREE.Group();
  scene.add(manta);
  const mantaPos = new THREE.Vector3(0, -50, 0);
  const mantaMat = track(mat({
    uniforms: { uHalfSpan: { value: HALF_SPAN } },
    vertexShader: `
      uniform float uTime; uniform float uHalfSpan;
      attribute vec3 aCol;
      varying vec3 vWorld; varying vec3 vN; varying vec3 vColor;
      void main() {
        vec3 p = position;
        float s = clamp(abs(p.x) / uHalfSpan, 0.0, 1.0);
        float ph = uTime * 1.75 - s * 1.9;
        float A = 0.62;
        float f = A * pow(s, 1.7) * sin(ph);
        float dfds = A * (1.7 * pow(max(s, 0.001), 0.7) * sin(ph) - 1.9 * pow(s, 1.7) * cos(ph));
        p.y += f;
        float tail = smoothstep(-0.7, -1.7, p.z);
        p.x += sin(uTime * 2.2 + p.z * 2.5) * 0.06 * tail;
        vec3 n = normal;
        n.x -= sign(p.x) * dfds / uHalfSpan * n.y;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz; vColor = aCol;
        vN = normalize(mat3(modelMatrix) * n);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: WATER + `
      varying vec3 vWorld; varying vec3 vN; varying vec3 vColor;
      void main() {
        float d = uDepth - vWorld.y;
        vec3 n = normalize(vN);
        vec3 L = sunAt(d);
        float c = causticAt(vWorld, d) * smoothstep(0.2, 0.8, n.y);
        vec3 lit = vColor * (L * (0.25 + 0.75 * max(n.y, 0.0)) * (0.7 + 1.2 * c) + waterTint(d) * 0.4);
        gl_FragColor = vec4(finalize(throughWater(lit, length(vWorld - cameraPosition))), 1.0);
      }`,
  }));
  const mantaLods: (THREE.Mesh | undefined)[] = [];

  /* ---- sea turtle (model from Blender; the flippers fly here) ---- */
  // 前あしは甲羅の幅（|x| 0.4）より外。肩（x=±0.38）を軸に、羽ばたくように上下させる（先ほど少し遅れる）。
  // 後ろあしは小さく、かじを取るように動かす
  const turtle = new THREE.Group();
  scene.add(turtle);
  const turtleMat = track(mat({
    vertexShader: `
      uniform float uTime;
      attribute vec3 aCol;
      varying vec3 vWorld; varying vec3 vN; varying vec3 vColor;
      vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(v.x * c - v.y * s, v.x * s + v.y * c); }
      void main() {
        vec3 p = position; vec3 n = normal;
        float ax = abs(p.x), sx = p.x < 0.0 ? -1.0 : 1.0;
        float front = smoothstep(0.36, 0.48, ax) * step(-0.12, p.z);
        float rear = smoothstep(0.17, 0.28, ax) * smoothstep(-0.3, -0.42, p.z) * (1.0 - front);
        float ph = uTime * 1.25;
        float a = front * 0.6 * sin(ph - max(ax - 0.38, 0.0) * 1.4) + rear * 0.3 * sin(ph + 1.7);
        float pivot = front > 0.0 ? 0.38 : 0.18;
        vec2 q = rot(vec2(ax - pivot, p.y), a);
        p.x = sx * (pivot + q.x); p.y = q.y;
        vec2 nq = rot(vec2(n.x * sx, n.y), a);
        n.x = nq.x * sx; n.y = nq.y;
        // the head nods a little with each stroke
        p.y += smoothstep(0.42, 0.6, p.z) * sin(ph + 0.6) * 0.012;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz; vColor = aCol;
        vN = normalize(mat3(modelMatrix) * n);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: CREATURE_FRAG,
  }));
  const turtleLods: (THREE.Mesh | undefined)[] = [];

  /* ---- humphead wrasse (model from Blender; the body sways here) ---- */
  // 体の後ろほど大きく左右にくねらせ、胸びれ（体の横・前寄り）で漕ぐ
  const wrasse = new THREE.Group();
  scene.add(wrasse);
  const wrasseMat = track(mat({
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      attribute vec3 aCol;
      varying vec3 vWorld; varying vec3 vN; varying vec3 vColor;
      void main() {
        vec3 p = position;
        float k = smoothstep(0.25, -0.98, p.z);
        p.x += sin(uTime * 1.9 - p.z * 3.2) * 0.075 * k * k + sin(uTime * 1.9 + 1.4) * 0.01;
        float pect = smoothstep(0.13, 0.2, abs(p.x)) * smoothstep(0.02, 0.12, p.z) * smoothstep(0.42, 0.3, p.z);
        p.z -= pect * (0.5 + 0.5 * sin(uTime * 3.0)) * 0.05;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz; vColor = aCol;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: CREATURE_FRAG,
  }));
  const wrasseLods: (THREE.Mesh | undefined)[] = [];

  /* ---- whale shark (model from Blender; the tail sweeps slowly here) ---- */
  const whaleshark = new THREE.Group();
  scene.add(whaleshark);
  const whalesharkMat = track(mat({
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      attribute vec3 aCol;
      varying vec3 vWorld; varying vec3 vN; varying vec3 vColor;
      void main() {
        vec3 p = position;
        float k = smoothstep(0.6, -2.7, p.z);
        p.x += sin(uTime * 0.9 - p.z * 1.1) * 0.24 * k * k + sin(uTime * 0.9 + 1.0) * 0.03;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz; vColor = aCol;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: CREATURE_FRAG,
  }));
  const whalesharkLods: (THREE.Mesh | undefined)[] = [];

  /* ---- deep-sea anglerfish (model from Blender; the lure glows and lights its own face) ---- */
  // 提灯の位置は scripts/blender/make_ocean_assets.py の ANGLER_LURE_AT（Blender の (x, y, z) → glTF の (x, z, -y)）
  const ANGLER_LURE = new THREE.Vector3(0, 0.58, 0.62);
  const LURE_COLOR = new THREE.Vector3(0.45, 0.9, 1.0);
  const angler = new THREE.Group();
  scene.add(angler);
  const anglerMat = track(mat({
    uniforms: { uLure: { value: ANGLER_LURE }, uLureColor: { value: LURE_COLOR } },
    vertexShader: `
      uniform float uTime; uniform vec3 uLure;
      attribute vec3 aCol;
      varying vec3 vWorld; varying vec3 vN; varying vec3 vColor; varying vec3 vToLure; varying float vLureD;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 1.1 - p.z * 4.0) * 0.03 * smoothstep(0.0, -0.5, p.z);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vec3 lure = (modelMatrix * vec4(uLure, 1.0)).xyz;
        vWorld = wp.xyz; vColor = aCol;
        vToLure = lure - wp.xyz; vLureD = length(position - uLure);
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: WATER + `
      uniform vec3 uLureColor;
      varying vec3 vWorld; varying vec3 vN; varying vec3 vColor; varying vec3 vToLure; varying float vLureD;
      void main() {
        float d = uDepth - vWorld.y;
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        float pulse = 0.75 + 0.25 * sin(uTime * 1.3);
        float r = length(vToLure);
        // the lure is the only light down here: it lights the face and the teeth in front of it
        vec3 byLure = uLureColor * pulse * 3.5 * max(dot(n, vToLure / max(r, 1e-3)), 0.0) / (1.0 + r * r * 6.0);
        vec3 lit = vColor * (sunAt(d) * (0.25 + 0.75 * max(n.y, 0.0)) + waterTint(d) * 0.4 + byLure);
        float dist = length(vWorld - cameraPosition);
        vec3 col = finalize(throughWater(lit, dist));
        // the lure itself (a sphere of radius 0.05 around uLure) shines
        col += uLureColor * pulse * (1.0 - smoothstep(0.06, 0.09, vLureD)) * 1.4;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  const anglerLods: (THREE.Mesh | undefined)[] = [];
  // 提灯のまわりの光のにじみ（1点を大きく描く。加算なので暗い海でだけ目立つ）
  const haloGeo = track(new THREE.BufferGeometry());
  haloGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([ANGLER_LURE.x, ANGLER_LURE.y, ANGLER_LURE.z]), 3));
  const haloMat = track(mat({
    uniforms: { uPR: { value: 1 }, uLureColor: { value: LURE_COLOR } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uPR;
      varying float vDist;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = -mv.z;
        gl_PointSize = uPR * 520.0 / max(vDist, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: WATER + `
      uniform vec3 uLureColor;
      varying float vDist;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard;
        float pulse = 0.75 + 0.25 * sin(uTime * 1.3);
        vec3 c = uLureColor * pulse * (exp(-r2 * 5.0) * 0.6 + exp(-r2 * 40.0) * 1.2) * exp(-vDist * 0.02);
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  const halo = new THREE.Points(haloGeo, haloMat);
  halo.frustumCulled = false;
  halo.renderOrder = 3;
  angler.add(halo);

  /* ---- reef fish (made here: small, flat, bright fish that stay around a coral head) ---- */
  // チョウチョウウオ（黄色・目を通る黒い帯）とデバスズメダイ（淡い青緑）。群れで泳ぎ回らず、
  // それぞれ自分のサンゴのまわりをゆっくり回る（住むサンゴは3Dモデルを読んでから決め直す）
  const reefFishBody = track(new THREE.SphereGeometry(1, 12, 8));
  reefFishBody.scale(0.018, 0.06, 0.07);
  const reefFishGeo = track(new THREE.BufferGeometry());
  {
    const bp = reefFishBody.attributes.position.array, bn = reefFishBody.attributes.normal.array;
    const tailP = [0, 0, -0.06, 0, 0.04, -0.11, 0, -0.04, -0.11], tailN = [1, 0, 0, 1, 0, 0, 1, 0, 0];
    const pos = new Float32Array(bp.length + 9), nor = new Float32Array(bn.length + 9);
    pos.set(bp); pos.set(tailP, bp.length); nor.set(bn); nor.set(tailN, bn.length);
    const base = bp.length / 3;
    const idx = Array.from(reefFishBody.index!.array);
    idx.push(base, base + 1, base + 2);
    reefFishGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    reefFishGeo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    reefFishGeo.setIndex(idx);
  }
  const reefFishMat = track(mat({
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      attribute float aPhase; attribute float aKind;
      varying vec3 vWorld; varying vec3 vN; varying vec3 vLocal; varying float vKind;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 11.0 + aPhase * 6.2831 - p.z * 30.0) * 0.012 * smoothstep(0.0, -0.1, p.z);
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vWorld = wp.xyz; vLocal = position; vKind = aKind;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: WATER + `
      varying vec3 vWorld; varying vec3 vN; varying vec3 vLocal; varying float vKind;
      void main() {
        float d = uDepth - vWorld.y;
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        vec3 alb;
        if (vKind < 0.5) {
          // butterflyfish: yellow, a black band through the eye, a pale face, a dark spot near the tail
          alb = vec3(0.85, 0.62, 0.03);
          alb = mix(alb, vec3(0.85, 0.85, 0.8), smoothstep(0.045, 0.055, vLocal.z));
          alb = mix(alb, vec3(0.02), (1.0 - smoothstep(0.006, 0.012, abs(vLocal.z - 0.04))) * step(-0.045, vLocal.y));
          alb = mix(alb, vec3(0.03), (1.0 - smoothstep(0.012, 0.018, length(vLocal.zy - vec2(-0.035, 0.02)))));
        } else {
          // blue-green chromis: pale aqua, a little darker along the back
          alb = mix(vec3(0.2, 0.62, 0.7), vec3(0.08, 0.35, 0.45), smoothstep(0.0, 0.05, vLocal.y));
        }
        vec3 L = sunAt(d);
        vec3 V = normalize(cameraPosition - vWorld);
        float spec = pow(max(dot(n, normalize(V + vec3(0.0, 1.0, 0.0))), 0.0), 30.0) * 0.6;
        float c = causticAt(vWorld, d) * smoothstep(0.1, 0.8, n.y);
        vec3 lit = alb * (L * (0.35 + 0.65 * max(n.y * 0.6 + 0.4, 0.0)) * (0.7 + c) + waterTint(d) * 0.35) + L * spec;
        gl_FragColor = vec4(finalize(throughWater(lit, length(vWorld - cameraPosition))), 1.0);
      }`,
  }));
  const MAX_REEF_FISH = TIERS.high.reefFish;
  const reefFish = new THREE.InstancedMesh(reefFishGeo, reefFishMat, MAX_REEF_FISH);
  reefFish.frustumCulled = false;
  reefFish.count = 0;
  // 住むサンゴの位置（3Dモデルを読むまでは、手前の海底のあちこち）
  const reefHomes: THREE.Vector3[] = Array.from({ length: 6 }, (_, i) => {
    const x = (i - 2.5) * 2.6, z = -5 - (i % 3) * 2.5;
    return new THREE.Vector3(x, seabedY(x, z), z);
  });
  const rfSeed = new Float32Array(MAX_REEF_FISH * 4), rfScale = new Float32Array(MAX_REEF_FISH);
  {
    const ph = new Float32Array(MAX_REEF_FISH), kind = new Float32Array(MAX_REEF_FISH);
    for (let i = 0; i < MAX_REEF_FISH; i++) {
      ph[i] = R();
      kind[i] = i % 3 === 0 ? 0 : 1;               // チョウチョウウオ1：デバスズメダイ2
      // 実物（10〜15cm）より大きめにする。礁は数m先なので、実物の大きさでは点にしか見えない
      rfScale[i] = kind[i] === 0 ? 1.6 + R() * 0.4 : 1.1 + R() * 0.3;
      for (let k = 0; k < 4; k++) rfSeed[i * 4 + k] = R();
    }
    reefFish.geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(ph, 1));
    reefFish.geometry.setAttribute("aKind", new THREE.InstancedBufferAttribute(kind, 1));
  }
  scene.add(reefFish);

  /* ---- jellyfish (made here: a pulsing bell, tentacles and oral arms; glow in the deep) ---- */
  const MAX_JELLY = TIERS.high.jelly;
  const jellyGeo = track(jellyGeometry());
  const jellyMat = track(mat({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      attribute float aPart; attribute float aT; attribute vec3 aTint;
      varying vec3 vWorld; varying vec3 vN; varying float vPart; varying float vT; varying vec3 vTint; varying float vPulse;
      void main() {
        vec3 p = position;
        float ph = uTime * 1.5 + instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 0.9;
        float relax = 0.5 + 0.5 * sin(ph);
        float squeeze = 1.0 - 0.2 * (1.0 - relax);
        if (aPart < 0.5) {
          // the bell contracts most at the rim and lengthens a little while it does
          float h = clamp(p.y / 0.3, 0.0, 1.0);
          p.xz *= mix(squeeze, 1.0, h * 0.6);
          p.y *= 1.0 + 0.1 * (1.0 - relax);
        } else {
          // roots follow the rim; a wave runs down each tentacle a little after the bell
          p.xz *= mix(squeeze, 1.0, aT);
          p.x += sin(ph - aT * 4.0 + position.z * 9.0) * 0.07 * aT + sin(uTime * 0.6 + aT * 3.0) * 0.1 * aT * aT;
          p.z += cos(ph * 0.8 - aT * 3.5 + position.x * 7.0) * 0.07 * aT;
        }
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vWorld = wp.xyz; vPart = aPart; vT = aT; vTint = aTint; vPulse = relax;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: WATER + `
      varying vec3 vWorld; varying vec3 vN; varying float vPart; varying float vT; varying vec3 vTint; varying float vPulse;
      void main() {
        float d = uDepth - vWorld.y;
        vec3 n = normalize(vN);
        vec3 V = normalize(cameraPosition - vWorld);
        float rim = 1.0 - abs(dot(n, V));
        vec3 L = sunAt(d) + waterTint(d) * 0.6;
        float dist = length(vWorld - cameraPosition);
        // a clear bell shows mostly at its edges; tentacles thin out toward the tips
        float shape = vPart < 0.5 ? 0.06 + 0.6 * pow(rim, 2.0) : (vPart < 1.5 ? 0.3 : 0.45) * (1.0 - vT * 0.7);
        vec3 c = vec3(0.75, 0.85, 1.0) * L * shape * 0.5;
        // bioluminescence: a ring along the bell and beads down the tentacles, brightest when the bell opens
        float glow = vPart < 0.5 ? (0.12 + 0.88 * pow(rim, 1.5)) * 0.55 : (1.0 - vT) * 0.45;
        c += vTint * uGlow * glow * (0.35 + 0.65 * vPulse);
        c *= exp(-(uKd * 0.6 + vec3(0.045)) * uFog * dist) * (1.0 - smoothstep(30.0, 60.0, dist));
        gl_FragColor = vec4(1.0 - exp(-c * uExposure), 1.0);
      }`,
  }));
  const jelly = new THREE.InstancedMesh(jellyGeo, jellyMat, MAX_JELLY);
  jelly.frustumCulled = false;
  jelly.renderOrder = 2;
  jelly.count = 0;
  const JELLY_GLOWS: [number, number, number][] = [[0.3, 0.9, 1.0], [0.55, 0.5, 1.0], [0.35, 1.0, 0.7]];
  const jPos = new Float32Array(MAX_JELLY * 3), jSeed = new Float32Array(MAX_JELLY), jSize = new Float32Array(MAX_JELLY);
  {
    const tint = new Float32Array(MAX_JELLY * 3);
    for (let i = 0; i < MAX_JELLY; i++) {
      jSeed[i] = R();
      jSize[i] = 0.55 + R() * 0.6;
      jPos[i * 3] = (R() - 0.5) * 16; jPos[i * 3 + 1] = JELLY_BOTTOM + R() * (JELLY_TOP - JELLY_BOTTOM); jPos[i * 3 + 2] = -5 - R() * 13;
      tint.set(JELLY_GLOWS[i % JELLY_GLOWS.length], i * 3);
    }
    jelly.geometry.setAttribute("aTint", new THREE.InstancedBufferAttribute(tint, 3));
  }
  scene.add(jelly);

  /* ---- reef from the Blender file ---- */
  const reefMat = track(mat({ vertexShader: REEF_VERT, fragmentShader: OBJ_FRAG }));
  const fanMat = track(mat({ vertexShader: REEF_VERT, fragmentShader: OBJ_FRAG, defines: { FAN_SWAY: "" }, side: THREE.DoubleSide }));
  const grassMat = track(mat({ vertexShader: REEF_VERT, fragmentShader: OBJ_FRAG, defines: { GRASS_SWAY: "" }, side: THREE.DoubleSide }));
  /**
   * mats は置いた位置そのもの。水深で数を減らすときは、境目の1つ（partial）だけを小さくして、
   * 潜っているあいだにサンゴが1本ずつ「ぱっと消える」のではなく、海底へ縮んで消えるようにする
   */
  const reef: { plan: ReefPlan; lods: (THREE.InstancedMesh | null)[]; mats: THREE.Matrix4[]; partial: number }[] = [];
  let modelsLoaded = false;

  function buildFromGltf(root: THREE.Object3D) {
    const byName: Record<string, THREE.Mesh> = {};
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh) byName[o.name] = o as THREE.Mesh; });
    const RR = rng(99);
    const dummy = new THREE.Object3D();
    for (const plan of REEF_PLAN) {
      const tint = new Float32Array(plan.count * 3);
      const mats: THREE.Matrix4[] = [];
      // seagrass grows in meadows: scatter clumps around a few centres
      const meadows = plan.meadow ? Array.from({ length: 7 }, () => [(RR() - 0.5) * 18, -1 - RR() * 15]) : null;
      for (let i = 0; i < plan.count; i++) {
        let x = (RR() - 0.5) * 24, z = -2 - RR() * 24;
        if (meadows) {
          const [mx, mz] = meadows[i % meadows.length];
          const r = Math.sqrt(RR()) * 2.6, a = RR() * Math.PI * 2;
          x = mx + Math.cos(a) * r; z = mz + Math.sin(a) * r;
        }
        const sc = plan.size[0] + RR() * (plan.size[1] - plan.size[0]);
        dummy.position.set(x, seabedY(x, z) - plan.sink * sc, z);
        dummy.rotation.set(0, RR() * Math.PI * 2, 0);
        dummy.scale.set(sc, sc * (plan.squash[0] + RR() * (plan.squash[1] - plan.squash[0])), sc);
        dummy.updateMatrix();
        mats.push(dummy.matrix.clone());
        tint.set(plan.tints[Math.floor(RR() * plan.tints.length)], i * 3);
      }
      const tintAttr = new THREE.InstancedBufferAttribute(tint, 3);
      const material = plan.name === "fan" ? fanMat : plan.name === "seagrass" ? grassMat : reefMat;
      const lods = [0, 1, 2].map((lod) => {
        const src = byName[`${plan.name}_${lod}`];
        if (!src) return null;
        const g = track(plainGeometry(src));
        g.setAttribute("aTint", tintAttr);
        const m = new THREE.InstancedMesh(g, material, plan.count);
        mats.forEach((mm, i) => m.setMatrixAt(i, mm));
        m.instanceMatrix.needsUpdate = true;
        m.frustumCulled = false;
        m.visible = false;
        scene.add(m);
        return m;
      });
      reef.push({ plan, lods, mats, partial: -1 });
    }
    const creature = (name: string, material: THREE.Material, group: THREE.Group, lods: (THREE.Mesh | undefined)[]) => {
      for (let lod = 0; lod < 3; lod++) {
        const src = byName[`${name}_${lod}`];
        if (!src) continue;
        const m = new THREE.Mesh(track(plainGeometry(src)), material);
        m.frustumCulled = false;
        m.visible = false;
        group.add(m);
        lods[lod] = m;
      }
    };
    creature("manta", mantaMat, manta, mantaLods);
    creature("turtle", turtleMat, turtle, turtleLods);
    creature("wrasse", wrasseMat, wrasse, wrasseLods);
    creature("whaleshark", whalesharkMat, whaleshark, whalesharkLods);
    creature("angler", anglerMat, angler, anglerLods);
    // 熱帯魚が住むサンゴ：枝サンゴとノウサンゴの、どの画質でもサンゴ礁で見えている先頭の数本のうち、手前のもの
    const homes: THREE.Vector3[] = [];
    for (const r of reef) {
      if (r.plan.kind !== "staghorn" && r.plan.kind !== "brain") continue;
      const near = r.mats.slice(0, 4).map(m => new THREE.Vector3().setFromMatrixPosition(m))
        .sort((a, b) => b.z - a.z).filter(v => v.z > -12 && Math.abs(v.x) < 9);
      homes.push(...near.slice(0, 3));
    }
    if (homes.length) reefHomes.splice(0, reefHomes.length, ...homes);
    modelsLoaded = true;
  }

  /* ---- state ---- */
  let tier: OceanTier = "mid";
  let frozen = false;
  let lost = false;
  let lostTimer = 0;
  let active = true;
  let motion = opts.motion;
  let disposed = false;
  let time = 0;
  let last = performance.now();
  let lastDraw = 0;
  let raf = 0;
  const sample = { start: 0, frames: 0, intervals: [] as number[], lastT: 0, probing: false, throttled: false, triedHigh: false, fps: 0 };
  const cap = () => (sample.probing ? 60 : TIERS[tier].cap);

  // 水深。潜っている途中は depthNow が depthFrom から depthTo へ動く（depthT が 0→1）
  let depthNow = startDepth, depthFrom = startDepth, depthTo = startDepth, depthT = 1;

  function applyTier(name: OceanTier) {
    tier = name;
    const q = TIERS[name];
    renderer.setPixelRatio(q.pixelRatio);
    resize();
    pMat.uniforms.uPR.value = q.pixelRatio;
    pGeo.setDrawRange(0, q.particles);
    for (const lods of [mantaLods, turtleLods, wrasseLods, whalesharkLods, anglerLods]) lods.forEach((m, lod) => { if (m) m.visible = lod === q.lod; });
    haloMat.uniforms.uPR.value = q.pixelRatio;
    applyHabitat();
    sample.start = 0;
  }

  const shrunk = new THREE.Matrix4(), shrink = new THREE.Matrix4();
  /** 画質（数の上限）と水深（そこに住む割合）から、並べる数と見せるものを決める */
  function applyHabitat() {
    const q = TIERS[tier];
    const d = depthNow;
    for (const r of reef) {
      const exact = r.plan.count * q.reef * abundance(r.plan.kind, d);
      const n = Math.min(r.plan.count, Math.ceil(exact - 1e-3));
      const frac = exact - Math.floor(exact);
      const partial = frac > 1e-3 && n > 0 ? n - 1 : -1;
      r.lods.forEach((m, lod) => {
        if (!m) return;
        m.visible = lod === q.lod && n > 0;
        m.count = n;
        if (r.partial >= 0 && r.partial !== partial) { m.setMatrixAt(r.partial, r.mats[r.partial]); m.instanceMatrix.needsUpdate = true; }
        if (partial >= 0) {
          // 境目の1つは海底から縮める（位置はそのまま、大きさだけ）
          m.setMatrixAt(partial, shrunk.copy(r.mats[partial]).multiply(shrink.makeScale(frac, frac, frac)));
          m.instanceMatrix.needsUpdate = true;
        }
      });
      r.partial = partial;
    }
    fish.count = Math.round(q.fish * abundance("fish", d));
    jelly.count = Math.min(MAX_JELLY, Math.ceil(q.jelly * abundance("jelly", d) - 1e-3));
    // 1匹で泳ぐものは、そこに住む量が半分を超える深さでだけ出す
    manta.visible = abundance("manta", d) >= 0.5;
    turtle.visible = abundance("turtle", d) >= 0.5;
    wrasse.visible = abundance("wrasse", d) >= 0.5;
    whaleshark.visible = abundance("whaleshark", d) >= 0.5;
    // 提灯は3Dモデルを読んでから（体が無いのに光だけ浮かないように）
    angler.visible = abundance("angler", d) >= 0.5 && anglerLods.length > 0;
    reefFish.count = Math.min(MAX_REEF_FISH, Math.round(q.reefFish * abundance("reeffish", d)));
    // 光の筋と水底の光の網目は、届かなくなった深さでは描かない（見えないのに重さだけ残る）
    rays.forEach((ray, i) => { ray.visible = i < q.rays && d < 150; });
    U.uCaustic.value = d < 60 ? q.caustic : 0;
  }

  function setDepthNow(d: number) {
    depthNow = d;
    U.uDepth.value = d;
    U.uExposure.value = exposureFor(d);
    U.uGlow.value = abundance("glow", d);
    U.uSnow.value = abundance("snow", d);
    U.uLantern.value = abundance("lantern", d);
    applyHabitat();
  }
  function finishDescent() {
    if (depthT >= 1) return;
    depthT = 1;
    setDepthNow(depthTo);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 68 : 55;
    camera.updateProjectionMatrix();
    spread = swimSpread(camera.aspect);
  }

  /* ---- per-frame ---- */
  const up = new THREE.Vector3(0, 1, 0);
  const vx = new THREE.Vector3(), vy = new THREE.Vector3(), vz = new THREE.Vector3(), m4 = new THREE.Matrix4(), sv = new THREE.Vector3();
  // 横長の画面では泳ぐ範囲を左右に広げ、カードの列の外（余白）にも出す（spread）
  function updateFish(dt: number, t: number) {
    const n = fish.count;
    const tx = SCHOOL_C.x + Math.sin(t * 0.13) * SCHOOL_SWAY * spread;
    const ty = SCHOOL_C.y + Math.sin(t * 0.21) * 1.4;
    const tz = SCHOOL_C.z + Math.cos(t * 0.11) * 5;
    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      let cx = 0, cy = 0, cz = 0, ax = 0, ay = 0, az = 0, sx = 0, sy = 0, sz = 0, cnt = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const jx = j * 3;
        const dx = fPos[jx] - fPos[ix], dy = fPos[jx + 1] - fPos[ix + 1], dz = fPos[jx + 2] - fPos[ix + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1.6) {
          cnt++; cx += dx; cy += dy; cz += dz;
          ax += fVel[jx]; ay += fVel[jx + 1]; az += fVel[jx + 2];
          if (d2 < 0.12) { const k = 1 / (d2 + 0.01); sx -= dx * k; sy -= dy * k; sz -= dz * k; }
        }
      }
      let fx = 0, fy = 0, fz = 0;
      if (cnt) {
        fx += (cx / cnt) * 0.6 + (ax / cnt - fVel[ix]) * 1.0 + sx * 0.04;
        fy += (cy / cnt) * 0.6 + (ay / cnt - fVel[ix + 1]) * 1.0 + sy * 0.04;
        fz += (cz / cnt) * 0.6 + (az / cnt - fVel[ix + 2]) * 1.0 + sz * 0.04;
      }
      fx += (tx - fPos[ix]) * 0.12; fy += (ty - fPos[ix + 1]) * 0.12; fz += (tz - fPos[ix + 2]) * 0.12;
      // scatter away from the manta (when there is one at this depth)
      const mx = fPos[ix] - mantaPos.x, my = fPos[ix + 1] - mantaPos.y, mz = fPos[ix + 2] - mantaPos.z;
      const md = mx * mx + my * my + mz * mz;
      if (md < 9 && manta.visible) { const k = ((9 - md) * 0.9) / (Math.sqrt(md) + 0.1); fx += mx * k; fy += my * k * 0.5; fz += mz * k; }
      const floorY = seabedY(fPos[ix], fPos[ix + 2]) + 1.0;
      if (fPos[ix + 1] < floorY) fy += (floorY - fPos[ix + 1]) * 3;
      let vxv = fVel[ix] + fx * dt, vyv = fVel[ix + 1] + fy * dt, vzv = fVel[ix + 2] + fz * dt;
      const sp = Math.hypot(vxv, vyv, vzv) || 1;
      const clamped = Math.min(Math.max(sp, 1.1), 2.4);
      vxv *= clamped / sp; vyv *= clamped / sp; vzv *= clamped / sp;
      vyv = Math.max(Math.min(vyv, 0.6), -0.6);
      fVel[ix] = vxv; fVel[ix + 1] = vyv; fVel[ix + 2] = vzv;
      fPos[ix] += vxv * dt; fPos[ix + 1] += vyv * dt; fPos[ix + 2] += vzv * dt;
      vz.set(vxv, vyv, vzv).normalize();
      vx.crossVectors(up, vz).normalize();
      vy.crossVectors(vz, vx);
      m4.makeBasis(vx, vy, vz);
      sv.setScalar(fScale[i] * (1 - 0.3 * U.uLantern.value));   // ハダカイワシはイワシより小さい
      m4.scale(sv);
      m4.setPosition(fPos[ix], fPos[ix + 1], fPos[ix + 2]);
      fish.setMatrixAt(i, m4);
    }
    fish.instanceMatrix.needsUpdate = true;
  }

  const qRoll = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
  function updateManta(t: number) {
    const th = t * ((2 * Math.PI) / 46) + 1.2;
    const rx = MANTA_RADIUS * spread;
    mantaPos.set(Math.cos(th) * rx, -0.9 + Math.sin(th * 2) * 0.6, -11 + Math.sin(th) * 4);
    manta.position.copy(mantaPos);
    vz.set(-Math.sin(th) * rx, Math.cos(th * 2) * 1.2, Math.cos(th) * 4).normalize();
    vx.crossVectors(up, vz).normalize();
    vy.crossVectors(vz, vx);
    m4.makeBasis(vx, vy, vz);
    manta.quaternion.setFromRotationMatrix(m4);
    qRoll.setFromAxisAngle(zAxis, -0.28 + Math.sin(t * 0.4) * 0.05);
    manta.quaternion.multiply(qRoll);
  }

  /** 向きを進む向き（前が +Z）に合わせる */
  function face(obj: THREE.Object3D, dx: number, dy: number, dz: number, roll: number) {
    vz.set(dx, dy, dz).normalize();
    vx.crossVectors(up, vz).normalize();
    vy.crossVectors(vz, vx);
    m4.makeBasis(vx, vy, vz);
    obj.quaternion.setFromRotationMatrix(m4);
    qRoll.setFromAxisAngle(zAxis, roll);
    obj.quaternion.multiply(qRoll);
  }

  // ウミガメはマンタより手前の低い所を、マンタと重ならない位置からゆっくり回る（1周64秒）
  function updateTurtle(t: number) {
    const th = t * ((2 * Math.PI) / 64) + 3.6;
    const rx = TURTLE_RADIUS * spread;
    turtle.position.set(Math.cos(th) * rx, -2.8 + Math.sin(th * 2) * 0.35, -7 + Math.sin(th) * 2.5);
    turtle.scale.setScalar(1.25);
    face(turtle, -Math.sin(th) * rx, Math.cos(th * 2) * 0.7, Math.cos(th) * 2.5, -0.12);
  }

  // ナポレオンフィッシュは横から見える向き（左右）に、礁の上をゆっくり行き来する（1周80秒）
  function updateWrasse(t: number) {
    const th = t * ((2 * Math.PI) / 80) + 0.4;
    const rx = WRASSE_RADIUS * spread;
    wrasse.position.set(Math.cos(th) * rx, -2.3 + Math.sin(th * 3) * 0.15, -9 + Math.sin(th) * 2);
    wrasse.scale.setScalar(1.3);
    face(wrasse, -Math.sin(th) * rx, Math.cos(th * 3) * 0.45, Math.cos(th) * 2, 0);
  }

  // ジンベエザメは体が大きいので遠くを、とてもゆっくり回る（1周110秒）
  function updateWhaleshark(t: number) {
    const th = t * ((2 * Math.PI) / 110) + 2.2;
    const rx = WHALESHARK_RADIUS * spread;
    whaleshark.position.set(Math.cos(th) * rx, -1.4 + Math.sin(th * 2) * 0.4, -14 + Math.sin(th) * 3);
    whaleshark.scale.setScalar(1.25);
    face(whaleshark, -Math.sin(th) * rx, Math.cos(th * 2) * 0.8, Math.cos(th) * 3, 0);
  }

  // チョウチンアンコウはほとんど泳がず、手前をゆっくり漂う（1周150秒）。見えるのは提灯と、その光が当たる顔
  function updateAngler(t: number) {
    const th = t * ((2 * Math.PI) / 150) + 1.0;
    const rx = ANGLER_RADIUS * spread;
    angler.position.set(Math.cos(th) * rx, -2.0 + Math.sin(th * 2) * 0.3 + Math.sin(t * 0.6) * 0.05, -7 + Math.sin(th) * 1.5);
    angler.scale.setScalar(1.1);
    face(angler, -Math.sin(th) * rx, Math.cos(th * 2) * 0.6, Math.cos(th) * 1.5, 0);
  }

  // 熱帯魚は群れで泳ぎ回らず、それぞれ住むサンゴのまわりを、高さと速さを少しずつ変えて回る
  function updateReefFish(t: number) {
    const n = reefFish.count;
    if (!n) return;
    for (let i = 0; i < n; i++) {
      const home = reefHomes[i % reefHomes.length];
      const s0 = rfSeed[i * 4], s1 = rfSeed[i * 4 + 1], s2 = rfSeed[i * 4 + 2], s3 = rfSeed[i * 4 + 3];
      const r = 0.4 + s1 * 0.7, w = (0.22 + s2 * 0.3) * (s3 > 0.5 ? 1 : -1);
      const a = t * w + s3 * 6.2831;
      const x = home.x + Math.cos(a) * r, z = home.z + Math.sin(a) * r * 0.8;
      const y = home.y + 0.35 + s0 * 0.85 + Math.sin(t * 0.7 + s0 * 9) * 0.08;
      vz.set(-Math.sin(a) * w, Math.cos(t * 0.7 + s0 * 9) * 0.05, Math.cos(a) * 0.8 * w).normalize();
      vx.crossVectors(up, vz).normalize();
      vy.crossVectors(vz, vx);
      m4.makeBasis(vx, vy, vz);
      m4.scale(sv.setScalar(rfScale[i]));
      m4.setPosition(x, y, z);
      reefFish.setMatrixAt(i, m4);
    }
    reefFish.instanceMatrix.needsUpdate = true;
  }

  const jQ = new THREE.Quaternion(), jE = new THREE.Euler();
  /** クラゲはゆっくり浮かんでいき、上の端で消えて、また下の端から現れる（どちらも大きさで溶かす） */
  function updateJelly(dt: number, t: number) {
    const n = jelly.count;
    if (!n) return;
    // 数を減らしている途中（潜る・浮かぶ途中）は、境目の1匹を小さくして溶かす
    const exact = TIERS[tier].jelly * abundance("jelly", depthNow);
    const lastScale = exact - Math.floor(exact) > 1e-3 ? exact - Math.floor(exact) : 1;
    for (let i = 0; i < n; i++) {
      const ix = i * 3, seed = jSeed[i];
      // rise in little pushes, in time with the bell
      const push = 0.5 + 0.5 * Math.sin(t * 1.5 + jPos[ix] * 1.7 + jPos[ix + 2] * 0.9);
      jPos[ix + 1] += dt * (0.05 + 0.1 * push) * (0.7 + seed * 0.6);
      jPos[ix] += dt * Math.sin(t * 0.1 + seed * 20) * 0.06;
      if (jPos[ix + 1] > JELLY_TOP) {
        jPos[ix + 1] = JELLY_BOTTOM;
        jPos[ix] = (R() - 0.5) * 16 * spread;
        jPos[ix + 2] = -5 - R() * 13;
      }
      const y = jPos[ix + 1];
      const fade = smooth(JELLY_BOTTOM, JELLY_BOTTOM + 1, y) * (1 - smooth(JELLY_TOP - 1, JELLY_TOP, y));
      const sc = jSize[i] * fade * (i === n - 1 ? lastScale : 1);
      jE.set(Math.cos(t * 0.27 + seed * 7) * 0.2, seed * 6, Math.sin(t * 0.3 + seed * 10) * 0.25);
      jQ.setFromEuler(jE);
      m4.compose(sv.set(jPos[ix], y, jPos[ix + 2]), jQ, vx.setScalar(Math.max(sc, 1e-4)));
      jelly.setMatrixAt(i, m4);
    }
    jelly.instanceMatrix.needsUpdate = true;
  }

  const invVP = new THREE.Matrix4();
  const look = new THREE.Vector3();
  function updateCamera(t: number) {
    camera.position.set(camBase.x + Math.sin(t * 0.21) * 0.25, camBase.y + Math.sin(t * 0.35) * 0.12, camBase.z);
    look.copy(lookBase);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    invVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
    bgMat.uniforms.uInvVP.value.copy(invVP);
    rays.forEach((r) => { r.rotation.y = Math.atan2(camera.position.x - r.position.x, camera.position.z - r.position.z); });
  }

  function draw() {
    updateCamera(time);
    renderer.render(scene, camera);
  }

  function autoTune(now: number) {
    if (!sample.start) { sample.start = now + 1500; sample.frames = 0; sample.intervals = []; sample.lastT = 0; return; }
    if (now < sample.start) return;
    if (sample.lastT) sample.intervals.push(now - sample.lastT);
    sample.lastT = now;
    sample.frames++;
    const elapsedMs = now - sample.start;
    if (elapsedMs < 2500) return;
    const v = judge({ intervals: sample.intervals, frames: sample.frames, elapsedMs }, {
      tier, cap: cap(), probing: sample.probing, coarsePointer: coarse, triedHigh: sample.triedHigh,
    });
    sample.fps = v.fps;
    sample.start = now; sample.frames = 0; sample.intervals = []; sample.lastT = 0;
    sample.throttled = v.kind === "throttled";
    const wasProbing = sample.probing;
    sample.probing = false;
    if (v.kind === "down") applyTier(v.to);
    if (v.kind === "freeze") { frozen = true; refresh(); }
    if (v.kind === "up") { if (v.to === "high") sample.triedHigh = true; applyTier(v.to); }
    if (wasProbing && v.kind === "keep") applyTier("low");
    opts.onStatus?.({ tier, fps: v.fps, throttled: sample.throttled, frozen, modelsLoaded });
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (now - lastDraw < 1000 / cap() - 2) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now; lastDraw = now;
    time += dt;
    U.uTime.value = time;
    if (depthT < 1) {
      depthT = Math.min(1, depthT + dt / DESCENT_SEC);
      setDepthNow(depthAlong(depthFrom, depthTo, depthT));
    }
    updateManta(time);
    updateTurtle(time);
    updateWrasse(time);
    updateWhaleshark(time);
    updateAngler(time);
    updateFish(dt, time);
    updateReefFish(time);
    updateJelly(dt, time);
    draw();
    autoTune(now);
  }

  function running() { return active && motion && !frozen && !lost && !document.hidden && !disposed; }
  function start() {
    if (raf || !running()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function refresh() {
    if (running()) start();
    else {
      stop();
      // 止めた1枚では潜る途中を見せられないので、着いた深さを描く。
      // 出題中・裏に回っただけなら待っておき、戻ってきたときに潜る
      if (!motion || frozen) finishDescent();
      if (active && !disposed && !lost) { updateJelly(0, time); updateReefFish(time); draw(); }   // 止めるときも、いまの1枚は描いておく
    }
  }

  // 画面に触れるとブラウザの制限が外れるので、そのとき測り直す。
  // 「低」に下がっていたら、上限を外して余裕を測る
  const remeasure = () => {
    if (!sample.throttled && tier !== "low") return;
    sample.throttled = false;
    sample.probing = tier === "low";
    sample.start = 0;
  };
  // スマホは裏に回ったときなどに WebGL を取り上げることがある。たいていは戻ってくる
  // （three.js が準備し直す）ので、画面が見えているのに3秒たっても戻らないときだけ諦める
  const giveUpLater = () => {
    window.clearTimeout(lostTimer);
    lostTimer = window.setTimeout(() => {
      if (lost && !document.hidden && !disposed) opts.onFail?.("context-lost");
    }, 3000);
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    stop();
    if (!document.hidden) giveUpLater();
  };
  const onRestored = () => {
    lost = false;
    window.clearTimeout(lostTimer);
    refresh();
  };
  const onVisibility = () => {
    if (lost && !document.hidden) giveUpLater();
    refresh();
  };
  const onResize = () => { resize(); if (!running() && active && !lost) draw(); };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  document.addEventListener("pointerdown", remeasure, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", onResize);

  applyTier("mid");
  for (let i = 0; i < 40; i++) updateFish(0.05, i * 0.05);
  updateManta(0);
  updateTurtle(0);
  updateWrasse(0);
  updateWhaleshark(0);
  updateAngler(0);
  updateReefFish(0);
  updateJelly(0, 0);
  refresh();

  fetch(opts.modelUrl)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
    .then((buf) => new Promise<THREE.Object3D>((res, rej) => new GLTFLoader().parse(buf, "", (g) => res(g.scene), rej)))
    .then((root) => {
      if (disposed) return;
      buildFromGltf(root);
      applyTier(tier);
      updateReefFish(time);   // 住むサンゴが決まったので、熱帯魚をそのまわりへ移す
      if (!running() && active) draw();
      opts.onStatus?.({ tier, fps: sample.fps, throttled: sample.throttled, frozen, modelsLoaded });
    })
    .catch((e) => {
      // サンゴ礁もマンタも無い水だけが残るので、静かな地に切り替えてもらう
      console.warn("海の3Dモデルを読み込めませんでした", e);
      if (!disposed) opts.onFail?.("model");
    });

  return {
    setActive(v: boolean) { active = v; refresh(); },
    setMotion(v: boolean) { motion = v; refresh(); },
    setDepth(d: number, animate: boolean) {
      if (!(d > 0) || disposed) return;
      if (Math.abs(d - depthTo) < 1e-3) return;
      depthFrom = depthNow;
      depthTo = d;
      depthT = 0;
      if (!animate) finishDescent();
      refresh();
    },
    dispose() {
      disposed = true;
      stop();
      window.clearTimeout(lostTimer);
      // 先に外す（下の forceContextLoss が webglcontextlost を起こすため）
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      document.removeEventListener("pointerdown", remeasure);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

