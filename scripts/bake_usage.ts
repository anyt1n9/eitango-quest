import fs from "fs";
import path from "path";
import { PartOfSpeech } from "../src/types";

/**
 * 語法・コロケーション・語族データを焼き込む（src/data/wordUsage.ts を生成）。
 *
 * この教材には「1語 = 1つの訳語」しか無く、次のどれも分からなかった。
 *   - その動詞がどんな形をとるか（他動詞か、to不定詞をとるか、SVOOになるか）
 *   - その語がどんな語と組んで使われるか（gas station / weather forecast）
 *   - その語と語源を同じくする語（decide → decision → decisive）
 * 訳語だけを覚えても英文が組み立てられないのは、この3つが欠けているため。
 *
 * 出典はすべて WordNet 3.0（`.cache/data.*`）。
 *   - 語法: 動詞の synset が持つ文型番号（sentence frame）。1〜35 の決まった型で、
 *           日本語のラベルは src/usage.ts に置く（データを小さく保つため番号だけ焼く）。
 *   - コロケーション: WordNet に見出しとして載っている複合語のうち、
 *           EJDict に和訳があるものだけ。和訳の付かない英語だけの句は出さない。
 *   - 語族: 派生関係のポインタ（`+`）。EJDict に見出しがある語だけ採る。
 *
 * 実行: npx tsx scripts/bake_usage.ts
 * 取得済みのファイルは .cache/ に置かれる（bake_senses.ts と共用）。
 */

const CACHE_DIR = path.join(process.cwd(), ".cache");
const EJDICT_BASE = "https://raw.githubusercontent.com/kujirahand/EJDict/master/src";

/** 1語あたりの上限。多すぎると読む気が失せるので絞る */
const MAX_FAMILY = 5;
const MAX_COLLOCATIONS = 6;
const MAX_PATTERNS = 12;

interface Synset {
  words: string[];
  /** 派生関係(`+`)のポインタだけを持つ */
  derived: { off: string; pos: string; src: number; tgt: number }[];
  frames: number[];
}

/** WordNet の data.* を読み、synset を `品詞:オフセット` で引けるようにする */
function loadSynsets(): Map<string, Synset> {
  const out = new Map<string, Synset>();
  for (const file of ["noun", "verb", "adj", "adv"] as const) {
    const p = path.join(CACHE_DIR, `data.${file}`);
    if (!fs.existsSync(p)) {
      throw new Error(`${p} がありません。scripts/bake_senses.ts と同じ手順で WordNet を展開してください`);
    }
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      // 先頭が空白2つの行はライセンス文
      if (!line || line.startsWith("  ")) continue;
      const head = line.split(" | ")[0].trim().split(/\s+/);
      const offset = head[0];
      const ssType = head[2] === "s" ? "a" : head[2];   // s(サテライト形容詞)は a に寄せる
      const wordCount = parseInt(head[3], 16);
      const words: string[] = [];
      let i = 4;
      for (let k = 0; k < wordCount; k++) { words.push(head[i]); i += 2; }

      const ptrCount = Number(head[i++]);
      const derived: Synset["derived"] = [];
      for (let k = 0; k < ptrCount; k++) {
        const sym = head[i], off = head[i + 1], pos = head[i + 2], st = head[i + 3];
        // `+` は「派生的に関係のある語形」（decide ↔ decision）
        if (sym === "+") {
          derived.push({ off, pos, src: parseInt(st.slice(0, 2), 16), tgt: parseInt(st.slice(2), 16) });
        }
        i += 4;
      }

      const frames: number[] = [];
      if (head[2] === "v") {
        const frameCount = Number(head[i++]);
        // 各文型は「+ 番号 語番号」の3つ組。語番号00はその synset のすべての語に掛かる
        for (let k = 0; k < frameCount; k++) { i++; frames.push(Number(head[i])); i += 2; }
      }

      out.set(`${ssType}:${offset}`, { words, derived, frames });
    }
  }
  return out;
}

/** 見出し語（小文字・複合語は空白区切り）から synset キーを引く索引 */
function buildIndex(synsets: Map<string, Synset>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [key, s] of synsets) {
    for (const w of s.words) {
      const lemma = w.toLowerCase().replace(/_/g, " ");
      const arr = index.get(lemma);
      if (arr) arr.push(key); else index.set(lemma, [key]);
    }
  }
  return index;
}

/** EJDict を読む（bake_senses.ts と同じ取得先。キャッシュを共用する） */
async function loadEjdict(): Promise<Map<string, string>> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const dict = new Map<string, string>();
  for (const c of "abcdefghijklmnopqrstuvwxyz") {
    const cached = path.join(CACHE_DIR, `ejdict-${c}.txt`);
    if (!fs.existsSync(cached)) {
      const res = await fetch(`${EJDICT_BASE}/${c}.txt`);
      if (!res.ok) throw new Error(`EJDict ${c}.txt の取得に失敗しました (HTTP ${res.status})`);
      fs.writeFileSync(cached, await res.text());
    }
    for (const line of fs.readFileSync(cached, "utf8").split("\n")) {
      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      const key = line.slice(0, tab).trim().toLowerCase();
      const body = line.slice(tab + 1).trim();
      if (key && body && !dict.has(key)) dict.set(key, body);
    }
  }
  return dict;
}

const POS_OF_LETTER: Record<string, PartOfSpeech> = {
  n: "noun", v: "verb", a: "adjective", r: "adverb"
};

/**
 * EJDict の語義本文から、短い見出し用の訳を1つ取り出す。
 * 画面では語族の横に添えるだけなので、最初の語義を切り詰めて使う。
 */
export function shortGloss(body: string, max = 14): string {
  const raw = body.split(" / ")[0].trim();
  // 「=sheepdog」のように別の見出しを指しているだけの項目は訳ではない
  if (/^=/.test(raw)) return "";
  const first = raw
    .replace(/《[^》]*》/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/〈[CU]〉/g, "")                 // 可算・不可算の印
    .replace(/〈[^〉]*〉/g, "…")             // 目的語の指定（〈人〉を罰する → …を罰する）
    .replace(/[『』]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[;,、，･・=\s]+|[;,、，･・\s]+$/g, "")
    .trim();
  // 「,」で区切られた最初の1つだけにする（「美しい,きれいな」→「美しい」）
  const head = first.split(/[,、，;；]/)[0].trim();
  if (!head || head.includes("=")) return "";
  // 括弧の対応が崩れている項目（「回る《(also go round)+名》」など）は
  // 整形しても読める形にならないので使わない
  if (/[『』《》〈〉[\]()（）]/.test(head)) return "";
  const cut = head.length > max ? head.slice(0, max) + "…" : head;
  // 日本語が残っているかは切り詰めたあとで見る。
  // 「Strategic Arms Limitation Talks 戦略兵器制限交渉」のように
  // 先頭が英語だと、切り詰めた結果から日本語が消えることがある
  return /[ぁ-んァ-ヶ一-鿿]/.test(cut) ? cut : "";
}

/**
 * その語の派生語（語族）かどうかを判断する。
 *
 * WordNet の派生ポインタは gerund（remembering）や動作主名詞（vacationist）まで拾う。
 * 綴りを足しただけの形は「別の語を覚えた」ことにならないので落とす。
 */
export function isUsefulRelative(word: string, relative: string): boolean {
  const w = word.toLowerCase(), r = relative.toLowerCase();
  if (r === w || r.includes(" ") || r.length < 3) return false;
  // 単なる活用形（-s / -ing / -ed）は語族ではない
  for (const suffix of ["s", "es", "ing", "ed", "d"]) {
    if (r === w + suffix) return false;
  }
  // 語末の e を落としてからの -ing / -ed（make → making）
  if (/e$/.test(w) && (r === w.slice(0, -1) + "ing" || r === w.slice(0, -1) + "ed")) return false;
  // 共通する語頭が3文字未満なら、たまたま関係が張られただけとみなす
  let i = 0;
  while (i < w.length && i < r.length && w[i] === r[i]) i++;
  return i >= 3;
}

async function main() {
  console.log("WordNet を読み込んでいます…");
  const synsets = loadSynsets();
  const index = buildIndex(synsets);
  const dict = await loadEjdict();
  console.log(`synset: ${synsets.size} / 見出し: ${index.size} / EJDict: ${dict.size}`);

  // 複合語を構成語から引けるようにする（station → gas station, fire station …）
  const compoundsByPart = new Map<string, string[]>();
  for (const lemma of index.keys()) {
    if (!lemma.includes(" ")) continue;
    for (const part of lemma.split(" ")) {
      const arr = compoundsByPart.get(part);
      if (arr) arr.push(lemma); else compoundsByPart.set(part, [lemma]);
    }
  }

  const vocabFile = path.join(process.cwd(), "src/data/vocabulary.ts");
  const src = fs.readFileSync(vocabFile, "utf8");
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
  const vocab: any[] = JSON.parse(src.slice(arrStart, arrEnd + 1));

  const table: Record<string, any> = {};
  let withFamily = 0, withPatterns = 0, withCollocations = 0;

  for (const w of vocab) {
    const lemma = String(w.word).trim().toLowerCase();
    const keys = index.get(lemma) || [];
    if (keys.length === 0) continue;
    const entry: any = {};

    // --- 語族 -------------------------------------------------------------
    const family: { word: string; meaning: string; pos: PartOfSpeech }[] = [];
    const seenRel = new Set<string>();
    for (const key of keys) {
      const s = synsets.get(key)!;
      // 派生ポインタは「この synset の何番目の語から」という指定を持つ
      const myIdx = s.words.findIndex(x => x.toLowerCase().replace(/_/g, " ") === lemma) + 1;
      for (const p of s.derived) {
        if (p.src !== 0 && p.src !== myIdx) continue;
        const target = synsets.get(`${p.pos === "s" ? "a" : p.pos}:${p.off}`);
        if (!target) continue;
        const words = p.tgt === 0 ? target.words : [target.words[p.tgt - 1]];
        for (const tw of words) {
          if (!tw) continue;
          const rel = tw.toLowerCase().replace(/_/g, " ");
          if (seenRel.has(rel) || !isUsefulRelative(lemma, rel)) continue;
          const body = dict.get(rel);
          if (!body) continue;                       // 訳が付けられない語は出さない
          const meaning = shortGloss(body);
          if (!meaning) continue;
          seenRel.add(rel);
          family.push({ word: rel, meaning, pos: POS_OF_LETTER[p.pos === "s" ? "a" : p.pos] || "other" });
        }
      }
    }
    if (family.length > 0) {
      // 品詞がばらけるほど語族として役に立つので、品詞を巡回しながら詰める
      const byPos = new Map<string, typeof family>();
      for (const f of family) {
        const g = byPos.get(f.pos) || [];
        g.push(f);
        byPos.set(f.pos, g);
      }
      const picked: typeof family = [];
      for (let round = 0; picked.length < MAX_FAMILY; round++) {
        let added = false;
        for (const g of byPos.values()) {
          if (round < g.length && picked.length < MAX_FAMILY) { picked.push(g[round]); added = true; }
        }
        if (!added) break;
      }
      entry.family = picked;
      withFamily++;
    }

    // --- 動詞の文型 -------------------------------------------------------
    // 教材が動詞として教えている語だけ。名詞の medicine に「動詞の語法」を出すと邪魔になる
    if (w.pos === "verb") {
      const frames = new Set<number>();
      for (const key of keys) {
        if (!key.startsWith("v:")) continue;
        for (const f of synsets.get(key)!.frames) frames.add(f);
      }
      if (frames.size > 0) {
        entry.patterns = [...frames].sort((a, b) => a - b).slice(0, MAX_PATTERNS);
        withPatterns++;
      }
    }

    // --- コロケーション ---------------------------------------------------
    const collocations: { phrase: string; meaning: string }[] = [];
    for (const phrase of compoundsByPart.get(lemma) || []) {
      const body = dict.get(phrase);
      if (!body) continue;                           // 和訳の無い句は出さない
      const meaning = shortGloss(body, 20);
      if (!meaning) continue;
      collocations.push({ phrase, meaning });
      if (collocations.length >= MAX_COLLOCATIONS) break;
    }
    if (collocations.length > 0) {
      entry.collocations = collocations;
      withCollocations++;
    }

    if (Object.keys(entry).length > 0) table[w.id] = entry;
  }

  const out = `import { WordUsage } from "../types";

/**
 * 単語ごとの語法・コロケーション・語族。scripts/bake_usage.ts が生成する。
 *
 * 語義(senses.ts)と同じく、使うのは辞書画面だけで起動時には要らないため
 * 単語データとは分けてある。利用側は src/usage.ts の loadUsage() を使う。
 *
 * 出典:
 *   - 文型(patterns): WordNet 3.0 の動詞 sentence frame（番号の意味は src/usage.ts）
 *   - コロケーション: WordNet の複合語見出しのうち EJDict に和訳があるもの
 *   - 語族(family): WordNet の派生関係ポインタ
 */
export const wordUsage: Record<string, WordUsage> = ${JSON.stringify(table)};
`;
  fs.writeFileSync(path.join(process.cwd(), "src/data/wordUsage.ts"), out);

  const kb = Math.round(fs.statSync(path.join(process.cwd(), "src/data/wordUsage.ts")).size / 1024);
  console.log(`語法データを付けた語: ${Object.keys(table).length} / ${vocab.length}`);
  console.log(`  語族: ${withFamily}語`);
  console.log(`  動詞の文型: ${withPatterns}語`);
  console.log(`  コロケーション: ${withCollocations}語`);
  console.log(`src/data/wordUsage.ts: ${kb} KB`);
}

if (process.argv[1] && process.argv[1].includes("bake_usage")) main();
