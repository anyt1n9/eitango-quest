/**
 * カードとボタンの透明感（ガラス）。
 *
 * 背景（ジャングル・海の飾り、または利用者の写真）は、その上に載る
 * 不透明なカードでほとんど隠れてしまう。カードを半透明にして
 * 背後をぼかすと、背景を見せながら文字も読める状態にできる。
 *
 * 既定は「オフ」＝これまでどおり不透明。
 * 透明にするほど文字は読みにくくなるので、**どこまで薄くするかは利用者が選ぶ**。
 * 実際の濃さは `src/index.css` の `:root[data-glass="..."]` にある。
 *
 * 段階は2種類に分かれる。
 *   `light` / `strong` … カードの地を残す。明暗どちらのテーマでも、
 *     背後がどんな色でも基準（WCAG AA）を満たすことを e2e で実測している
 *     （「ガラスの下に最悪の色を敷いても読める」）。
 *   `clear` … 地を**まったく置かない**。背後の写真がそのまま文字の地になるため、
 *     読みやすさは選んだ画像しだいで、**測って保証することはできない**。
 *     せめてもの補強として、背後を強くぼかし、文字のまわりに縁取りを付ける。
 *     選ぶ人が承知のうえで選べるよう、画面にもその旨を出す。
 */
import { writeStored } from "./storage";

export type GlassLevel = "off" | "light" | "strong" | "clear";

export const GLASS_KEY = "quest_glass";

/** 選択肢。画面に出す文言もここに持つ */
export const GLASS_CHOICES: { level: GlassLevel; label: string; note: string }[] = [
  { level: "off", label: "オフ", note: "背景を透かさない（既定）" },
  { level: "light", label: "うすく透ける", note: "文字の読みやすさを保つ" },
  { level: "strong", label: "しっかり透ける", note: "背景がよく見える" },
  { level: "clear", label: "透明", note: "地を置かない（画像しだいで読みにくい）" }
];

export function readGlassLevel(): GlassLevel {
  try {
    const saved = localStorage.getItem(GLASS_KEY);
    return saved === "light" || saved === "strong" || saved === "clear" ? saved : "off";
  } catch {
    // localStorage が使えない環境では、いちばん読みやすい状態にしておく
    return "off";
  }
}

export function saveGlassLevel(level: GlassLevel): void {
  writeStored(GLASS_KEY, level);
}
