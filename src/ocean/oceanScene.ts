/**
 * 海の3D背景（three.js）。
 *
 * 画像ファイルは使わない。光の筋・水底の光の網目・漂う粒・魚の群れはその場で計算して描き、
 * マンタ・サンゴ・岩・海草は Blender でプログラム生成した3Dモデル（src/ocean/assets/ocean.glb、
 * 生成は scripts/blender/make_ocean_assets.py）を読む。
 *
 * 水は赤い光から吸収するので、深いほど赤が消えて青だけが残る（色はすべて
 * 「日光が水を通ってどれだけ残るか」から計算する）。いまは表層（水深6m）だけを描く。
 *
 * このファイルは three.js ごと大きいので、背景を「海（3D）」にした人にだけ読み込む
 * （src/components/OceanBackground.tsx から動的に import する）。
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { judge, tierSpecs, type OceanTier, isSoftwareRenderer } from "./quality";
import { MANTA_RADIUS, SCHOOL_SWAY, swimSpread } from "./swim";

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
  dispose(): void;
}

export interface OceanOptions {
  modelUrl: string;
  motion: boolean;
  onStatus?: (s: OceanStatus) => void;
  /**
   * 描き続けられなくなった（3Dモデルを取れない・WebGL を失って戻らない）。
   * 呼ばれたら、呼び出し側は片付けて静かな地に切り替える
   */
  onFail?: (reason: "model" | "context-lost") => void;
}

/** 日光が水を1m 通るごとに弱まる割合（赤・緑・青）。赤が最初に消える */
const KD: [number, number, number] = [0.2, 0.06, 0.028];
/** いまの水深（m）。表層のサンゴ礁 */
const DEPTH = 6;
/** 水の見通し（大きいほどかすむ。試作で「モデルがかすんで見えない」と言われて半分以下にした） */
const FOG = 0.45;
const HALF_SPAN = 2.1;

const exposureFor = (d: number) => Math.min(Math.max(Math.pow(Math.exp(-KD[1] * d), -0.5), 1), 10);

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
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
  count: number;
  size: [number, number];
  squash: [number, number];
  sink: number;
  meadow?: boolean;
  tints: [number, number, number][];
}

/** 海底に並べるもの（数は画質「高」のとき） */
const REEF_PLAN: ReefPlan[] = [
  { name: "rock_a", count: 16, size: [0.7, 1.7], squash: [0.6, 0.9], sink: 0.18, tints: [[1, 1, 1], [0.9, 0.92, 0.95], [1.08, 1.02, 0.95]] },
  { name: "rock_b", count: 14, size: [0.5, 1.3], squash: [0.6, 0.9], sink: 0.15, tints: [[1, 1, 1], [0.95, 1, 0.92]] },
  { name: "staghorn_a", count: 16, size: [0.9, 1.6], squash: [0.9, 1.1], sink: 0.03, tints: [[1, 1, 1], [0.92, 0.95, 1.12], [1.12, 0.96, 0.82]] },
  { name: "staghorn_b", count: 14, size: [0.9, 1.5], squash: [0.9, 1.1], sink: 0.03, tints: [[1, 1, 1], [1.05, 0.85, 1.05]] },
  { name: "brain", count: 14, size: [0.3, 0.75], squash: [0.9, 1.1], sink: 0.04, tints: [[1, 1, 1], [0.85, 1.1, 0.85], [1.1, 0.9, 0.8]] },
  { name: "fan", count: 7, size: [0.8, 1.4], squash: [1, 1], sink: 0.02, tints: [[1, 1, 1], [0.8, 0.7, 1.3], [1.3, 0.9, 0.6]] },
  { name: "seagrass", count: 150, size: [1.1, 1.9], squash: [0.7, 1.3], sink: 0, meadow: true, tints: [[1, 1, 1], [0.9, 1.08, 0.88], [1.12, 1.0, 0.82]] },
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
  const lookBase = new THREE.Vector3(0, -2.6, -10);

  const U = {
    uTime: { value: 0 },
    uDepth: { value: DEPTH },
    uExposure: { value: exposureFor(DEPTH) },
    uKd: { value: new THREE.Vector3(...KD) },
    uSun: { value: new THREE.Vector3(1.0, 0.97, 0.9).multiplyScalar(1.8) },
    uSunDir: { value: new THREE.Vector3(0.25, 1.0, -0.35).normalize() },
    uCaustic: { value: 1 },
    uFog: { value: FOG },
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
      varying float vDist;
      void main() {
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
      varying float vDist;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard;
        vec3 lit = (sunAt(uDepth) * 0.45 + waterTint(uDepth) * 0.35) * exp(-r * 3.0) * exp(-vDist * 0.05) * 0.3;
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
      varying vec3 vWorld; varying vec3 vN; varying float vSide;
      void main() {
        vec3 p = position;
        float tail = smoothstep(0.05, -0.3, p.z);
        p.x += sin(uTime * 9.0 + aPhase * 6.2831 - p.z * 9.0) * 0.05 * tail;
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vWorld = wp.xyz; vSide = normal.y;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: WATER + `
      varying vec3 vWorld; varying vec3 vN; varying float vSide;
      void main() {
        float d = uDepth - vWorld.y;
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        // dark back, silver belly: how open-water fish hide from above and below
        vec3 alb = mix(vec3(0.85, 0.88, 0.9), vec3(0.1, 0.2, 0.3), smoothstep(-0.15, 0.55, vSide));
        vec3 L = sunAt(d);
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 H = normalize(V + vec3(0.0, 1.0, 0.0));
        float spec = pow(max(dot(n, H), 0.0), 36.0) * 1.8;
        vec3 lit = alb * (L * max(n.y * 0.7 + 0.3, 0.0) * 0.9 + waterTint(d) * 0.4) + L * spec;
        gl_FragColor = vec4(finalize(throughWater(lit, length(vWorld - cameraPosition))), 1.0);
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

  /* ---- reef from the Blender file ---- */
  const reefMat = track(mat({ vertexShader: REEF_VERT, fragmentShader: OBJ_FRAG }));
  const fanMat = track(mat({ vertexShader: REEF_VERT, fragmentShader: OBJ_FRAG, defines: { FAN_SWAY: "" }, side: THREE.DoubleSide }));
  const grassMat = track(mat({ vertexShader: REEF_VERT, fragmentShader: OBJ_FRAG, defines: { GRASS_SWAY: "" }, side: THREE.DoubleSide }));
  const reef: { plan: ReefPlan; lods: (THREE.InstancedMesh | null)[] }[] = [];
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
      reef.push({ plan, lods });
    }
    for (let lod = 0; lod < 3; lod++) {
      const src = byName[`manta_${lod}`];
      if (!src) continue;
      const m = new THREE.Mesh(track(plainGeometry(src)), mantaMat);
      m.frustumCulled = false;
      m.visible = false;
      manta.add(m);
      mantaLods[lod] = m;
    }
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

  function applyTier(name: OceanTier) {
    tier = name;
    const q = TIERS[name];
    renderer.setPixelRatio(q.pixelRatio);
    resize();
    pMat.uniforms.uPR.value = q.pixelRatio;
    pGeo.setDrawRange(0, q.particles);
    fish.count = q.fish;
    rays.forEach((r, i) => { r.visible = i < q.rays; });
    U.uCaustic.value = q.caustic;
    for (const { plan, lods } of reef) {
      lods.forEach((m, lod) => {
        if (!m) return;
        m.visible = lod === q.lod;
        m.count = Math.max(1, Math.round(plan.count * q.reef));
      });
    }
    mantaLods.forEach((m, lod) => { if (m) m.visible = lod === q.lod; });
    sample.start = 0;
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 68 : 55;
    camera.updateProjectionMatrix();
  }

  /* ---- per-frame ---- */
  const up = new THREE.Vector3(0, 1, 0);
  const vx = new THREE.Vector3(), vy = new THREE.Vector3(), vz = new THREE.Vector3(), m4 = new THREE.Matrix4(), sv = new THREE.Vector3();
  // 横長の画面では泳ぐ範囲を左右に広げ、カードの列の外（余白）にも出す（src/ocean/swim.ts）
  function updateFish(dt: number, t: number) {
    const n = fish.count;
    const tx = SCHOOL_C.x + Math.sin(t * 0.13) * SCHOOL_SWAY * swimSpread(camera.aspect), ty = SCHOOL_C.y + Math.sin(t * 0.21) * 1.4, tz = SCHOOL_C.z + Math.cos(t * 0.11) * 5;
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
      // scatter away from the manta
      const mx = fPos[ix] - mantaPos.x, my = fPos[ix + 1] - mantaPos.y, mz = fPos[ix + 2] - mantaPos.z;
      const md = mx * mx + my * my + mz * mz;
      if (md < 9) { const k = ((9 - md) * 0.9) / (Math.sqrt(md) + 0.1); fx += mx * k; fy += my * k * 0.5; fz += mz * k; }
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
      sv.setScalar(fScale[i]);
      m4.scale(sv);
      m4.setPosition(fPos[ix], fPos[ix + 1], fPos[ix + 2]);
      fish.setMatrixAt(i, m4);
    }
    fish.instanceMatrix.needsUpdate = true;
  }

  const qRoll = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
  function updateManta(t: number) {
    const th = t * ((2 * Math.PI) / 46) + 1.2;
    const rx = MANTA_RADIUS * swimSpread(camera.aspect);
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
    updateManta(time);
    updateFish(dt, time);
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
      if (active && !disposed && !lost) draw();   // 止めるときも、いまの1枚は描いておく
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
  refresh();

  fetch(opts.modelUrl)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
    .then((buf) => new Promise<THREE.Object3D>((res, rej) => new GLTFLoader().parse(buf, "", (g) => res(g.scene), rej)))
    .then((root) => {
      if (disposed) return;
      buildFromGltf(root);
      applyTier(tier);
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

