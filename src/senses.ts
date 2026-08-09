import { WordSense } from "./types";

/**
 * 語義データの遅延読み込み。
 *
 * 語義（src/data/senses.ts）は約1.4MBあり、単語データに混ぜると
 * 初回読み込みが gzip で 400KB 以上増える。使うのは辞書画面とクイズの結果表示だけで、
 * 起動時には要らないため、必要になった時点で読み込む。
 *
 * 一度読み込んだら以降は同じ Promise を返すので、何度呼んでも取得は1回で済む。
 */
let cache: Promise<Record<string, WordSense[]>> | null = null;

export function loadSenses(): Promise<Record<string, WordSense[]>> {
  if (!cache) {
    cache = import("./data/senses")
      .then(m => m.wordSenses)
      .catch(e => {
        // 読み込めなくても学習は続けられるべきなので、空として扱う
        console.warn("語義データを読み込めませんでした", e);
        cache = null;
        return {};
      });
  }
  return cache;
}

/** 品詞の使用割合を「動詞 91%」のような表示用の文字列にする */
export const POS_SHARE_LABELS: Record<string, string> = {
  verb: "動詞",
  noun: "名詞",
  adjective: "形容詞",
  adverb: "副詞",
  other: "その他"
};

/**
 * 教材が教えている語義が、その単語で最もよく使われる品詞かどうかを判定する。
 * 違う場合は学習者に補足を出す価値がある
 * （例: watch は教材が「腕時計」＝名詞9%だが、実際は動詞が91%）。
 */
export function findDominantSense(
  senses: WordSense[] | undefined,
  ownPos: string | undefined
): WordSense | null {
  if (!senses || senses.length === 0) return null;
  const withShare = senses.filter(s => typeof s.share === "number");
  if (withShare.length === 0) return null;
  const top = withShare.reduce((a, b) => (b.share! > a.share! ? b : a));
  if (!ownPos || top.pos === ownPos) return null;
  const ownShare = withShare.find(s => s.pos === ownPos)?.share ?? 0;
  // 差が小さいときは口を出さない（order は名詞52%・動詞48%でどちらも普通に使う）
  return top.share! - ownShare >= 25 ? top : null;
}
