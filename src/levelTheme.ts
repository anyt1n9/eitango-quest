import type { Level } from "./types";

/**
 * レベルの色。
 *
 * 明るいテーマも暗いテーマも海の深さ（浅瀬→波間→沖→深海→深淵）で表し、
 * レベルが上がるほど深い色になる。同じレベルは明暗で同じ色相にしている
 * （明るいテーマが森の5色だったときは、テーマを切り替えると別の色になっていた）。
 *
 * 色そのものは持たず、CSS の変数（`--lv-*`）を指すクラス名だけを持つ。
 * 値は `src/index.css` の `.level-*` と `.dark .level-*` にあり、
 * テーマごとに同じ変数を置き換えている。ここに実際の色を書くと
 * 明暗の2組をコンポーネント側で選ぶことになり、
 * 「片方のテーマだけ直し忘れる」形の不具合が入りやすい。
 */
export const LEVEL_TONE: Record<Level, string> = {
  junior: "level-junior",
  senior: "level-senior",
  senior2: "level-senior2",
  senior3: "level-senior3",
  advanced: "level-advanced"
};

/** 追加単語（レベルを持たない）の色。5段階のどれとも重ならないようにする */
export const CUSTOM_TONE = "level-custom";

/**
 * レベル以外の色分け。同じ変数の組（`--lv-*`）を使う。
 * AIアドバイスと弱点分析は紫と赤で塗られていて、どちらのテーマにも合わなかった。
 */
export const ACCENT_TONE = {
  /** AIアドバイス。明るいテーマでは主役の青、暗いテーマでは水面の青緑 */
  advice: "tone-advice",
  /** 弱点分析。明るいテーマでは朽ち葉の茶、暗いテーマでは深海の紫 */
  weakness: "tone-weakness"
} as const;

/** 色の組を使う部品。`LEVEL_TONE[level]` や `ACCENT_TONE.*` と組にして使う */
export const TONE_STYLE = {
  /** 見出しのラベル（淡い地に濃い文字） */
  badge: "bg-[var(--lv-bg-strong)] text-[var(--lv-fg)]",
  /** 数字などの強調文字 */
  text: "text-[var(--lv-fg)]",
  /** 進捗バー */
  bar: "bg-[var(--lv-solid)]",
  /** 主となるボタン（塗りつぶし。文字は白） */
  solid: "bg-[var(--lv-solid)] hover:bg-[var(--lv-solid-hover)] text-white",
  /** 補助のボタン（淡い地） */
  soft: "bg-[var(--lv-bg)] text-[var(--lv-fg)] hover:bg-[var(--lv-bg-strong)] border-[var(--lv-border)]"
} as const;
