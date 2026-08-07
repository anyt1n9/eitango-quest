/**
 * 配列シャッフルの共通ユーティリティ。
 *
 * 以前は各コンポーネントで `[...arr].sort(() => Math.random() - 0.5)` を使っていたが、
 * これは比較関数が一貫性を持たないため、シャッフル結果が一様分布にならない。
 * 実測では4択の選択肢をこの方法で並べ替えた場合、元の先頭要素が
 * 1番目に残る確率が約36%（一様なら25%）になる。
 * 四択の `options` / `sentenceOptions` は常に「正解 + ダミー3件」の順で
 * 生成されているため、正解の位置が偏り、最初の選択肢を選び続けるだけで
 * 期待値より高い正答率が出てしまっていた。
 *
 * ここでは一様分布が保証される Fisher-Yates シャッフルを用いる。
 */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 配列からランダムに最大 size 件を抜き出す（Fisher-Yates の部分シャッフル）。
 *
 * AIへ渡す単語リストには語数の上限があるが、以前は先頭から slice していたため、
 * 例えば7,000語を習得したユーザーでも常に同じ「最初の300語」しかAIに渡らず、
 * 日記や弱点分析の内容が学習の進み具合を反映しなかった。
 * 全体からランダムに抽出することで、偏りなく代表を選ぶ。
 */
export function sampleArray<T>(arr: T[], size: number): T[] {
  if (arr.length <= size) return [...arr];
  const copy = [...arr];
  for (let i = 0; i < size; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, size);
}
