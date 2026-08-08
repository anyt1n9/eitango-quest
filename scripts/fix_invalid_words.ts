/**
 * 実在しない見出し語を修正するスクリプト。
 *
 * 英単語リスト（370,105語）と突き合わせたところ、収録7,753語のうち15語が
 * 実在しない綴りだった。内訳は次の2種類で、いずれも生成過程の不具合と思われる。
 *   - 語尾の欠落: definit / distribut / implicat / diminut
 *   - 接尾辞の重複付与: disturbingal / ebullienceal / enervateal / disparateize / distantical
 *   - 単純な誤記: occation / abberation / dogmaticism / condiscent / coindex / validatement
 *   - 制御文字の混入: `false（先頭にバッククォート）
 *
 * このうち10語は、正しい綴りの語がすでに収録されているため削除する。
 * 残り6語は正しい綴りへ直す（condiscent は訳も誤っていたため合わせて修正）。
 *
 * 実行: npx tsx scripts/fix_invalid_words.ts
 */
import fs from "fs";
import path from "path";

/** 正しい綴りの語がすでに収録されているため、重複として削除する */
const REMOVE = [
  "occation",      // occasion が収録済み
  "abberation",    // aberration が収録済み
  "definit",       // definite が収録済み
  "disparateize",  // disparate が収録済み
  "distantical",   // distant が収録済み
  "distribut",     // distribute が収録済み
  "ebullienceal",  // ebullient が収録済み
  "coindex",       // coincide が収録済み
  "implicat",      // implication が収録済み
  "`false",        // 先頭にバッククォートが混入した壊れた見出し。false が収録済み
];

/** 正しい綴りが未収録のため、綴りを直して残す */
const RENAME: Record<string, { word: string; translation?: string }> = {
  diminut: { word: "diminutive", translation: "ごく小さい、小型の" },
  disturbingal: { word: "disturbing", translation: "不穏な、動揺させる" },
  dogmaticism: { word: "dogmatism", translation: "独断主義、教条主義" },
  enervateal: { word: "enervated", translation: "気力を奪われた、衰弱した" },
  validatement: { word: "validation", translation: "検証、有効性の確認" },
  // 「へりくだる、腰が低い」は condescending の意味と逆だったため訳も直す
  condiscent: { word: "condescending", translation: "見下すような、恩着せがましい" },
};

/** 表記の揺れ。固有名詞は大文字始まり、文中で使う語は小文字始まりに揃える */
const RECASE: Record<string, string> = {
  english: "English",
  However: "however",
  Although: "although",
  Whom: "whom",
  "What is more": "what is more",
};

/** 訳語が誤っていた語 */
const RETRANSLATE: Record<string, string> = {
  // appraisee は「評価する人」ではなく「評価される人」
  appraisee: "（人事評価などで）評価される人",
};

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

const removeSet = new Set(REMOVE);
const before = arr.length;
const kept = arr.filter(w => !removeSet.has(w.word.toLowerCase()));

let renamed = 0, retranslated = 0, recased = 0;
for (const w of kept) {
  if (RECASE[w.word]) { w.word = RECASE[w.word]; recased++; }
  const lw = w.word.toLowerCase();
  const r = RENAME[lw];
  if (r) {
    w.word = r.word;
    if (r.translation) w.translation = r.translation;
    renamed++;
  }
  const t = RETRANSLATE[lw];
  if (t) { w.translation = t; retranslated++; }
}

fs.writeFileSync(file, src.slice(0, arrStart) + JSON.stringify(kept) + src.slice(arrEnd + 1));
console.log(`削除（重複）: ${before - kept.length}語 / 綴りを修正: ${renamed}語 / 訳を修正: ${retranslated}語 / 表記を修正: ${recased}語`);
console.log(`収録語数: ${before} → ${kept.length}`);
