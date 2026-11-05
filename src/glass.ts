/**
 * カードとボタンの透明感（ガラス）。
 *
 * 背景（ジャングル・海の飾り、海の3D背景、または利用者の写真）は、その上に載る
 * 不透明なカードでほとんど隠れてしまう。カードを半透明にして
 * 背後をぼかすと、背景を見せながら文字も読める状態にできる。
 *
 * 透明度は 0〜100（%）の1つの数で持ち、ヘッダーとメニューのつまみ（`GlassSlider`）で動かす。
 * 以前は「オフ／うすく／しっかり／透明」の4つから選ぶだけで、「しっかり」（18%）と「透明」（100%）の
 * 間が無く、海の生き物を見たい人は読みにくさを承知で「透明」に飛ぶしかなかった。
 *
 * 既定は 0＝不透明。透かすほど文字は読みにくくなるので、**どこまで透かすかは利用者が選ぶ**。
 * 範囲は2つに分かれる（`glassRegime`）。
 *   1〜18（`veil`）… カードの地を8割以上残す。明暗どちらのテーマでも、
 *     背後がどんな色でも基準（WCAG AA）を満たすことを e2e で実測している
 *     （「ガラスの下に最悪の色を敷いても読める」。上限の 18 で測れば、地がそれより濃い 1〜17 も読める）。
 *   19〜100（`clear`）… 背後の色がそのまま文字の地に混ざるため、
 *     読みやすさは背景しだいで、**測って保証することはできない**。
 *     せめてもの補強として、文字のまわりに縁取りを付け、背後を少しだけぼかす。
 *     強くぼかす（以前の「透明」は24px）と、透かしても裏を泳ぐ海の生き物が形の無いしみになり、
 *     「透明なのに何も見えない」状態だった。100% で 3px（細かい光の粒が文字に重ならない程度）。
 *     カードの中の選択欄・ボタンも、この範囲では透かしていく。
 *     選ぶ人が承知のうえで選べるよう、画面にもその旨を出す。
 * 実際の濃さは `src/index.css` の `--glass-t` から計算している。
 *
 * 起動直後の値は `index.html` の先頭のスクリプトも当てる（React を待つと、面の色が後から変わり
 * 背景色に掛かる200msの遷移でちらつく）。読み方は `parseGlass` と同じにすること。
 */
import { useSyncExternalStore } from "react";
import { readStoredString, writeStored } from "./storage";

export const GLASS_KEY = "quest_glass";
/** ここまでは読みやすさを保証する（e2e で実測している上限） */
export const GLASS_SAFE_MAX = 18;

export type GlassRegime = "off" | "veil" | "clear";

/**
 * よく使う値。メニューにボタンで並べる（つまみで18ちょうどに合わせるのは難しい）。
 * 文言もここに持つ。
 */
export const GLASS_PRESETS: { value: number; id: string; label: string; note: string }[] = [
  { value: 0, id: "off", label: "オフ", note: "背景を透かさない（既定）" },
  { value: GLASS_SAFE_MAX, id: "safe", label: `${GLASS_SAFE_MAX}%`, note: "文字の読みやすさを保つ上限" },
  { value: 100, id: "clear", label: "透明", note: "地を置かない（背景しだいで読みにくい）" }
];

/** 以前の4段階の保存値。そのときと同じ見え方になる数に読み替える */
const LEGACY: Record<string, number> = { off: 0, light: 14, strong: GLASS_SAFE_MAX, clear: 100 };

/** 保存値を読む。知らない値・壊れた値はいちばん読みやすい 0 にする */
export function parseGlass(raw: string | null): number {
  if (raw === null) return 0;
  // `in` は Object の持ち物（"toString" など）まで拾うので、自分の持ち物だけを見る
  if (Object.prototype.hasOwnProperty.call(LEGACY, raw)) return LEGACY[raw];
  if (!/^\d{1,3}$/.test(raw)) return 0;
  const n = Number(raw);
  return n >= 0 && n <= 100 ? n : 0;
}

export function clampGlass(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function glassRegime(value: number): GlassRegime {
  if (value <= 0) return "off";
  return value <= GLASS_SAFE_MAX ? "veil" : "clear";
}

export function readGlass(): number {
  return parseGlass(readStoredString(GLASS_KEY));
}

/** 画面に当てる（CSS が `--glass-t` から濃さを計算する） */
export function applyGlass(value: number, root: HTMLElement = document.documentElement): void {
  root.dataset.glass = glassRegime(value);
  root.style.setProperty("--glass-t", String(value));
}

/* ── ヘッダーとメニューで同じ値を共有する ─────────────
   App の state にすると、つまみを動かすたびに画面全体を描き直すことになる
   （ドラッグ中は1秒に数十回）。値は CSS の変数で効くので、React の描き直しは要らない。
   つまみを出している部品だけがこの値を読む。 */
let current: number | null = null;
const listeners = new Set<() => void>();

export function getGlass(): number {
  if (current === null) current = readGlass();
  return current;
}

/*
 * 保存は少し待ってからまとめて1回にする。ドラッグ中に毎回書くと、保存できない環境
 * （Cookie を塞いだブラウザ）では1秒に数十回の警告になる。閉じる・裏に回るときは待たずに書く。
 */
const SAVE_DELAY_MS = 250;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let flushHooked = false;

export function flushGlassSave(): void {
  if (saveTimer === null) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  writeStored(GLASS_KEY, String(getGlass()));
}

function scheduleSave(): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushGlassSave, SAVE_DELAY_MS);
  if (!flushHooked && typeof window !== "undefined") {
    flushHooked = true;
    window.addEventListener("pagehide", flushGlassSave);
    document.addEventListener("visibilitychange", () => { if (document.hidden) flushGlassSave(); });
  }
}

export function setGlass(value: number): void {
  const next = clampGlass(value);
  if (next === current) return;
  current = next;
  applyGlass(next);
  scheduleSave();
  listeners.forEach(l => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGlass(): number {
  return useSyncExternalStore(subscribe, getGlass, getGlass);
}

/** テスト用。読み込み済みの値を捨てて、次に読むときに保存値から読み直す */
export function __resetGlassForTest(): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = null;
  current = null;
  listeners.clear();
}
