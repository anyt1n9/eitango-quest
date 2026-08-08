import { PartOfSpeech } from "./types";

/**
 * 四択の誤答（ディストラクター）の選び方。
 *
 * 以前は同レベルの単語からランダムに3件選んでいた。そのため
 *   beautiful (美しい、きれいな) → 事務所、会社、オフィス / 17、十七 / 劇、ドラマ
 * のように、意味を知らなくても消去法で正解できる問題が大量に生まれていた。
 * 実測では誤答が正解と同じ品詞である割合は50%（＝ランダム相当）で、
 * 例文穴埋めでは23%の問題が「正解と同じ品詞の選択肢が1つだけ」だった。
 *
 * ここでは
 *   1. 同じ品詞・同じレベルの語を候補にする（品詞で消去法が使えないようにする）
 *   2. 正解と表記が近い語を優先する（紛らわしさを上げる）
 * という方針で選ぶ。
 */

export interface Candidate {
  word: string;
  translation: string;
  level: string;
  pos: PartOfSpeech;
}

/** 2つの文字列の文字の重なり具合（0〜1）。多いほど紛らわしい */
function charOverlap(a: string, b: string): number {
  if (!a || !b) return 0;
  const setB = new Set(b);
  let shared = 0;
  const seen = new Set<string>();
  for (const c of a) {
    if (seen.has(c)) continue;
    seen.add(c);
    if (setB.has(c)) shared++;
  }
  return shared / Math.max(seen.size, 1);
}

/** 語尾の一致文字数（英単語の形態的な紛らわしさ） */
function suffixMatch(a: string, b: string): number {
  let n = 0;
  const la = a.toLowerCase(), lb = b.toLowerCase();
  while (n < la.length && n < lb.length && la[la.length - 1 - n] === lb[lb.length - 1 - n]) n++;
  return n;
}

/** 長さの近さ（0〜1） */
function lengthCloseness(a: string, b: string): number {
  const d = Math.abs(a.length - b.length);
  return 1 / (1 + d);
}

/**
 * 候補から誤答を選ぶ。
 * `mode` が "translation" なら日本語訳の四択、"word" なら英単語の四択。
 * 上位の紛らわしい候補からランダムに選ぶことで、毎回同じ組み合わせにならないようにする。
 */
export function pickDistractors(
  target: Candidate,
  candidates: Candidate[],
  count: number,
  mode: "translation" | "word",
  random: () => number = Math.random
): string[] {
  const valueOf = (c: Candidate) => (mode === "translation" ? c.translation : c.word);
  const correct = valueOf(target);
  const correctLower = correct.toLowerCase();

  // 同じ品詞の語だけを候補にする（品詞での消去法を封じる）
  const samePos = candidates.filter(
    c => c.pos === target.pos && valueOf(c).toLowerCase() !== correctLower && valueOf(c).trim() !== ""
  );
  // 同じレベルを優先し、足りなければ品詞のみ一致の語で補う
  const sameLevel = samePos.filter(c => c.level === target.level);
  const primary = sameLevel.length >= count * 4 ? sameLevel : samePos;
  const pool = primary.length >= count ? primary : candidates.filter(
    c => valueOf(c).toLowerCase() !== correctLower && valueOf(c).trim() !== ""
  );
  if (pool.length === 0) return [];

  const score = (c: Candidate) => {
    const v = valueOf(c);
    if (mode === "translation") {
      // 日本語は文字の重なり（「〜する」「〜な」など語尾の型も含む）を重視
      return charOverlap(correct, v) * 2 + lengthCloseness(correct, v);
    }
    // 英単語は語尾の一致と長さの近さを重視
    return suffixMatch(correct, v) * 0.5 + lengthCloseness(correct, v);
  };

  // 重複した表記を除いたうえで、紛らわしい順に並べる
  const uniq = new Map<string, Candidate>();
  for (const c of pool) {
    const v = valueOf(c);
    if (!uniq.has(v)) uniq.set(v, c);
  }
  const ranked = [...uniq.values()].sort((a, b) => score(b) - score(a));

  // 上位から選ぶが、毎回同じにならないよう上位グループの中でランダムに散らす
  const topN = Math.min(ranked.length, Math.max(count * 5, 12));
  const top = ranked.slice(0, topN);
  const picked: string[] = [];
  const used = new Set<number>();
  while (picked.length < count && used.size < top.length) {
    const i = Math.floor(random() * top.length);
    if (used.has(i)) continue;
    used.add(i);
    picked.push(valueOf(top[i]));
  }
  // それでも足りない場合は順位順に補う
  for (const c of ranked) {
    if (picked.length >= count) break;
    const v = valueOf(c);
    if (!picked.includes(v)) picked.push(v);
  }
  return picked;
}
