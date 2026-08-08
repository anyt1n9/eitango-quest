/**
 * vocabulary.ts の各語に品詞(pos)を焼き込むスクリプト。
 * 判定ロジックは src/pos.ts の inferPartOfSpeech を唯一の実装として使う。
 *
 * 実行: npx tsx scripts/bake_pos.ts
 */
import fs from "fs";
import path from "path";
import { inferPartOfSpeech } from "../src/pos";

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
const dist: Record<string, number> = {};
for (const w of arr) {
  w.pos = inferPartOfSpeech(w.word, w.translation);
  dist[w.pos] = (dist[w.pos] || 0) + 1;
}
fs.writeFileSync(file, src.slice(0, arrStart) + JSON.stringify(arr) + src.slice(arrEnd + 1));
console.log(`${arr.length}語に pos を付与しました`, JSON.stringify(dist));
