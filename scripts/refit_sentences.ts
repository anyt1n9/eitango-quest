/**
 * 品詞を直した語の定型例文だけを、新しい品詞に合う文枠へ入れ替える。
 *
 * 例文の文枠は品詞ごとに分かれている（scripts/rewrite_template_sentences.ts）。
 * 品詞を直しても例文はそのままなので、動詞から形容詞に直した語に
 * 動詞用の文枠が残る：
 *   multiple（多数の、複数の）に "We were too tired to [_____] any longer."
 *
 * rewrite_template_sentences.ts をそのまま流すと収録語の半数を書き換えて
 * しまうため、ここでは「定型文を使っていて、かつ今の品詞の枠に載っていない語」
 * だけを対象にする。
 *
 *   npx tsx scripts/refit_sentences.ts
 */
import fs from "fs";
import path from "path";
import {
  Frame, NOUN, ADV, OTHER, VERB_TRANS, VERB_INTRANS,
  ADJ_QUALITY, ADJ_ATTR, ADJ_STATE, adjectivePoolKey, insertForm
} from "./rewrite_template_sentences";

const POOLS: Record<string, Frame[]> = {
  noun: NOUN, adverb: ADV, other: OTHER,
  verbT: VERB_TRANS, verbI: VERB_INTRANS,
  adjQuality: ADJ_QUALITY, adjAttr: ADJ_ATTR, adjState: ADJ_STATE
};

function poolKeyFor(w: any): string {
  const pos: string = w.pos || "noun";
  if (pos === "verb") return /を/.test(w.translation) ? "verbT" : "verbI";
  if (pos === "adjective") return adjectivePoolKey(w.word, w.translation);
  return pos;
}

const file = path.join(process.cwd(), "src/data/vocabulary.ts");
const src = fs.readFileSync(file, "utf8");
const marker = "const rawVocabulary: any[] = ";
const arrStart = src.indexOf("[", src.indexOf(marker) + marker.length);
let depth = 0, inStr = false, esc = false, arrEnd = -1;
for (let i = arrStart; i < src.length; i++) {
  const c = src[i];
  if (esc) { esc = false; continue; }
  if (inStr) { if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
  if (c === '"') { inStr = true; continue; }
  if (c === "[") depth++;
  else if (c === "]") { depth--; if (depth === 0) { arrEnd = i; break; } }
}
const arr: any[] = JSON.parse(src.slice(arrStart, arrEnd + 1));

// 2語以上で共有されている例文＝定型文。1語しか使っていない例文はその語のために
// 書かれたものなので触らない
const count = new Map<string, number>();
for (const w of arr) {
  const k = String(w.sentence).replace(/\[_____\]/g, "◯");
  count.set(k, (count.get(k) || 0) + 1);
}
const isTemplate = (w: any) => (count.get(String(w.sentence).replace(/\[_____\]/g, "◯")) || 0) > 1;

// どのプールの枠かを引けるようにする
const frameOwner = new Map<string, string>();
for (const [key, pool] of Object.entries(POOLS)) {
  for (const f of pool) if (!frameOwner.has(f.en)) frameOwner.set(f.en, key);
}

const cursor: Record<string, number> = {};
const fixed: string[] = [];

for (const w of arr) {
  if (!isTemplate(w)) continue;
  const want = poolKeyFor(w);
  const owner = frameOwner.get(String(w.sentence));
  // 今の品詞の枠に載っていればそのまま
  if (owner === want) continue;
  // 定型文だが文枠の一覧に無いもの（過去の生成物）は触らない
  if (!owner) continue;

  const pool = POOLS[want] || NOUN;
  const contains = new RegExp(`\\b${String(w.word).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
  let frame = pool[0];
  for (let k = 0; k < pool.length; k++) {
    const idx = (cursor[want] = (cursor[want] || 0) + 1) % pool.length;
    frame = pool[idx];
    // 枠の英文に答えの語が入っていると、問題文に答えが見えてしまう
    if (!contains.test(frame.en.replace(/\[_____\]/g, " "))) break;
  }
  const before = w.sentence;
  w.sentence = frame.en;
  w.sentenceTranslation = frame.ja.replace("{}", insertForm(w.pos, w.translation, frame.form || "pred"));
  fixed.push(`${w.word}(${w.pos}) ${owner} → ${want}\n    ${before}\n    ${w.sentence}`);
}

if (fixed.length > 0) {
  fs.writeFileSync(file, src.slice(0, arrStart) + JSON.stringify(arr) + src.slice(arrEnd + 1));
}
console.log(`品詞に合わない文枠を ${fixed.length} 語ぶん入れ替えました`);
for (const line of fixed) console.log("  " + line);
