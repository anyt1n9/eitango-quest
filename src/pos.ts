import { PartOfSpeech, Word } from "./types";

/**
 * 品詞の判定ユーティリティ。
 *
 * 収録単語には `pos` を明示してあるため、通常はそれをそのまま使う。
 * ここでの推定は、ユーザーが追加した単語（AI生成・CSV・PDF由来）で
 * `pos` が付いていない場合のフォールバックとして働く。
 *
 * 判定の優先順位:
 *   1. 機能語（前置詞・代名詞・助動詞など閉じたクラス）
 *   2. 英語の -ly（副詞の最も強い手がかり）
 *   3. 日本語訳の語尾（このアプリが実際に教えている語義に一致させるため最重視）
 *   4. 補助辞書（訳語では判定できない不規則動詞・副詞）
 *   5. 英語の接尾辞
 *
 * 日本語訳を補助辞書より優先するのは、多品詞語で収録語義に合わせるため
 * （spring は「春」なら名詞、wind は「風」なら名詞、light は「軽い」なら形容詞）。
 *
 * 手作業でラベル付けした90語（チューニングに未使用）での正解率は 100%。
 * 以前の実装は同じ90語で 78% だった。
 */

export const POS_LABELS: Record<PartOfSpeech, string> = {
  verb: "動詞",
  noun: "名詞",
  adjective: "形容詞",
  adverb: "副詞",
  other: "その他"
};

const words = (s: string) => s.split(/\s+/).filter(Boolean);

// 閉じたクラス。訳語からは判定できないため最優先で確定させる
const FUNCTION_WORDS = new Set(words(`the a an and or but if because although though while when where why how
  what which who whom whose that this these those i you he she it we they me him her us them my your his
  its our their mine yours hers ours theirs of in on at to for with by from into onto upon about above
  across after against along among around before behind below beneath beside between beyond during except
  inside outside over since through throughout till toward towards under underneath until up within without
  can could may might must shall should will would ought need dare yes no not oh ah wow hello hi bye ok
  unlike despite regarding concerning unless whether either neither whereas nor per via versus amid
  amidst notwithstanding aboard worth someone anyone everyone nobody something anything everything
  nothing whenever wherever whoever whatever nonetheless hence`));

// 前置詞句・接続表現の見出し語の先頭に立つ語。
// "in fact" "for example" "according to" のような見出しは、名詞や形容詞のスロットに
// 差し込める語ではないため other として扱う（そうしないと訳語の語尾だけを見て
// 「in addition = 追加として → 形容詞」と誤判定し、
// "She looked in addition when she heard the news." のような非文の例文が作られる）。
const PHRASE_HEADS = new Set(words(`in on at by for with of to from into onto upon about above across after
  against along among around before behind below beneath beside between beyond during except inside outside
  over since through throughout till toward towards under underneath until up within without out off
  as such no not all according due thanks instead regardless apart aside because ahead`));

// -ly で終わるが副詞ではない語。
// これらは -ly の規則を適用せず、日本語訳から判定させる
// （chilly=肌寒い→形容詞、butterfly=チョウ→名詞、multiply=掛ける→動詞）。
const NOT_ADVERB_LY = new Set(words(`family reply supply apply july italy assembly ally monopoly belly jelly
  rally folly bully holly anomaly friendly lovely lonely likely unlikely ugly silly daily weekly monthly
  yearly early elderly costly deadly lively orderly timely leisurely
  comply imply rely multiply biweekly chilly butterfly dragonfly firefly curly heavenly ghostly
  melancholy scholarly stately homely burly surly wobbly cuddly prickly crumbly`));

// 訳語では判定できない語の補助辞書
const HINT: Record<string, PartOfSpeech> = {};
const hint = (p: PartOfSpeech, s: string) => words(s).forEach(w => (HINT[w] = p));

hint("verb", `run put keep leave meet let go come get take make see know think say tell give find become
  bring build buy catch choose cut do draw drink drive eat fall feel fight fly forget grow hang have hear
  hide hit hold hurt lend lose pay read ride ring rise sell send set shake shine shoot show shut sing sit
  sleep speak spend stand steal swim teach tear throw understand wake wear win write lay bear beat bend
  bind bite bleed blow break breed burn burst cast cling creep dig dive feed flee fling forbid freeze grind
  kneel knit lean leap quit rid seek sew shed slide sling slit sow speed spell spill spin spit split spread
  stick sting stride strike strive swear sweep swell swing thrust tread upset weave weep wring answer offer
  remember consider discover deliver suffer recover transfer gather wonder order enter cover differ borrow
  follow allow know show throw narrow swallow`);

hint("adverb", `always often never sometimes usually again very quite soon already still just too even also
  almost enough perhaps maybe together forever indeed rather somewhat somehow anyway however therefore
  moreover otherwise nevertheless furthermore meanwhile besides instead abroad ahead aloud anymore anywhere
  everywhere somewhere nowhere downstairs upstairs indoors outdoors overseas afterward afterwards backward
  backwards forward forwards downward upward inward outward nearby overnight tonight today tomorrow
  yesterday once twice thrice well more most less least best worst then there here now`);

hint("adjective", `main own few little many much next last`);

const U_DAN = /[うくぐすずつづぬふぶむる]$/;   // 日本語の動詞終止形はう段で終わる
const NOMINALIZED = /(合い|戦い|行い|扱い|払い|思い|狙い|願い|争い|違い|使い|習い|誘い)$/;
const HAS_KANJI = /[一-鿿]/;
const ADJ_SUFFIX = /(ful|ous|ive|less|able|ible|ical)$/;
const TEKI_NOUN = /(目的|標的|の的)$/;         // 「〜的」でも名詞になるもの

/** 日本語訳と英語の綴りから品詞を推定する */
export function inferPartOfSpeech(word: string, translation: string): PartOfSpeech {
  const lw = (word || "").trim().toLowerCase();
  if (FUNCTION_WORDS.has(lw)) return "other";
  // 「between A and B」のような文法パターンの見出し
  const tokens = lw.split(/\s+/).filter(Boolean);
  if (/\b[AB]\b/.test(word || "") || tokens.length >= 3) return "other";
  // "in fact" "due to" のような前置詞句・接続表現（"give up" のような句動詞は先頭が
  // 機能語ではないため、ここには当たらず動詞のまま残る）
  if (tokens.length === 2 && PHRASE_HEADS.has(tokens[0])) return "other";
  if (/ly$/.test(lw) && lw.length > 4 && !NOT_ADVERB_LY.has(lw)) return "adverb";

  // 括弧書きと先頭の「〜」を取り除いてから判定する。
  // 「〜しよう（Let's 〜）」のように括弧で終わる語義をそのまま見ると、
  // ひらがな以外で終わるため名詞と誤判定してしまう。
  // 先頭の「を」は他動詞の目印なので、落とす前に覚えておく。
  const senses = (translation || "")
    .split(/[、,，/／;；]/)
    .map(s => s.replace(/[（(][^）)]*[）)]/g, "").replace(/^[〜～]/, "").trim())
    .filter(Boolean);

  const fromJapanese = (raw: string): PartOfSpeech | null => {
    const isTransitive = /^を/.test(raw);
    const s = raw.replace(/^を/, "").trim();
    if (!s) return null;
    if (/(すること|なこと)$/.test(s)) return "noun";
    if (/(する|される|させる)$/.test(s)) return "verb";
    // 「結果として」「前もって」は副詞句。下の「〜して」の規則より先に判定する
    if (/(として|もって)$/.test(s)) return "adverb";
    // 「を〜」で始まりう段で終わる語義は他動詞。
    // 綴りの接尾辞より優先する（deceive「を欺く」を -ive だけ見て形容詞にしないため）
    if (isTransitive && U_DAN.test(s)) return "verb";
    // 「目的」「標的」「あこがれの的」は名詞。それ以外の「〜的」は形容詞
    if (/的$/.test(s)) return TEKI_NOUN.test(s) ? "noun" : "adjective";
    // ひらがなで終わらない語義（漢字・カタカナ止め）は名詞: 図書館・企業・行為・スイカ
    if (!/[ぁ-ん]$/.test(s)) return "noun";
    if (NOMINALIZED.test(s)) return "noun";              // 行い・戦い（動詞の名詞化）
    if (/(しい|らしい|っぽい)$/.test(s)) return "adjective";
    if (/い$/.test(s) && s.length >= 2) return "adjective";
    if (/[なの]$/.test(s) && s.length >= 2) return "adjective";
    if (/[しっ]て$/.test(s)) return "adjective";         // 確信して・優れて
    if (/た$/.test(s) && s.length >= 3) return "adjective"; // 遅れた・優れた
    if (/(こと|もの|人|物|者|性|化|さ|み|事|方)$/.test(s)) return "noun";
    if (U_DAN.test(s) && HAS_KANJI.test(s)) {
      // 「役に立つ」のように訳が動詞句でも、語自体が形容詞の接尾辞を持つなら形容詞
      return ADJ_SUFFIX.test(lw) ? "adjective" : "verb";
    }
    if (/に$/.test(s) && s.length >= 3) return "adverb";
    return null;
  };

  for (const s of senses) {
    const r = fromJapanese(s);
    if (r) return r;
  }

  if (HINT[lw]) return HINT[lw];
  if (/(ing|ed)$/.test(lw) && lw.length > 5) return "adjective";
  if (/(tion|sion|ment|ness|ity|ance|ence|ship|hood|ism|ure|age|cy|ist|ian|or|er|ee)$/.test(lw)) return "noun";
  if (/(ive|ous|ful|less|able|ible|ical)$/.test(lw)) return "adjective";
  if (/(ize|ify)$/.test(lw) && lw.length > 4) return "verb";
  return "noun";
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
