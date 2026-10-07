import { describe, it, expect } from "vitest";
import { initialVocabulary } from "../src/data/vocabulary";
import { ALL_REWRITES, TEMPLATE_SENTENCES, checkRewrite } from "../scripts/apply_sentences";
import { junior } from "../scripts/sentences/junior";
import { senior } from "../scripts/sentences/senior";
import { senior2 } from "../scripts/sentences/senior2";
import { senior3 } from "../scripts/sentences/senior3";
import { advanced } from "../scripts/sentences/advanced";

/**
 * 定型文の例文を、語ごとに書き下ろした例文へ置き換えた結果の検査。
 *
 * 置き換え前は、品詞ごとの文枠に語を流し込んだ例文が半数近くを占めていた
 * （capability … "He spent all morning cleaning the [_____]."）。
 * 書き下ろしは scripts/sentences/<レベル>.ts にあり、scripts/apply_sentences.ts が
 * 単語データへ反映する。ここでは「書き下ろしが決まりを守っているか」「反映し忘れていないか」
 * 「定型文に戻っていないか」を見る。誤答を入れても文が成り立たないかは機械では見られないので、
 * 書くときに誤答を見ながら確かめている。
 */

const byId = new Map(initialVocabulary.map(w => [w.id, w]));
const FILES = { junior, senior, senior2, senior3, advanced };

/**
 * 書き直しを終えたレベル。ここに入れたレベルに定型文が残っていたら落ちる。
 * 例外は見出しそのものが英語として成り立たず、例文を書けない語だけ
 */
const DONE_LEVELS = ["junior", "senior"];
const NOT_WRITABLE: Record<string, string> = {
  s605: "be threatened to … 受け身の threaten は to 不定詞を取らない（be threatened with が正しい形）",
  s667: "in tough … 英語の成句ではない（訳は「苦労して，厳しい」）"
};

/**
 * 定型文の例文が残っている語数の上限。書き直しが進んだら下げる（増やしてはいけない）
 */
const MAX_TEMPLATE_SENTENCES = 2789;

describe("定型文の例文の書き直し", () => {
  it("書き直しが決まりを守っている", () => {
    const bad: string[] = [];
    for (const [id, pair] of Object.entries(ALL_REWRITES)) {
      const w = byId.get(id);
      if (!w) { bad.push(`${id}: 収録語に無い`); continue; }
      for (const e of checkRewrite(w, pair)) bad.push(`${id} ${w.word}: ${e}`);
    }
    expect(bad).toEqual([]);
  });

  it("書き直しが単語データに反映されている", () => {
    // apply_sentences.ts を回し忘れると、書いた例文が画面に出ない
    const bad = Object.entries(ALL_REWRITES)
      .filter(([id, [sentence, translation, distractors]]) => {
        const w = byId.get(id);
        if (!w) return false;
        if (w.sentence !== sentence || w.sentenceTranslation !== translation) return true;
        return !!distractors && !distractors.every(d => w.sentenceOptions.includes(d));
      })
      .map(([id]) => id);
    expect(bad).toEqual([]);
  });

  it("同じ例文を2語に使っていない", () => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const [id, [sentence]] of Object.entries(ALL_REWRITES)) {
      if (seen.has(sentence)) dup.push(`${seen.get(sentence)} / ${id}: ${sentence}`);
      seen.set(sentence, id);
    }
    expect(dup).toEqual([]);
  });

  it("書き直しはその語のレベルのファイルに置いている", () => {
    const bad: string[] = [];
    for (const [level, rewrites] of Object.entries(FILES)) {
      for (const id of Object.keys(rewrites)) {
        const w = byId.get(id);
        if (w && w.level !== level) bad.push(`${id}: ${w.level} の語が ${level}.ts にある`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("書き直しを終えたレベルに定型文が残っていない", () => {
    const left = initialVocabulary
      .filter(w => DONE_LEVELS.includes(w.level) && TEMPLATE_SENTENCES.has(w.sentence) && !NOT_WRITABLE[w.id])
      .map(w => `${w.id} ${w.word}: ${w.sentence}`);
    expect(left).toEqual([]);
  });

  it("定型文の例文が増えていない", () => {
    const count = initialVocabulary.filter(w => TEMPLATE_SENTENCES.has(w.sentence)).length;
    expect(count).toBeLessThanOrEqual(MAX_TEMPLATE_SENTENCES);
  });

  it("書き下ろした例文の和訳に訳語を差し込んだ形が無い", () => {
    // 定型文の和訳は「彼は午前中ずっと『容量』を掃除していました。」のように訳語を
    // かぎ括弧で差し込んでいた。書き直した語にその形が残っていないことを見る
    const bad = Object.keys(ALL_REWRITES)
      .map(id => byId.get(id))
      .filter(w => w && /『[^』]*』/.test(w.sentenceTranslation) && w.sentenceTranslation.includes(`『${w.translation}』`))
      .map(w => `${w!.id}: ${w!.sentenceTranslation}`);
    expect(bad).toEqual([]);
  });
});
