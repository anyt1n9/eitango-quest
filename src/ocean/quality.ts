/**
 * 海の3D背景の画質（高・中・低）と、自動で決める判定。
 *
 * 判定は「実際に描けたコマの間隔」で行う。ただし毎秒30コマぴったりで止まっているときは
 * 端末が重いのではなく、ブラウザが制限している（iPhone の省電力モード、
 * 埋め込み表示で画面に触れるまでの制限）。試作ではこれを「重い」と取り違えて
 * iPhone 14 で「低・30fps」にしていた（手で「高」にすると 50〜55fps 出た）。
 * 重い端末はコマの間隔がばらつくので、33ms に張り付いているかどうかで見分ける。
 */

export type OceanTier = "high" | "mid" | "low";

export interface TierSpec {
  label: string;
  /** 描画の解像度（端末の画素比の上限） */
  pixelRatio: number;
  /** 漂う粒の数 */
  particles: number;
  /** 群れの魚の数 */
  fish: number;
  /** 光の筋の本数 */
  rays: number;
  /** サンゴ・岩・海草を置く割合（高を 1 として） */
  reef: number;
  /** 3Dモデルの細かさ（0=高 1=中 2=低。ファイル内の名前 _0/_1/_2 に対応） */
  lod: 0 | 1 | 2;
  /** 水底の光の網目（1=2層、0.6=1層） */
  caustic: number;
  /** 1秒に描く上限のコマ数 */
  cap: number;
}

export const TIER_ORDER: OceanTier[] = ["high", "mid", "low"];

export function tierSpecs(dpr: number): Record<OceanTier, TierSpec> {
  return {
    high: { label: "高", pixelRatio: Math.min(dpr, 2), particles: 2600, fish: 160, rays: 14, reef: 1, lod: 0, caustic: 1, cap: 60 },
    mid: { label: "中", pixelRatio: Math.min(dpr, 1.25), particles: 1300, fish: 90, rays: 9, reef: 0.65, lod: 1, caustic: 1, cap: 60 },
    low: { label: "低", pixelRatio: Math.min(dpr, 0.85), particles: 450, fish: 36, rays: 4, reef: 0.35, lod: 2, caustic: 0.6, cap: 30 },
  };
}

/** 一定時間ぶんの描画の記録 */
export interface FrameSample {
  /** 連続したコマの間隔（ミリ秒） */
  intervals: number[];
  /** 描いたコマ数 */
  frames: number;
  /** 記録した時間（ミリ秒） */
  elapsedMs: number;
}

export interface JudgeContext {
  tier: OceanTier;
  /** いまの上限コマ数（測り直しで上限を外しているときは 60） */
  cap: number;
  /** 「低」で上限を外して余裕を測っている最中か */
  probing: boolean;
  /** 指で操作する端末か（スマホは「高」へ自動では上げない） */
  coarsePointer: boolean;
  /** すでに「高」を試したか（一度だけ試す） */
  triedHigh: boolean;
}

export type Verdict =
  | { kind: "keep"; fps: number }
  | { kind: "throttled"; fps: number }
  | { kind: "down"; to: OceanTier; fps: number }
  | { kind: "up"; to: OceanTier; fps: number };

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** 毎秒30コマにきっちり張り付いているか（ブラウザの制限の形） */
export function looksLikeBrowserCap30(intervals: number[]): boolean {
  if (intervals.length < 10) return false;
  const at30 = intervals.filter((x) => Math.abs(x - 33.3) < 3).length / intervals.length;
  return Math.abs(median(intervals) - 33.3) < 2 && at30 > 0.8;
}

export function judge(sample: FrameSample, ctx: JudgeContext): Verdict {
  const fps = sample.elapsedMs > 0 ? sample.frames / (sample.elapsedMs / 1000) : 0;
  if (ctx.cap > 30 && looksLikeBrowserCap30(sample.intervals)) return { kind: "throttled", fps };
  if (ctx.probing) {
    return fps >= 55 ? { kind: "up", to: "mid", fps } : { kind: "keep", fps };
  }
  const idx = TIER_ORDER.indexOf(ctx.tier);
  if (fps < ctx.cap * 0.72 && idx < TIER_ORDER.length - 1) return { kind: "down", to: TIER_ORDER[idx + 1], fps };
  if (ctx.tier === "mid" && fps > 57 && !ctx.coarsePointer && !ctx.triedHigh) return { kind: "up", to: "high", fps };
  return { kind: "keep", fps };
}
