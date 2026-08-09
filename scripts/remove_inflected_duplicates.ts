/**
 * 基本形と意味が重複する活用形の見出し語を取り除くスクリプト。
 *
 * 収録語には -ed 形が独立した見出しとして混ざっていた。
 *   divided「分割した」(中2)  ⇄  divide「を分割する」(中2)
 *   caused「引き起こした」(上級) ⇄ cause「原因」(中1)
 * 同じ語を2回覚えさせることになり、習得数の分母も水増しされる。
 * caused が上級で cause が中1、のようにレベルもちぐはぐになる。
 *
 * ただし -ed 形すべてが不要なわけではない。
 *   tired「疲れた」/ disappointed「がっかりした」/ determined「断固とした」
 * のような分詞形容詞は、状態を表す独立した語として教える価値がある。
 * 機械的な判定（訳が「〜した」で終わるか）では 27語が該当したが、
 * 1件ずつ確認したところ実際に冗長なのは下の13語だけだった。残りは
 *   - 分詞形容詞（isolated / impressed / convinced / determined / puzzled など）
 *   - 基本形の照合が誤り（united←unite であって unit ではない。skilled も同様）
 *   - 基本形にその語義が無く、削ると内容が失われる（listed / prompted）
 * のいずれかで、いずれも残す。
 *
 * なお活用形そのものを学ぶ場は「動詞の活用表」の画面（src/components/VerbForms.tsx）
 * に用意したので、見出し語として重複させておく必要はない。
 *
 * 実行: npx tsx scripts/remove_inflected_duplicates.ts
 */
import fs from "fs";
import path from "path";

/** 基本形と同じ意味なので取り除く活用形（コメントは基本形とその訳） */
const REMOVE: Record<string, string> = {
  divided: "divide「を分割する，分ける」",
  imitated: "imitate「模倣する，真似る」",
  scattered: "scatter「まき散らす」",
  regulated: "regulate「規制する、調整する」",
  imposed: "impose「を課す，負わせる」",
  proposed: "propose「を提案する，申し出る」",
  caused: "cause「原因/の原因となる」",
  encouraged: "encourage「を勇気づける，励ます」",
  implied: "imply「をほのめかす」",
  participated: "participate「参加する」",
  anticipated: "anticipate「期待する」",
  embarked: "embark「乗船する、（事業に）乗り出す」",
  fastened: "fasten「留める、締める」"
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

const words = new Set(arr.map(w => String(w.word).trim().toLowerCase()));
const missingBase: string[] = [];
for (const [form, note] of Object.entries(REMOVE)) {
  const base = note.split("「")[0];
  if (!words.has(base.toLowerCase())) missingBase.push(`${form} の基本形 ${base} が収録されていない`);
}
if (missingBase.length > 0) {
  // 基本形が無いのに活用形だけ消すと、その語を学ぶ手段が無くなる
  throw new Error("基本形が見つかりません:\n  " + missingBase.join("\n  "));
}

const before = arr.length;
const kept = arr.filter(w => !(String(w.word).trim().toLowerCase() in REMOVE));

fs.writeFileSync(file, src.slice(0, arrStart) + JSON.stringify(kept) + src.slice(arrEnd + 1));
console.log(`基本形と重複する活用形を削除: ${before - kept.length}語`);
console.log(`収録語数: ${before} → ${kept.length}`);
for (const [form, note] of Object.entries(REMOVE)) console.log(`  ${form.padEnd(14)} → ${note} に集約`);
