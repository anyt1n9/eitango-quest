/**
 * 露骨な性的表現・罵倒語・差別語をデータから取り除く。
 * 何を出さないかの決まりは src/offensiveTerms.ts にある。
 *
 * 見出し語を外すだけでは足りない。外した語は他の語からも参照されている。
 *   - 他の語の四択の誤答（訳）と、例文穴埋めの誤答（英単語）
 *   - 類義語クイズの正解・誤答（ID）
 *   - 語義（senses.ts）と語法（wordUsage.ts）の、その語のぶん
 * 参照が残ると、消したはずの訳が誤答として出続ける。
 *
 * 誤答は「その1つだけ」を入れ替える。四択ごと作り直すと、例文に合わせて選んだ誤答
 * （scripts/apply_sentences.ts）まで入れ替わり、誤答でも文が成り立つ設問に戻りうる。
 *
 * 何度回しても同じ結果になる（乱数は固定の種から作る）。
 *
 * 実行: npx tsx scripts/remove_offensive.ts
 * 類義語の誤答の選び直しに .cache/ の WordNet を使う（scripts/bake_senses.ts が用意する）。
 */
import * as fs from "fs";
import * as path from "path";
import { pickDistractors, Candidate } from "../src/distractors";
import { readVocabularyFile, writeVocabularyFile, VOCABULARY_FILE } from "./vocabularyFile";
import { REMOVED_HEADWORDS, OFFENSIVE_EN, cleanSenseMeaning, isOffensiveEntry } from "../src/offensiveTerms";
import { seeded, LEVEL_ORDER, relatedLemmas, translationsOverlap } from "./bake_synonyms";
import { loadWordNet } from "./wordnetIndex";

const log: string[] = [];

/** 生成された .ts の `export const 名前: 型 = {...};` の中身を読み書きする */
function readTable(file: string, name: string): { source: string; start: number; end: number; table: Record<string, any> } {
  const source = fs.readFileSync(file, "utf8");
  const decl = source.indexOf(`export const ${name}`);
  if (decl < 0) throw new Error(`${file} に ${name} がありません`);
  const start = source.indexOf("= ", decl) + 2;
  const end = source.lastIndexOf(";");
  return { source, start, end, table: JSON.parse(source.slice(start, end)) };
}
function writeTable(file: string, t: { source: string; start: number; end: number }, table: unknown) {
  fs.writeFileSync(file, t.source.slice(0, t.start) + JSON.stringify(table) + t.source.slice(t.end), "utf8");
}

// --- 1. 見出し語 -------------------------------------------------------------
const { source, words } = readVocabularyFile(VOCABULARY_FILE);
const removed = words.filter(w => String(w.word).trim().toLowerCase() in REMOVED_HEADWORDS);
const kept = words.filter(w => !(String(w.word).trim().toLowerCase() in REMOVED_HEADWORDS));
const removedIds = new Set(removed.map(w => String(w.id)));
// 残る語と同じ訳・綴りは「消した語の参照」とは言えないので入れ替えない
const keptTranslations = new Set(kept.map(w => String(w.translation)));
const keptWords = new Set(kept.map(w => String(w.word).toLowerCase()));
const removedTranslations = new Set(removed.map(w => String(w.translation)).filter(t => !keptTranslations.has(t)));
const removedWords = new Set(removed.map(w => String(w.word).toLowerCase()).filter(w => !keptWords.has(w)));
for (const w of removed) log.push(`見出しを外す: ${w.word}「${w.translation}」（${REMOVED_HEADWORDS[String(w.word).toLowerCase()]}）`);

// --- 2. 他の語の誤答 ---------------------------------------------------------
const candidates: Candidate[] = kept.map(w => ({ word: w.word, translation: w.translation, level: w.level, pos: w.pos }));
const rand = seeded("remove_offensive");
let replacedOptions = 0;
for (const w of kept) {
  const target: Candidate = { word: w.word, translation: w.translation, level: w.level, pos: w.pos };
  const fix = (list: string[] | undefined, isRemoved: (v: string) => boolean, mode: "translation" | "word") => {
    if (!Array.isArray(list)) return;
    list.forEach((v, i) => {
      if (!isRemoved(v)) return;
      const valueOf = (c: Candidate) => (mode === "translation" ? c.translation : c.word);
      const pool = candidates.filter(c => !list.includes(valueOf(c)));
      const [pick] = pickDistractors(target, pool, 1, mode, rand);
      if (!pick) throw new Error(`${w.word}: 誤答の代わりが見つかりません`);
      list[i] = pick;
      replacedOptions++;
    });
  };
  fix(w.options, v => removedTranslations.has(v), "translation");
  fix(w.sentenceOptions, v => removedWords.has(v.toLowerCase()), "word");
}
if (removed.length > 0 || replacedOptions > 0) writeVocabularyFile(source, kept, VOCABULARY_FILE);
log.push(`他の語の誤答を入れ替え: ${replacedOptions}件`);

// --- 3. 語義 -----------------------------------------------------------------
const sensesFile = path.join(process.cwd(), "src/data/senses.ts");
const senses = readTable(sensesFile, "wordSenses");
let droppedSenses = 0, rewrittenSenses = 0, droppedUsages = 0;
for (const id of Object.keys(senses.table)) {
  if (removedIds.has(id)) { delete senses.table[id]; continue; }
  const list: any[] = senses.table[id];
  const next: any[] = [];
  for (const s of list) {
    const meaning = cleanSenseMeaning(s.meaning);
    if (meaning === null) { droppedSenses++; log.push(`語義を外す: ${kept.find(w => w.id === id)?.word}「${s.meaning}」`); continue; }
    if (meaning !== s.meaning) { rewrittenSenses++; log.push(`語義を直す: ${kept.find(w => w.id === id)?.word}「${s.meaning}」→「${meaning}」`); }
    const out = { ...s, meaning };
    if (out.usage && OFFENSIVE_EN.test(out.usage)) { delete out.usage; droppedUsages++; }
    next.push(out);
  }
  // 残った語義の割合がすべて 0% なら割合ごと落とす（bake_senses.ts の決まりと同じ）
  if (next.length > 0 && next.every(s => s.share === 0)) for (const s of next) delete s.share;
  if (next.length === 0) delete senses.table[id];
  else senses.table[id] = next;
}
writeTable(sensesFile, senses, senses.table);
log.push(`語義: 外す ${droppedSenses}件 / 言い換え ${rewrittenSenses}件 / 用例を外す ${droppedUsages}件`);

// --- 4. 語法（コロケーション・語族） ------------------------------------------
const usageFile = path.join(process.cwd(), "src/data/wordUsage.ts");
const usage = readTable(usageFile, "wordUsage");
let droppedEntries = 0;
for (const id of Object.keys(usage.table)) {
  if (removedIds.has(id)) { delete usage.table[id]; continue; }
  const u = usage.table[id];
  const word = kept.find(w => w.id === id)?.word;
  if (u.collocations) {
    u.collocations = u.collocations.filter((c: any) => {
      if (!isOffensiveEntry(c.phrase, c.meaning)) return true;
      droppedEntries++;
      log.push(`コロケーションを外す: ${word} … ${c.phrase}「${c.meaning}」`);
      return false;
    });
    if (u.collocations.length === 0) delete u.collocations;
  }
  if (u.family) {
    u.family = u.family.filter((f: any) => {
      if (!isOffensiveEntry(f.word, f.meaning)) return true;
      droppedEntries++;
      log.push(`語族を外す: ${word} … ${f.word}「${f.meaning}」`);
      return false;
    });
    if (u.family.length === 0) delete u.family;
  }
  if (Object.keys(u).length === 0) delete usage.table[id];
}
writeTable(usageFile, usage, usage.table);

// --- 5. 類義語クイズ ---------------------------------------------------------
const synonymsFile = path.join(process.cwd(), "src/data/synonyms.ts");
const synonyms = readTable(synonymsFile, "wordSynonyms");
const byId = new Map(kept.map(w => [String(w.id), w]));
let wn: ReturnType<typeof loadWordNet> | null = null;
for (const id of Object.keys(synonyms.table)) {
  const e = synonyms.table[id];
  if (removedIds.has(id)) { delete synonyms.table[id]; log.push(`類義語クイズから外す: ${id}`); continue; }
  e.same = e.same.filter((x: string) => !removedIds.has(x));
  if (e.same.length === 0) { delete synonyms.table[id]; log.push(`類義語クイズから外す（正解が無くなった）: ${byId.get(id)?.word}`); continue; }
  if (!e.distractors.some((x: string) => removedIds.has(x))) continue;

  // 誤答の選び直しは bake_synonyms.ts と同じ条件で行う
  // （出題語・正解と WordNet で1つ関係をたどった範囲に入らず、訳も重ならない同じ品詞の語）
  wn ??= loadWordNet();
  const w = byId.get(id)!;
  const group = [w, ...e.same.map((x: string) => byId.get(x)!)];
  const banned = new Set<string>();
  for (const g of group) relatedLemmas(wn, String(g.word)).forEach(l => banned.add(l));
  const r = seeded(`${id}:remove_offensive`);
  e.distractors = e.distractors.map((d: string) => {
    if (!removedIds.has(d)) return d;
    const others = e.distractors.filter((x: string) => x !== d && !removedIds.has(x)).map((x: string) => byId.get(x)!);
    const pool = kept.filter(c =>
      c.pos === w.pos
      && /^[a-z]+(-[a-z]+)?$/.test(String(c.word))
      && !banned.has(c.word)
      && !group.some(g => g.word.includes(c.word) || c.word.includes(g.word))
      && !group.some(g => translationsOverlap(g.translation, c.translation))
      && !others.some(o => o.id === c.id || translationsOverlap(o.translation, c.translation))
    );
    const level = LEVEL_ORDER.indexOf(w.level);
    for (const distance of [0, 1, 2, 3, 4]) {
      const ring = pool.filter(c => Math.abs(LEVEL_ORDER.indexOf(c.level) - level) === distance);
      if (ring.length === 0) continue;
      const pick = ring[Math.floor(r() * ring.length)];
      log.push(`類義語クイズの誤答を入れ替え: ${w.word} … ${d} → ${pick.word}`);
      return String(pick.id);
    }
    throw new Error(`${w.word}: 類義語クイズの誤答の代わりが見つかりません`);
  });
}
writeTable(synonymsFile, synonyms, synonyms.table);

console.log(log.join("\n"));
