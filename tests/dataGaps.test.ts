import { describe, it, expect } from "vitest";
import { initialVocabulary } from "../src/data/vocabulary";
import { wordSenses } from "../src/data/senses";
import { wordUsage } from "../src/data/wordUsage";

/**
 * 収録データの「埋まっていないところ」を、理由ごと固定する。
 *
 * 語義・文型・コロケーションは、どれも既存の辞書（EJDict / WordNet）から
 * 機械的に焼き込んでいる。辞書に無いものは作れないので穴が残る。
 * 穴そのものは直せないが、放っておくと
 *   - 生成をやり直したときに、埋まっていたところまで抜ける
 *   - 「なぜ空なのか」が分からなくなり、毎回調べ直すことになる
 * ので、件数と内訳をここで押さえる。
 *
 * 上限は「今より悪くなったら落ちる」ための線で、目標値ではない。
 * 減らせたら一緒に下げること。
 */

const V = initialVocabulary;
const usage: Record<string, any> = wordUsage as any;

/** 句（スペース・~・? を含む見出し）。辞書の見出しにならない */
const isPhrase = (word: string) => /[\s~?]/.test(word);

describe("語義の穴", () => {
  const missing = V.filter(w => !wordSenses[w.id]?.length);

  it("語義が付いていない語は353語まで", () => {
    expect(missing.length).toBeLessThanOrEqual(353);
  });

  it("穴の大半は「辞書の見出しにならない句」である", () => {
    // in front of / as a result / result in … EJDict は1語ずつの見出しなので引けない
    const phrases = missing.filter(w => isPhrase(w.word));
    expect(phrases.length / missing.length).toBeGreaterThan(0.7);
  });

  it("句以外で語義が無いのは、辞書より新しい語と複合語だけ", () => {
    // EJDict のもとになった辞書には laptop / blog / karaoke のような語が無い。
    // workplace / artwork のような複合語も見出しになっていない。
    // ここに「ふつうの1語」が現れたら、生成が壊れている
    const singles = missing.filter(w => !isPhrase(w.word));
    expect(singles.length).toBeLessThanOrEqual(80);
  });

  it("借りた語義には由来が書いてある", () => {
    const borrowed = Object.entries(wordSenses).filter(([, list]) => list.some(s => s.from));
    expect(borrowed.length).toBeGreaterThan(150);
    for (const [id, list] of borrowed) {
      for (const s of list) {
        expect(s.from, `${id} の語義に from が無い`).toBeTruthy();
      }
    }
  });

  it("いちばん基本的な語には語義がある", () => {
    // be動詞と do の活用は EJDict の項目が相互参照だけで、
    // そのままでは語義が空のままだった（scripts/borrow_senses.ts で基本形から借りている）
    for (const word of ["be", "is", "am", "are", "was", "were", "been", "do", "did", "have"]) {
      const w = V.find(x => x.word.toLowerCase() === word);
      expect(w, `${word} が収録されていない`).toBeTruthy();
      expect(wordSenses[w!.id]?.length, `${word} に語義が無い`).toBeGreaterThan(0);
    }
  });
});

describe("動詞の文型の穴", () => {
  const verbs = V.filter(w => w.pos === "verb");
  const missing = verbs.filter(w => !usage[w.id]?.patterns?.length);

  it("文型が付いていない動詞は70語まで", () => {
    // 以前は167語あったが、その大半は WordNet の抜けではなく品詞の付け間違い
    // （形容詞・名詞を動詞として教えていた）だった。scripts/fix_pos.ts で直している
    expect(missing.length).toBeLessThanOrEqual(70);
  });

  it("残っているのは句と、WordNet に文型の無い動詞だけ", () => {
    // WordNet の sentence frame は連結詞（be動詞）や新しい語には付いていない
    const KNOWN = new Set([
      "be", "am", "is", "are", "was", "were", "been",   // 連結詞。文型の概念が当てはまらない
      "do", "did", "does", "have", "has", "had",
      "hesitate", "commit", "annoy", "transact", "wilt", // WordNet に frame が無い
      "pardon", "set", "paddle", "outdo", "taunt", "untie", "gnaw",
      "want", "ask", "call",
      "babysit", "overbook", "unsubscribe", "curate",    // 辞書より新しい動詞
      "impassion", "reconciliate", "carry-on",
      "considering", "expecting", "reviewing", "fading", "burgeoning" // 分詞
    ]);
    const unexpected = missing
      .filter(w => !isPhrase(w.word))
      .map(w => w.word.toLowerCase())
      .filter(w => !KNOWN.has(w));
    expect(unexpected).toEqual([]);
  });

  it("動詞として教えている語が形容詞に偏っていない", () => {
    // 「文型が無い動詞」を洗うと、形容詞を動詞として教えている語が見つかる。
    // 訳が「〜のある」「〜な」で終わるのに動詞、という組み合わせを見張る
    const suspicious = V.filter(
      w => w.pos === "verb"
        && !isPhrase(w.word)
        && /(のある|的な|らしい|っぽい)$/.test(w.translation.split(/[、,，/／]/)[0].trim())
    );
    expect(suspicious.map(w => `${w.word}(${w.translation})`)).toEqual([]);
  });
});

describe("コロケーションの穴", () => {
  const missing = V.filter(w => !usage[w.id]?.collocations?.length);

  it("コロケーションが付いていない語は5,900語まで", () => {
    expect(missing.length).toBeLessThanOrEqual(5900);
  });

  it("採るのは和訳のある句だけ（英語だけの句は出さない）", () => {
    // 英語の句だけ出しても読めないので、EJDict に和訳がある句に限っている。
    // 和訳の無い句まで採れば件数は増やせるが、画面には出せない
    for (const [id, entry] of Object.entries(usage)) {
      for (const c of entry.collocations || []) {
        expect(c.meaning, `${id}:${c.phrase} に和訳が無い`).toBeTruthy();
        expect(/[ぁ-んァ-ヶ一-龠]/.test(c.meaning), `${id}:${c.phrase} の和訳が日本語でない`).toBe(true);
      }
    }
  });

  it("よく使う名詞にはコロケーションが付いている", () => {
    // 動詞は EJDict の句が「英語だけ」のことが多く、give / decide のように
    // 和訳のある句が1つも無い語がある。名詞は複合語として載るので拾える
    for (const word of ["school", "time", "station", "water"]) {
      const w = V.find(x => x.word.toLowerCase() === word)!;
      expect(usage[w.id]?.collocations?.length, `${word}`).toBeGreaterThan(0);
    }
  });
});
