import * as fs from "fs";
import * as path from "path";
import { readVocabularyFile, VOCABULARY_FILE } from "./vocabularyFile";
import { loadWordNet, posOf } from "./wordnetIndex";

/**
 * 収録語ごとに「WordNet が記録している品詞」を tests/data/wordnetPos.ts に書き出す。
 *
 * 品詞の検査（tests/vocabulary.data.test.ts）は、以前は語義データの使用割合から
 * 「辞書がその品詞を記録しているか」を推し量っていた。割合が 0 の品詞
 * （実測したが一度も出てこなかった）も記録ありに数えていたため、
 * behavior（形容詞 0%・名詞 100%）や once（名詞 0%・副詞 98%）がすり抜け、
 * 誤った品詞の文枠から作った意味の通らない例文が出題されていた。
 * かといって割合が 0 の品詞を外すと、drill（名詞）のように
 * 辞書にはあるが実測に出てこないだけの品詞まで誤りとして拾ってしまう。
 * 辞書そのものと突き合わせるのが確かなので、`.cache/` を持たないCIでも
 * 検査できるよう、ここで書き出しておく（semcorRank.ts と同じ扱い）。
 *
 *   npx tsx scripts/bake_wordnet_pos.ts
 */

const LETTER: Record<string, string> = { noun: "n", verb: "v", adjective: "a", adverb: "r" };

const wn = loadWordNet();
const { words } = readVocabularyFile(VOCABULARY_FILE);
const table: Record<string, string> = {};
for (const w of words) {
  const lemma = String(w.word || "").trim().toLowerCase();
  if (!/^[a-z][a-z'-]*$/.test(lemma) || table[lemma] !== undefined) continue;
  const pos = posOf(wn, lemma);
  if (pos.length > 0) table[lemma] = pos.map(p => LETTER[p]).join("");
}

const out = path.join(process.cwd(), "tests/data/wordnetPos.ts");
fs.writeFileSync(out, `/**
 * 収録語（1語の見出し）を WordNet がどの品詞で記録しているか。
 * scripts/bake_wordnet_pos.ts が生成する。品詞の検査だけに使う。
 *
 * n=名詞 v=動詞 a=形容詞 r=副詞。WordNet に見出しが無い語は入っていない。
 * 出典: WordNet 3.0 の index.noun / index.verb / index.adj / index.adv
 */
export const wordnetPos: Record<string, string> = ${JSON.stringify(table)};
`, "utf8");
console.log(`tests/data/wordnetPos.ts: ${Object.keys(table).length}語`);
