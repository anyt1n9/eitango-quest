import fs from "fs";
import path from "path";

/**
 * 長文に「どの文法が出てくるか」の印を付ける（src/data/passages.ts の grammarFocus）。
 *
 * 文法ガイドを読んでも、実際の英文の中で見つけられなければ身に付かない。
 * 逆に長文を読んでいて詰まったとき、どの文法を復習すればよいかが分かるとよい。
 * その行き来のために、本文を目印で走査して文法項目と結び付ける。
 *
 * 割り当ては目視ではなく機械的に行う。人が読んで決めると
 * 「そう見えるから」で入ってしまい、後から確かめられなくなるため。
 * 目印はどれも「その構文でしか現れない形」に絞ってあり、
 * tests/passages.data.test.ts で本文に実際に出てくることを検査している。
 *
 * 実行: npx tsx scripts/tag_passage_grammar.ts
 */

/** 不規則動詞の過去分詞のうち、-ed で終わらないもの（完了形・受動態の目印に使う） */
const IRREGULAR_PP = [
  "been", "become", "begun", "broken", "brought", "built", "bought", "caught", "chosen",
  "come", "done", "drawn", "driven", "eaten", "fallen", "felt", "found", "forgotten",
  "given", "gone", "grown", "heard", "held", "kept", "known", "laid", "led", "left",
  "lost", "made", "meant", "met", "paid", "put", "read", "run", "said", "seen", "sent",
  "shown", "sold", "spoken", "spent", "stood", "taken", "taught", "told", "thought",
  "understood", "won", "worn", "written"
];
const PP = `(?:\\w+ed|${IRREGULAR_PP.join("|")})`;

/** 動名詞だけをとる動詞。不定詞との使い分けの目印 */
const GERUND_VERBS = "enjoy|enjoys|enjoyed|finish|finishes|finished|stop|stops|stopped|avoid|avoids|avoided|mind|minds|minded|keep|keeps|kept|practice|practices|practiced|admit|admits|admitted|imagine|imagines|imagined|suggest|suggests|suggested";

/**
 * 文法項目ごとの目印。
 * どれも「その構文でしか出てこない形」に絞る。
 * 過去形のようにどの英文にも現れるものは目印にしない
 * （すべての長文に印が付いてしまい、手がかりにならないため）。
 *
 * 並びは「珍しい構文が先」。上限まで取ったときに、
 * どの長文にもある受動態や関係代名詞ではなく、
 * 仮定法や倒置のような目立つ構文が残るようにする。
 */
export const GRAMMAR_MARKERS: { topic: string; pattern: RegExp }[] = [
  { topic: "g_emphasis_inversion", pattern: /\b[Ii]t\s+(?:was|is)\s+[^.]{3,40}\s+that\s+\w+|(?:^|[.!?]\s+)(?:Never|Little|Not only|Rarely|Hardly|Seldom)\b/m },
  { topic: "g_subjunctive", pattern: /\bif\s+[^.,;]{3,40},?\s*(?:\w+\s+){0,3}(?:would|could|might)\b|\bI\s+wish\b|\bas\s+if\b/i },
  { topic: "g_modal_perfect", pattern: new RegExp(`\\b(?:must|may|might|could|should|would|cannot|can't)\\s+have\\s+${PP}\\b`, "i") },
  { topic: "g_causative", pattern: /\b(?:made|makes|make|let|lets|had|has|have)\s+(?:me|him|her|us|them)\s+[a-z]+\b|\b(?:saw|heard|watched|felt)\s+(?:me|him|her|us|them|\w+)\s+\w+ing\b/i },
  { topic: "g_participle_construction", pattern: /(?:^|[.!?]\s+)(?:Not\s+)?\w+ing\b[^.!?]{5,60},/m },
  { topic: "g_relative_adverb", pattern: /\b(?:place|town|city|room|house|day|time|year|moment|reason)\s+(?:where|when|why)\s+\w+|\b(?:in|at|on|to|for|with|from|by)\s+which\b/i },
  { topic: "g_gerund", pattern: new RegExp(`\\b(?:${GERUND_VERBS})\\s+\\w+ing\\b`, "i") },
  { topic: "g_reported_speech", pattern: /\b(?:told|asked)\s+(?:me|him|her|us|them|\w+)\s+(?:that|to|if|whether|how|what|where|why)\b|\bsaid\s+that\b/i },
  { topic: "g_perfect_others", pattern: new RegExp(`\\bhad\\s+(?:just\\s+|already\\s+|never\\s+)?${PP}\\b|\\bwill\\s+have\\s+${PP}\\b`, "i") },
  { topic: "g_present_perfect", pattern: new RegExp(`\\b(?:have|has)\\s+(?:just\\s+|already\\s+|never\\s+|ever\\s+)?${PP}\\b`, "i") },
  { topic: "g_comparison", pattern: /\b(?:more|less)\s+\w+\s+than\b|\b\w+er\s+than\b|\bas\s+\w+\s+as\b|\bthe\s+(?:most|least)\s+\w+\b|\bthe\s+\w+est\b/i },
  { topic: "g_noun_clause", pattern: /\b(?:think|thought|know|knew|believe|believed|realize|realized|hope|hoped|say|says|found|noticed)\s+(?:that\s+)?(?:he|she|it|they|we|I|the)\b/i },
  { topic: "g_relative_pronoun", pattern: /\b(?:who|whom|whose)\s+\w+|\b\w+,\s+which\s+\w+|\bthings?\s+(?:that|which)\s+\w+/i },
  { topic: "g_passive", pattern: new RegExp(`\\b(?:is|are|was|were|been|being)\\s+(?:not\\s+|already\\s+|still\\s+)?${PP}\\b(?:\\s+by\\b)?`, "i") },
  { topic: "g_infinitive", pattern: /\bin\s+order\s+to\s+\w+|\b(?:decided|wanted|hoped|promised|refused|planned|expected|tried|began|started|agreed)\s+to\s+\w+/i }
];

/** 1つの長文に付ける印の上限。多すぎると手がかりにならない */
const MAX_FOCUS = 4;

/** 本文から、出てくる文法項目のIDを取り出す */
export function detectGrammar(englishParagraphs: string[]): string[] {
  const text = englishParagraphs.join("\n");
  return GRAMMAR_MARKERS
    .filter(m => m.pattern.test(text))
    .map(m => m.topic)
    .slice(0, MAX_FOCUS);
}

function main() {
  const file = path.join(process.cwd(), "src/data/passages.ts");
  const src = fs.readFileSync(file, "utf8");
  const marker = "export const passages: Passage[] = ";
  const arrStart = src.indexOf("[", src.indexOf(marker) + marker.length);
  let depth = 0, inStr = false, quote = "", esc = false, arrEnd = -1;
  for (let i = arrStart; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (inStr) { if (c === "\\") esc = true; else if (c === quote) inStr = false; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = true; quote = c; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { arrEnd = i; break; } }
  }

  // TypeScript の配列リテラルをそのまま評価するのは避け、
  // すでに読み込める形（JSON互換）に整形されている前提で eval せずに扱う。
  // ここでは既存の各要素へ grammarFocus を差し込むため、本文だけを抜き出して判定する。
  const body = src.slice(arrStart, arrEnd + 1);

  // 各長文の englishParagraphs を取り出す
  const entries: { id: string; paragraphs: string[]; focus: string[] }[] = [];
  const idRe = /id:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  const positions: { id: string; index: number }[] = [];
  while ((m = idRe.exec(body)) !== null) positions.push({ id: m[1], index: m.index });

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = i + 1 < positions.length ? positions[i + 1].index : body.length;
    const chunk = body.slice(start, end);
    const epStart = chunk.indexOf("englishParagraphs:");
    if (epStart < 0) continue;
    const open = chunk.indexOf("[", epStart);
    let d = 0, str = false, q = "", e = false, close = -1;
    for (let j = open; j < chunk.length; j++) {
      const c = chunk[j];
      if (e) { e = false; continue; }
      if (str) { if (c === "\\") e = true; else if (c === q) str = false; continue; }
      if (c === '"' || c === "'" || c === "`") { str = true; q = c; continue; }
      if (c === "[") d++;
      else if (c === "]") { d--; if (d === 0) { close = j; break; } }
    }
    const paragraphs: string[] = JSON.parse(chunk.slice(open, close + 1));
    entries.push({ id: positions[i].id, paragraphs, focus: detectGrammar(paragraphs) });
  }

  // grammarFocus を各長文に書き込む（既にあれば置きかえる）
  let out = src;
  for (const entry of entries) {
    const idAt = out.indexOf(`id: "${entry.id}"`);
    if (idAt < 0) continue;
    const focusLine = `\n    grammarFocus: ${JSON.stringify(entry.focus)},`;
    const existing = new RegExp(`\\n\\s*grammarFocus: \\[[^\\]]*\\],`);
    const nextIdAt = out.indexOf('id: "', idAt + 5);
    const region = out.slice(idAt, nextIdAt < 0 ? out.length : nextIdAt);
    if (existing.test(region)) {
      out = out.slice(0, idAt) + region.replace(existing, focusLine) + out.slice(idAt + region.length);
    } else {
      const insertAt = idAt + `id: "${entry.id}",`.length;
      out = out.slice(0, insertAt) + focusLine + out.slice(insertAt);
    }
  }
  fs.writeFileSync(file, out);

  console.log(`長文 ${entries.length} 本に文法の印を付けました`);
  const counts: Record<string, number> = {};
  for (const e of entries) {
    for (const f of e.focus) counts[f] = (counts[f] || 0) + 1;
    console.log(`  ${e.id.padEnd(4)} ${e.focus.join(", ")}`);
  }
  console.log("項目別の本数:", counts);
  const none = entries.filter(e => e.focus.length === 0).map(e => e.id);
  if (none.length) console.warn("印が付かなかった長文:", none.join(", "));
}

if (process.argv[1] && process.argv[1].includes("tag_passage_grammar")) main();
