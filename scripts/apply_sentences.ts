import { readVocabularyFile, writeVocabularyFile, VOCABULARY_FILE } from "./vocabularyFile";
import {
  NOUN, VERB_TRANS, VERB_INTRANS, ADJ_QUALITY, ADJ_ATTR, ADJ_STATE, ADV, OTHER
} from "./rewrite_template_sentences";
import { SentenceRewrites } from "./sentences/types";
import { junior } from "./sentences/junior";
import { senior } from "./sentences/senior";
import { senior2 } from "./sentences/senior2";
import { senior3 } from "./sentences/senior3";
import { advanced } from "./sentences/advanced";

/**
 * 定型文の例文を、語ごとに書き下ろした例文へ置き換える。
 *
 * 収録語の約半数（3,820語）は、品詞ごとの文枠に語を流し込んだ例文だった
 * （rewrite_template_sentences.ts）。品詞が正しくても枠と語の意味が噛み合わず、
 *   capability … "He spent all morning cleaning the [_____]."
 *   resolve    … "The council decided to [_____] the old bridge."
 *   spin       … "They gathered to [_____] as a group."
 * のような意味の通らない文が出題されていた。和訳も「彼は午前中ずっと『容量』を
 * 掃除していました。」のように訳語をかぎ括弧で差し込んだだけの文だった。
 *
 * 書き直しは scripts/sentences/<レベル>.ts に [例文, 和訳] で置く。書くときの決まり
 * （checkRewrite が確かめる）:
 *   - 穴埋め [_____] はちょうど1つ。直前に a / an を置かない（母音で答えが絞れてしまう）
 *   - 答えの綴りを穴の外に出さない
 *   - 穴の直後に付けてよい語尾は s / es / d / ed / 's だけ（選択肢は原形で出るため）
 *   - 英文は ASCII だけで、大文字で始まり . ! ? で終わる
 *   - 和訳に訳語をかぎ括弧で差し込まない（会話文のかぎ括弧は可）
 * 決まりで確かめられないことが1つある。**誤答の選択肢を入れても文が成り立たないこと**。
 * 例文穴埋めは同じ品詞の語を4つ並べるので、"Many shops are closed on [_____]." は
 * 誤答の Monday でも正しい文になる。書くときに誤答を見ながら、その語でしか埋まらない文にする
 * （作業用の一覧は `npx tsx scripts/apply_sentences.ts --list <level>` で出る）。
 * 誤答に同じ意味の語があってどう書いても埋まってしまうとき（because of と on account of）は、
 * 3つ目の要素で誤答を差し替える。差し替える語は収録語で、答えと同じ品詞のものに限る
 * （四択の誤答は同じ品詞から選ぶ決まり。tests/vocabulary.data.test.ts が見ている）。
 *
 *   npx tsx scripts/apply_sentences.ts          … 検査して単語データへ反映
 *   npx tsx scripts/apply_sentences.ts --check  … 検査だけ
 */

export const ALL_REWRITES: SentenceRewrites = { ...junior, ...senior, ...senior2, ...senior3, ...advanced };

export const TEMPLATE_SENTENCES = new Set(
  [...NOUN, ...VERB_TRANS, ...VERB_INTRANS, ...ADJ_QUALITY, ...ADJ_ATTR, ...ADJ_STATE, ...ADV, ...OTHER]
    .map(f => f.en)
);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 書き直し1件を確かめ、守れていない決まりを返す（空なら問題なし） */
export function checkRewrite(
  word: { word: string; translation: string },
  [sentence, translation]: [string, string, ...unknown[]]
): string[] {
  const errors: string[] = [];
  const holes = sentence.match(/\[_____\]/g) || [];
  if (holes.length !== 1) errors.push(`穴埋めが${holes.length}個`);
  if (/\b(a|an)\s+\[_____\]/i.test(sentence)) errors.push("穴の直前に a / an");
  if (!/^\[_____\](s|es|d|ed|'s)?(?=[\s.,!?;:"']|$)/.test(sentence.slice(sentence.indexOf("[_____]")))) {
    errors.push("穴の直後の語尾が s / es / d / ed / 's 以外");
  }
  if (/[^\x20-\x7e]/.test(sentence)) errors.push("英文に ASCII 以外の文字");
  if (!/^[A-Z"'[]/.test(sentence)) errors.push("英文が大文字で始まらない");
  if (!/[.!?]["']?$/.test(sentence)) errors.push("英文が . ! ? で終わらない");
  if (new RegExp(`\\b${escape(word.word)}\\b`, "i").test(sentence.replace("[_____]", " "))) {
    errors.push("答えの綴りが穴の外に出ている");
  }
  if (!/[ぁ-んァ-ヶ一-鿿]/.test(translation)) errors.push("和訳に日本語が無い");
  if (translation.includes(`「${word.translation}」`)) errors.push("和訳に訳語をかぎ括弧で差し込んでいる");
  if (/[「」]/.test(translation) && !sentence.includes("\"")) errors.push("会話文でないのに和訳にかぎ括弧");
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const { source, words } = readVocabularyFile(VOCABULARY_FILE);

  if (args[0] === "--list") {
    // 書き直しの作業用一覧（まだ書き直していない定型文の語と、その誤答）
    const level = args[1];
    for (const w of words) {
      if (w.level !== level || !TEMPLATE_SENTENCES.has(w.sentence) || ALL_REWRITES[w.id]) continue;
      const wrong = (w.sentenceOptions as string[]).filter(o => o !== w.word).join(",");
      console.log(`${w.id}|${w.word}|${w.pos}|${w.translation}|${wrong}`);
    }
    return;
  }

  const byId = new Map(words.map((w: any) => [String(w.id), w]));
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const [id, pair] of Object.entries(ALL_REWRITES)) {
    const w = byId.get(id);
    if (!w) { problems.push(`${id}: 収録語に無い`); continue; }
    for (const e of checkRewrite(w, pair)) problems.push(`${id} ${w.word}: ${e} … ${pair[0]}`);
    // 書き下ろした例文を別の定型文以外の例文で上書きしない（手で書いた例文を消さないため）
    if (!TEMPLATE_SENTENCES.has(w.sentence) && w.sentence !== pair[0]) {
      problems.push(`${id} ${w.word}: 定型文ではない例文を上書きしようとしている … ${w.sentence}`);
    }
    const distractors = pair[2];
    if (distractors) {
      if (new Set(distractors).size !== 3 || distractors.includes(w.word)) {
        problems.push(`${id} ${w.word}: 差し替える誤答は答えと別の3語にする … ${distractors.join(", ")}`);
      }
      for (const d of distractors) {
        if (!words.some((o: any) => o.word === d && o.pos === w.pos)) {
          problems.push(`${id} ${w.word}: 誤答 ${d} は収録語に同じ品詞(${w.pos})で無い`);
        }
      }
    }
    const dup = seen.get(pair[0]);
    if (dup) problems.push(`${id} ${w.word}: ${dup} と同じ例文`);
    seen.set(pair[0], id);
  }
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    console.error(`\n${problems.length}件の問題があります。`);
    process.exit(1);
  }
  if (args[0] === "--check") {
    console.log(`${Object.keys(ALL_REWRITES).length}件、問題ありません。`);
    return;
  }

  let changed = 0;
  for (const w of words) {
    const pair = ALL_REWRITES[w.id];
    if (!pair) continue;
    // 誤答を差し替えるときは、答えの位置はそのままにして残りの3つを入れ替える
    const options = pair[2]
      ? (() => { const rest = [...pair[2]]; return w.sentenceOptions.map((o: string) => o === w.word ? o : rest.shift()); })()
      : w.sentenceOptions;
    if (w.sentence === pair[0] && w.sentenceTranslation === pair[1]
      && options.join("|") === w.sentenceOptions.join("|")) continue;
    w.sentence = pair[0];
    w.sentenceTranslation = pair[1];
    w.sentenceOptions = options;
    changed++;
  }
  writeVocabularyFile(source, words, VOCABULARY_FILE);
  const remaining = words.filter((w: any) => TEMPLATE_SENTENCES.has(w.sentence)).length;
  console.log(`${changed}語の例文を書き直しました（定型文の残り: ${remaining}語）`);
}

if (process.argv[1] && process.argv[1].endsWith("apply_sentences.ts")) main();
