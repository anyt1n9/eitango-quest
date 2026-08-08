/**
 * テスト用の共通ヘルパー。
 */

/**
 * 決定的な擬似乱数生成器（mulberry32）。
 * `Math.random` を差し替えられる関数は、これを渡すことで結果を再現できる。
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 訳語を語義ごとに分解する（「風景、眺め」→ ["風景", "眺め"]）。src/distractors.ts と同じ規則 */
export function senses(translation: string): string[] {
  return (translation || "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .split(/[、,，/／;；]/)
    .map(s => s.trim())
    .filter(Boolean);
}
