/**
 * カードとボタンの透明感（ガラス）。
 *
 * 背景（ジャングル・海の飾り、または利用者の写真）は、その上に載る
 * 不透明なカードでほとんど隠れてしまう。カードを半透明にして
 * 背後をぼかすと、背景を見せながら文字も読める状態にできる。
 *
 * 既定は「オフ」＝これまでどおり不透明。
 * 透明にするほど文字は読みにくくなるので、**どこまで薄くするかは利用者が選ぶ**。
 * 実際の濃さは `src/index.css` の `:root[data-glass="..."]` にあり、
 * 明暗どちらのテーマでも基準（WCAG AA）を満たすかは
 * e2e の「ガラスの下に最悪の色を敷いても読める」で実測している。
 */
import { writeStored } from "./storage";

export type GlassLevel = "off" | "light" | "strong";

export const GLASS_KEY = "quest_glass";

/** 選択肢。画面に出す文言もここに持つ */
export const GLASS_CHOICES: { level: GlassLevel; label: string; note: string }[] = [
  { level: "off", label: "オフ", note: "背景を透かさない（既定）" },
  { level: "light", label: "うすく透ける", note: "文字の読みやすさを保つ" },
  { level: "strong", label: "しっかり透ける", note: "背景がよく見える" }
];

export function readGlassLevel(): GlassLevel {
  try {
    const saved = localStorage.getItem(GLASS_KEY);
    return saved === "light" || saved === "strong" ? saved : "off";
  } catch {
    // localStorage が使えない環境では、いちばん読みやすい状態にしておく
    return "off";
  }
}

export function saveGlassLevel(level: GlassLevel): void {
  writeStored(GLASS_KEY, level);
}
