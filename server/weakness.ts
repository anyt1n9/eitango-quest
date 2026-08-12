/**
 * 苦手分析のフォールバック。
 *
 * AIが使えないとき（キーが無い・呼び出し予算を使い切った・応答が壊れている）に
 * 手元の集計で返す。集計だけで作れる内容なので、
 * ここは 503 ではなく 200 で返して学習を止めない
 * （長文生成や頻度分析のように「AIの分析結果」を騙ることにならないため）。
 *
 * server.ts から切り出してあるのは、純粋な関数としてテストするため。
 */

export const POS_JP_LABELS: Record<string, string> = {
  verb: "動詞",
  noun: "名詞",
  adjective: "形容詞",
  adverb: "副詞",
  other: "その他"
};

export interface PosStat {
  label: string;
  count: number;
  percentage: number;
}

/**
 * 品詞の内訳を数える。
 * 語尾からの推測なので当たらないこともあるが、
 * クライアントが品詞を送ってきていればそちらを優先する。
 */
export function heuristicPosStats(words: { word: string; pos?: string }[]): PosStat[] {
  const counts: Record<string, number> = { "動詞": 0, "名詞": 0, "形容詞": 0, "副詞": 0, "その他": 0 };
  for (const w of words) {
    // クライアントが品詞を明示してきた場合はそれを優先する
    if (w.pos && POS_JP_LABELS[w.pos]) {
      counts[POS_JP_LABELS[w.pos]]++;
      continue;
    }
    const lw = String(w.word || "").toLowerCase();
    if (lw.endsWith("ly")) counts["副詞"]++;
    else if (lw.endsWith("tion") || lw.endsWith("ity") || lw.endsWith("ment") || lw.endsWith("ness")) counts["名詞"]++;
    else if (lw.endsWith("ive") || lw.endsWith("ous") || lw.endsWith("al") || lw.endsWith("ful")) counts["形容詞"]++;
    else if (lw.endsWith("ed") || lw.endsWith("ing") || lw.endsWith("ize") || lw.endsWith("ise")) counts["動詞"]++;
    else counts["その他"]++;
  }
  const total = words.length || 1;
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => ({ label, count, percentage: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

export function buildFallbackWeaknessAnalysis(words: { word: string }[]) {
  const partOfSpeechStats = heuristicPosStats(words);
  const topPos = partOfSpeechStats[0];
  return {
    summary: topPos
      ? `間違えた単語の中では「${topPos.label}」が最も多く(${topPos.percentage}%)、ここが伸びしろのポイントです。`
      : "分析できる間違えた単語がまだ十分にありません。",
    partOfSpeechStats,
    topicStats: [{ label: "総合", count: words.length, percentage: 100 }],
    recommendations: [
      "間違えた単語の復習リストを毎日少しずつ解き、定着させましょう。",
      "似た品詞の単語をまとめて覚えると、語形の違いを整理しやすくなります。",
      "例文ごと音読して、単語を文脈の中で覚える習慣をつけましょう。"
    ],
    isFallback: true
  };
}
