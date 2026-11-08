import { readStoredString, writeStored } from "../storage";

/**
 * 海の深さ（段階③）。覚えた語数に応じて、背景の海が深くなる。
 *
 * three.js を使わない純粋なモジュール（App が起動時に読むので軽く保つ）。
 * 3Dの場面（oceanScene.ts）は、ここで決めた水深の数値ひとつから、光の届き方・色・
 * そこに住む生き物の数を計算する。
 *
 * 決まり
 *   - **一度潜った深さは戻さない**（`quest_ocean_reached`）。習得済みは間違えるとボックスが下がるので、
 *     覚えた語数は減ることがある。そのたびに海が浅くなると「どうして戻ったのか」が分からず、
 *     復習で1問間違えただけで罰を受けたように見える。
 *   - **潜ったことのある深さなら、浅い方も選べる**（`quest_bg_ocean_depth`）。深い海は暗く、
 *     サンゴもマンタもいない。浅い海が好きな人が、覚えるほど好きな海を失うのでは逆効果になる。
 *     既定は「いちばん深いところ」（覚えるたびに潜っていく）。
 */

export type DepthStageId = "shallows" | "reef" | "slope" | "offshore" | "twilight" | "deep";

export interface DepthStage {
  id: DepthStageId;
  /** 画面に出す名前 */
  name: string;
  /** 水深（m）。目の高さの深さで、海底はその4〜5m下 */
  depth: number;
  /** この深さまで潜れる覚えた語数 */
  minMastered: number;
  /** そこで見えるもの（画面の説明に使う） */
  scene: string;
  /**
   * 3D を描けない端末・読み込むまでの地の色（上・中・下）。
   * 3D の場面を描いたときの色合いに合わせ、明るさは段階③の前の地（6m・#2f8fb4 から）と同じく
   * 描いたものより暗めにしてある（どの段も、上ほど明るく下ほど暗い）
   */
  gradient: readonly [string, string, string];
}

/**
 * 段階。語数は、最初の段は数日・次は数週間で届き、上の段ほど間をあける。
 * 収録は中学1,062語・高1までで2,251語・高2までで3,676語・全7,726語。
 */
export const DEPTH_STAGES: readonly DepthStage[] = [
  {
    id: "shallows", name: "浅瀬", depth: 3, minMastered: 0,
    scene: "日の光が砂地に網目を描く海草の原。ウミガメが草を食みに来る",
    gradient: ["#3aa3c2", "#11587a", "#052433"],
  },
  {
    id: "reef", name: "サンゴ礁", depth: 8, minMastered: 30,
    scene: "枝サンゴとノウサンゴの礁。色とりどりの小魚とウミガメ、マンタ",
    gradient: ["#2a88ae", "#0c4766", "#041927"],
  },
  {
    id: "slope", name: "礁の斜面", depth: 18, minMastered: 150,
    scene: "海草が消え、ウミウチワが増える。ナポレオンフィッシュがゆっくり通る",
    gradient: ["#1d6a96", "#0a3757", "#03131f"],
  },
  {
    id: "offshore", name: "沖", depth: 35, minMastered: 500,
    scene: "青だけが残る海。ジンベエザメがゆっくり横切り、クラゲが漂いはじめる",
    gradient: ["#0e74a3", "#05468a", "#021a3a"],
  },
  {
    id: "twilight", name: "薄明の海", depth: 90, minMastered: 1500,
    scene: "日の光がわずかに届く暗い青。体を光らせるハダカイワシの群れと光るクラゲ",
    gradient: ["#061679", "#030c52", "#01041f"],
  },
  {
    id: "deep", name: "深海", depth: 250, minMastered: 3500,
    scene: "日の光の届かない海。チョウチンアンコウの提灯と、生き物の光だけが灯る",
    gradient: ["#03040f", "#010108", "#000003"],
  },
];

export const DEPTH_REACHED_KEY = "quest_ocean_reached";
export const DEPTH_CHOICE_KEY = "quest_bg_ocean_depth";

/** 選んだ深さ。"auto" は「いちばん深いところ（覚えるたびに潜る）」 */
export type DepthChoice = "auto" | DepthStageId;

export function stageIndexOf(id: string | null | undefined): number {
  const i = DEPTH_STAGES.findIndex(s => s.id === id);
  return i < 0 ? 0 : i;
}

/** 覚えた語数で潜れる、いちばん深い段 */
export function stageIndexFor(mastered: number): number {
  let i = 0;
  for (let k = 0; k < DEPTH_STAGES.length; k++) {
    if (mastered >= DEPTH_STAGES[k].minMastered) i = k;
  }
  return i;
}

/** 潜った段（戻さない）。保存が無い・壊れているときは最初の段 */
export function readReachedStage(): number {
  return stageIndexOf(readStoredString(DEPTH_REACHED_KEY));
}

export function saveReachedStage(index: number): void {
  writeStored(DEPTH_REACHED_KEY, DEPTH_STAGES[clampStage(index)].id);
}

export function parseDepthChoice(raw: string | null): DepthChoice {
  if (raw && DEPTH_STAGES.some(s => s.id === raw)) return raw as DepthStageId;
  return "auto";
}

export function readDepthChoice(): DepthChoice {
  return parseDepthChoice(readStoredString(DEPTH_CHOICE_KEY));
}

export function saveDepthChoice(choice: DepthChoice): void {
  writeStored(DEPTH_CHOICE_KEY, choice);
}

function clampStage(i: number): number {
  return Math.min(Math.max(Math.round(i), 0), DEPTH_STAGES.length - 1);
}

/**
 * いま見せる段。選んだ段が潜った段より深ければ（バックアップの復元で潜った記録が戻った、など）、
 * 潜った段まで上げる。まだ潜っていない海を見せない
 */
export function shownStageIndex(choice: DepthChoice, reached: number): number {
  const r = clampStage(reached);
  return choice === "auto" ? r : Math.min(stageIndexOf(choice), r);
}

/** 次の段と、そこまでの残りの語数（いちばん深い段なら null） */
export function nextStageInfo(mastered: number, reached: number): { stage: DepthStage; remaining: number; progress: number } | null {
  const r = clampStage(reached);
  const next = DEPTH_STAGES[r + 1];
  if (!next) return null;
  const from = DEPTH_STAGES[r].minMastered;
  const remaining = Math.max(0, next.minMastered - mastered);
  const progress = Math.min(1, Math.max(0, (mastered - from) / (next.minMastered - from)));
  return { stage: next, remaining, progress };
}

/** 3D を描けない端末・読み込むまでの地（その段の色）。水深の近い段の色を使う */
export function oceanGradientCss(depth: number): string {
  let best = DEPTH_STAGES[0];
  for (const s of DEPTH_STAGES) {
    if (Math.abs(Math.log(s.depth / depth)) < Math.abs(Math.log(best.depth / depth))) best = s;
  }
  const [a, b, c] = best.gradient;
  return `linear-gradient(${a}, ${b} 55%, ${c})`;
}

/* ------------------------------------------------------------------ 住む生き物 */

/**
 * 海底に並べるもの・泳ぐものが、その深さでどれだけいるか（0〜1。1 が画質ごとの上限の数）。
 *
 * 実際の海の分布をなぞる。海草とサンゴ（褐虫藻と共生する造礁サンゴ）は光が要るので浅い所だけ、
 * ウミウチワ（ヤギ類）は斜面から沖で多く、深海にも種類がいる。クラゲは沖から深いほど目立ち、
 * 生物発光（`glow`）は日の光が消える深さから。
 */
export type Dweller =
  | "seagrass" | "staghorn" | "brain" | "fan" | "rock"
  | "manta" | "fish" | "turtle" | "reeffish" | "wrasse" | "whaleshark" | "lantern" | "angler" | "jelly" | "glow" | "snow";

/** [水深, 量] の点を、水深の対数で直線につなぐ */
const HABITAT: Record<Dweller, readonly (readonly [number, number])[]> = {
  seagrass: [[3, 1], [8, 0.3], [16, 0]],
  staghorn: [[3, 0.3], [8, 1], [18, 0.45], [32, 0]],
  brain: [[3, 0.4], [8, 1], [18, 0.75], [35, 0.2], [70, 0]],
  fan: [[3, 0.3], [8, 0.55], [18, 1], [35, 1], [90, 0.5], [250, 0.3]],
  rock: [[3, 0.7], [8, 0.8], [18, 1], [250, 1]],
  manta: [[3, 1], [35, 1], [60, 0]],
  // ウミガメは海草を食べに浅い所へ来る。サンゴ礁までで、斜面には来ない（1匹なので 0.5 以上で出す）
  turtle: [[3, 1], [8, 1], [14, 0.4], [22, 0]],
  // 熱帯魚（チョウチョウウオ・デバスズメダイ）はサンゴのまわりに住む
  reeffish: [[3, 0.45], [8, 1], [18, 0.5], [30, 0]],
  // ナポレオンフィッシュ（メガネモチノウオ）は礁の斜面から沖。浅いサンゴ礁には出さない（段ごとの主役を分ける）
  wrasse: [[8, 0], [14, 0.7], [18, 1], [35, 0.75], [60, 0]],
  // ジンベエザメは沖の主役。礁の斜面には来ない
  whaleshark: [[18, 0], [26, 0.6], [35, 1], [55, 0.6], [80, 0]],
  // チョウチンアンコウは深海だけ
  angler: [[90, 0], [150, 0.6], [250, 1]],
  // 魚の群れ。浅い所ではカタクチイワシの群れ（形は Fish Kit の写真の魚）、深い所ではハダカイワシの群れ（lantern で光らせる）
  fish: [[3, 1], [35, 1], [90, 0.75], [250, 0.4]],
  // 群れのうちハダカイワシの割合（0＝銀色の群れ、1＝体を光らせる黒い群れ）。日の光が消える深さで入れ替わる
  lantern: [[35, 0], [70, 1]],
  jelly: [[12, 0], [18, 0.25], [35, 0.6], [90, 1], [250, 1]],
  glow: [[35, 0], [90, 0.55], [250, 1]],
  snow: [[8, 0], [35, 0.4], [90, 1], [250, 1]],
};

export function abundance(kind: Dweller, depth: number): number {
  const pts = HABITAT[kind];
  const d = Math.max(depth, 0.5);
  if (d <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [d1, v1] = pts[i];
    if (d <= d1) {
      const [d0, v0] = pts[i - 1];
      const t = (Math.log(d) - Math.log(d0)) / (Math.log(d1) - Math.log(d0));
      return v0 + (v1 - v0) * t;
    }
  }
  return pts[pts.length - 1][1];
}

/**
 * 水深を移すときの途中の水深（0〜1 の進み具合から）。対数でつなぐので、
 * 3m→8m も 90m→250m も同じ速さの「潜っている感じ」になる。始めと終わりはゆっくり
 */
export function depthAlong(from: number, to: number, t: number): number {
  const k = Math.min(Math.max(t, 0), 1);
  const e = k * k * (3 - 2 * k);
  return Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * e);
}
