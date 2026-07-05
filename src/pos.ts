import { PartOfSpeech, Word } from "./types";

/**
 * 品詞の推定ユーティリティ。
 * Word.pos が明示されていればそれを使い、無ければ日本語訳の語尾と
 * 英語の語尾パターンから推定する。
 * 収録済みの約7,500語に品詞を手付けする代わりに、日本語訳という
 * 強いシグナル(「〜する」=動詞、「〜な/〜い」=形容詞 など)を活用する。
 */

export const POS_LABELS: Record<PartOfSpeech, string> = {
  verb: "動詞",
  noun: "名詞",
  adjective: "形容詞",
  adverb: "副詞",
  other: "その他"
};

/** 日本語訳と英語の綴りから品詞を推定する */
export function inferPartOfSpeech(word: string, translation: string): PartOfSpeech {
  // 訳が複数併記されている場合は先頭の訳を代表とする（例: "美しい、きれいな"）
  const firstSense = translation.split(/[、,，/／;；]/)[0].trim();

  // 1. 日本語訳の語尾による判定（最も信頼できるシグナル）
  if (/(する|させる|られる|れる)$/.test(firstSense)) return "verb";
  if (/^(を|に|と|が)/.test(firstSense) && /する$/.test(firstSense)) return "verb";
  if (/(な|い|的な?|しい)$/.test(firstSense) && !/(ない)$/.test(firstSense)) {
    // 「〜い」でも名詞のことがある（例: "戦い"）ため、形容詞語尾をより厳密に見る
    if (/(しい|い|な|的な?)$/.test(firstSense) && !/(合い|戦い|行い|扱い|払い|思い|狙い)$/.test(firstSense)) {
      return "adjective";
    }
  }
  if (/(に|く|く…|然と|的に)$/.test(firstSense)) return "adverb";

  // 2. 英語の語尾パターンによる判定（補助シグナル）
  const lw = word.toLowerCase().trim();
  if (/(?:ly)$/.test(lw) && lw.length > 4) return "adverb";
  if (/(?:tion|sion|ment|ness|ity|ance|ence|ship|hood|ism|ure|age|cy)$/.test(lw)) return "noun";
  if (/(?:ive|ous|ful|less|able|ible|ical|ial|ant|ent|ary|ate)$/.test(lw) && /(な|の)$/.test(firstSense)) return "adjective";
  if (/(?:ize|ise|ify|ate|en)$/.test(lw) && lw.length > 5) return "verb";
  if (/(?:er|or|ist|ian|ee)$/.test(lw) && lw.length > 4) return "noun";

  // 3. 日本語訳が名詞的（活用語尾を持たない）ならば名詞とみなす
  if (firstSense.length > 0 && !/(だ|です|ある)$/.test(firstSense)) {
    return "noun";
  }

  return "other";
}

/** Word から品詞を取得する（明示された pos を優先し、無ければ推定） */
export function getWordPos(w: Pick<Word, "word" | "translation" | "pos">): PartOfSpeech {
  if (w.pos && w.pos in POS_LABELS) return w.pos;
  return inferPartOfSpeech(w.word, w.translation);
}

/** 品詞の日本語ラベルを返す */
export function getWordPosLabel(w: Pick<Word, "word" | "translation" | "pos">): string {
  return POS_LABELS[getWordPos(w)];
}
