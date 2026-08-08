/**
 * 四択の選択肢（options / sentenceOptions）を vocabulary.ts に焼き込むスクリプト。
 *
 * 以前は vocabulary.ts の読み込み時に毎回ランダム生成していたため、
 *   1. 誤答が同レベルからのランダム抽出になり、品詞すら揃っていなかった
 *   2. 7,753語ぶんの生成が起動のたびに走っていた
 * という2つの問題があった。品詞と表記の近さを考慮した選択肢を事前に作り、
 * データとして持たせる。
 *
 * 実行: npx tsx scripts/bake_options.ts
 */
import fs from "fs";
import path from "path";
import { pickDistractors, Candidate } from "../src/distractors";
import { shuffle } from "../src/shuffle";

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

const candidates: Candidate[] = arr.map(w => ({
  word: w.word,
  translation: w.translation,
  level: w.level,
  pos: w.pos
}));

// 品詞×レベルであらかじめ分類しておく（全語スキャンを避ける）
const byKey = new Map<string, Candidate[]>();
for (const c of candidates) {
  for (const key of [`${c.pos}|${c.level}`, `${c.pos}|*`]) {
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(c);
  }
}

let filled = 0;
for (let i = 0; i < arr.length; i++) {
  const w = arr[i];
  const target = candidates[i];
  const pool = [
    ...(byKey.get(`${target.pos}|${target.level}`) || []),
    ...(byKey.get(`${target.pos}|*`) || [])
  ];
  const jp = pickDistractors(target, pool, 3, "translation");
  const en = pickDistractors(target, pool, 3, "word");
  w.options = shuffle([w.translation, ...jp]);
  w.sentenceOptions = shuffle([w.word, ...en]);
  filled++;
}

fs.writeFileSync(file, src.slice(0, arrStart) + JSON.stringify(arr) + src.slice(arrEnd + 1));
console.log(`${filled}語の選択肢を焼き込みました`);
