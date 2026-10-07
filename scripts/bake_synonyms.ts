import * as fs from "fs";
import * as path from "path";
import { readVocabularyFile, VOCABULARY_FILE } from "./vocabularyFile";
import { loadWordNet, WordNet } from "./wordnetIndex";

/**
 * 類義語クイズのデータを焼き込む（src/data/synonyms.ts を生成）。
 *
 * 「big と同じ意味の語は？ → large」のように、収録語どうしの同義の組を作る。
 * 組にするのは次の2つを**両方**満たすものだけ。
 *
 *   1. WordNet で同じ語義(synset)に入っている（同じ品詞で）
 *   2. 教材の訳が重なり、しかも重なった訳がどちらかの**第一の訳**である
 *
 * 1 だけだと、book と reserve（予約する）のように教材が教えていない語義で組になる。
 * 2 だけだと、「見る」を共有する see / watch / look のような、日本語では同じでも
 * 英語では使い分ける語が組になる。両方を見ると、教材の訳どうしが同じ意味を
 * 指していることを辞書で裏付けられる。
 * 「第一の訳」に限るのは、foundation（土台，根拠，設立）と institution（制度，設立）が
 * 3番目の訳「設立」だけで組になるのを避けるため。
 *
 * 誤答は同じ品詞の収録語から選ぶ。正解以外にも「同じ意味」と言えてしまう語が
 * 混ざると、正解が2つある設問になる。そのため次の語は誤答にしない。
 *   - 出題語・正解のどちらかと同じ synset に入る語、そこから1つ関係をたどった語
 *     （上位語・下位語・類似など。反意語だけは混ぜてよい。big に small は紛らわしくない）
 *   - 出題語・正解のどちらかと訳が重なる語（漢字・カタカナの2文字が共通するものも含む）
 *
 * 生成した組は1つずつ目で確かめ、外れは EXCLUDED_PAIRS に理由を添えて落とす
 * （fix_levels.ts の LEVEL_FIXES と同じやり方）。
 *
 *   npx tsx scripts/bake_synonyms.ts
 */

type Pos = "noun" | "verb" | "adjective" | "adverb";

/**
 * 辞書と訳の両方で組になるが、学習者に「同じ意味」として見せるには外れている組。
 * キーは "語|語"（アルファベット順）。
 */
export const EXCLUDED_PAIRS: Record<string, string> = {
  // 答えの語の「第一の訳」が別の意味。辞書の上では同義でも、学習者には別の語に見える
  "heap|mountain": "教材の mountain は地形の山。heap の『山』は積み重なったものを指す",
  "construction|structure": "construction の第一の訳は『建設』（行為）。structure は『構造』",
  "construct|fabricate": "fabricate の第一の訳は『でっち上げる』",
  "drag|draw": "draw の第一の訳は『描く』。引きずる drag と同じ意味として出すには遠い",
  "commitment|consignment": "commitment の第一の訳は『約束』。委託の意味では教えていない",
  "constitution|organization": "constitution の第一の訳は『憲法』",
  "composition|constitution": "constitution の第一の訳は『憲法』",
  "beguile|fascinate": "beguile の第一の訳は『騙す』",
  "minister|pastor": "minister の第一の訳は『大臣』",
  "establishment|institution": "institution の第一の訳は『制度』",
  "bureau|chest": "bureau の第一の訳は『事務局』",
  "prey|quarry": "quarry の第一の訳は『採石場』",
  "flesh|pulp": "flesh の第一の訳は『肉』",
  "chemist|pharmacist": "chemist の第一の訳は『化学者』。薬剤師の意味はイギリス英語",
  "blot|spot": "spot の第一の訳は『場所』",
  "spot|stain": "spot の第一の訳は『場所』",
  "brighten|lighten": "lighten の第一の訳は『軽くする』",
  "embody|substantiate": "substantiate の第一の訳は『実証する』。embody（体現する）とは使い方が違う",
  "moribund|stagnant": "moribund の第一の訳は『瀕死の』",
  "give|render": "render の第一の訳は『（ある状態に）する』",
  "bar|saloon": "bar の第一の訳は『棒』",
  "cinema|film": "cinema の第一の訳は『映画館』",
  "plan|program": "program の第一の訳は『番組』",
  "server|waiter": "server の第一の訳は『（コンピューターの）サーバー』",
  "handbag|purse": "purse の第一の訳は『財布』。ハンドバッグの意味はアメリカ英語",
  "celebrity|fame": "celebrity の第一の訳は『有名人』（人）。fame は『名声』",
  "celebrity|renown": "celebrity の第一の訳は『有名人』（人）。renown は『名声』",

  // 訳は重なるが、英語では置き換えられない（使い分けを問われる）組
  "still|yet": "yet は否定文・疑問文、still は肯定文で使い分ける。同じ意味として覚えると誤用につながる",
  "possible|potential": "possible は『あり得る』、potential は『潜在的な』で、置き換えられない",
  "certify|demonstrate": "certify は『（公式に）証明する』で、demonstrate の『実証する』とは使い方が違う",
  "atypical|irregular": "atypical は『典型的でない』。irregular の『不規則な』とは使い方が違う",
  "bunch|gang": "gang は不良の集団を指し、bunch（房・束・一団）とは使い方が違う",
  "evoke|invoke": "invoke と evoke は混同しやすい別の語。invoke の第一の訳は『発動する』"
};

/** 訳を語に分ける。かっこ書きの補足と「〜」を落とし、品詞の区切り「/」より前だけを使う */
export function translationTokens(translation: string): string[] {
  const main = String(translation).split(/[\/／]/)[0];
  return main
    .replace(/[（(〈《{［\[][^）)〉》}］\]]*[）)〉》}］\]]/g, "")
    // 「〜」は全角の「～」で書かれている訳もある（きっと～する）
    .replace(/[〜～~…]/g, "")
    .split(/[、,，;；・]/)
    .map(s => s.trim().replace(/^を/, ""))
    .filter(s => s.length > 0);
}

/** 漢字・カタカナの2文字の並び。訳の一部が重なる語（重要な／重要性）を拾うため */
export function kanjiBigrams(translation: string): Set<string> {
  const s = String(translation).replace(/[（(〈《][^）)〉》]*[）)〉》]/g, "");
  const out = new Set<string>();
  for (let i = 0; i + 1 < s.length; i++) {
    const g = s.slice(i, i + 2);
    if (/^[一-鿿゠-ヿ]{2}$/.test(g)) out.add(g);
  }
  return out;
}

/** 2つの訳が重なるか（語として一致する・一方が他方を含む・漢字2文字が共通する） */
export function translationsOverlap(a: string, b: string): boolean {
  const ta = translationTokens(a);
  const tb = translationTokens(b);
  if (ta.some(x => tb.some(y => x === y || (x.length >= 2 && y.includes(x)) || (y.length >= 2 && x.includes(y))))) {
    return true;
  }
  const ga = kanjiBigrams(a);
  for (const g of kanjiBigrams(b)) if (ga.has(g)) return true;
  return false;
}

/** 同じ順序で再現できる乱数（語のIDから作る）。回すたびに誤答が変わらないように */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const LEVEL_ORDER = ["junior", "senior", "senior2", "senior3", "advanced"];

interface V {
  id: string;
  word: string;
  translation: string;
  level: string;
  pos: Pos;
}

/** その語が入っている synset と、そこから1つ関係をたどった synset に出てくる見出し */
function relatedLemmas(wn: WordNet, lemma: string): Set<string> {
  const out = new Set<string>([lemma]);
  for (const pos of ["noun", "verb", "adjective", "adverb"]) {
    for (const key of wn.index.get(`${lemma}|${pos}`) || []) {
      const s = wn.synsets.get(key);
      if (!s) continue;
      s.lemmas.forEach(l => out.add(l));
      for (const p of s.pointers) {
        if (p.symbol === "!") continue;
        wn.synsets.get(p.target)?.lemmas.forEach(l => out.add(l));
      }
    }
  }
  return out;
}

export function main() {
  const wn = loadWordNet();
  const { words } = readVocabularyFile(VOCABULARY_FILE);
  const vocab: V[] = words
    .filter(w => /^[a-z]+(-[a-z]+)?$/.test(String(w.word))
      && ["noun", "verb", "adjective", "adverb"].includes(String(w.pos)))
    .map(w => ({ id: String(w.id), word: String(w.word), translation: String(w.translation), level: String(w.level), pos: w.pos as Pos }));

  const byWordPos = new Map<string, V[]>();
  for (const v of vocab) {
    const k = `${v.word}|${v.pos}`;
    if (!byWordPos.has(k)) byWordPos.set(k, []);
    byWordPos.get(k)!.push(v);
  }

  // 1. 同義の組
  const same = new Map<string, Set<string>>();
  const byId = new Map(vocab.map(v => [v.id, v]));
  const excludedSeen = new Set<string>();
  for (const w of vocab) {
    const candidates = new Set<string>();
    for (const key of wn.index.get(`${w.word}|${w.pos}`) || []) {
      for (const l of wn.synsets.get(key)?.lemmas || []) if (l !== w.word) candidates.add(l);
    }
    for (const c of candidates) {
      for (const v of byWordPos.get(`${c}|${w.pos}`) || []) {
        if (v.id === w.id) continue;
        // 綴りが含まれる組（phone / telephone、lunch / luncheon）は綴りで当たってしまう
        if (w.word.includes(v.word) || v.word.includes(w.word)) continue;
        const tw = translationTokens(w.translation);
        const tv = translationTokens(v.translation);
        const shared = tw.filter(t => tv.includes(t));
        if (!shared.some(t => t === tw[0] || t === tv[0])) continue;
        const pairKey = [w.word, v.word].sort().join("|");
        if (pairKey in EXCLUDED_PAIRS) { excludedSeen.add(pairKey); continue; }
        if (!same.has(w.id)) same.set(w.id, new Set());
        same.get(w.id)!.add(v.id);
      }
    }
  }

  const stale = Object.keys(EXCLUDED_PAIRS).filter(k => !excludedSeen.has(k));
  if (stale.length > 0) {
    throw new Error(`EXCLUDED_PAIRS に、もう組にならない項目があります: ${stale.join(", ")}`);
  }

  // 2. 誤答
  const related = new Map<string, Set<string>>();
  const relatedOf = (lemma: string) => {
    if (!related.has(lemma)) related.set(lemma, relatedLemmas(wn, lemma));
    return related.get(lemma)!;
  };

  const table: Record<string, { same: string[]; distractors: string[] }> = {};
  let short = 0;
  for (const [id, set] of same) {
    const w = byId.get(id)!;
    const answers = [...set].map(x => byId.get(x)!);
    const group = [w, ...answers];
    const banned = new Set<string>();
    for (const g of group) relatedOf(g.word).forEach(l => banned.add(l));

    const level = LEVEL_ORDER.indexOf(w.level);
    const pool = vocab.filter(c =>
      c.pos === w.pos
      && !banned.has(c.word)
      && !group.some(g => g.word.includes(c.word) || c.word.includes(g.word))
      && !group.some(g => translationsOverlap(g.translation, c.translation))
    );
    // 同じレベルを優先し、足りなければ隣のレベルから
    const rand = seeded(id);
    const picked: V[] = [];
    for (const distance of [0, 1, 2, 3, 4]) {
      const ring = pool.filter(c => Math.abs(LEVEL_ORDER.indexOf(c.level) - level) === distance
        && !picked.some(p => p.word === c.word || translationsOverlap(p.translation, c.translation)));
      while (picked.length < 3 && ring.length > 0) {
        const c = ring.splice(Math.floor(rand() * ring.length), 1)[0];
        if (picked.some(p => p.word === c.word || translationsOverlap(p.translation, c.translation))) continue;
        picked.push(c);
      }
      if (picked.length >= 3) break;
    }
    if (picked.length < 3) { short++; continue; }

    table[id] = {
      same: answers
        .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || a.word.localeCompare(b.word))
        .map(a => a.id),
      distractors: picked.map(p => p.id)
    };
  }

  const out = path.join(process.cwd(), "src/data/synonyms.ts");
  fs.writeFileSync(out, `import { SynonymEntry } from "../types";

/**
 * 類義語クイズのデータ。scripts/bake_synonyms.ts が生成する。
 *
 * キーは出題する語のID。same は同じ意味の収録語、distractors は誤答に使う収録語（どちらもID）。
 * 組は「WordNet で同じ語義に入っている」かつ「教材の訳が第一の訳で重なる」ものだけ。
 * 起動時には要らないので src/synonyms.ts の loadSynonyms() で遅延読み込みする。
 *
 * 出典: WordNet 3.0（同義・関係の判定）。訳は教材の単語データのもの。
 */
export const wordSynonyms: Record<string, SynonymEntry> = ${JSON.stringify(table)};
`, "utf8");

  const counts: Record<string, number> = {};
  for (const id of Object.keys(table)) counts[byId.get(id)!.level] = (counts[byId.get(id)!.level] || 0) + 1;
  console.log(`src/data/synonyms.ts: ${Object.keys(table).length}語（誤答が足りず外した語: ${short}）`);
  console.log(counts);
  return { table, byId };
}

if (process.argv[1] && process.argv[1].endsWith("bake_synonyms.ts")) {
  const { table, byId } = main();
  if (process.argv.includes("--list")) {
    const seen = new Set<string>();
    for (const [id, e] of Object.entries(table)) {
      const w = byId.get(id)!;
      for (const s of e.same) {
        const v = byId.get(s)!;
        const key = [w.word, v.word].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        console.log(`${key}\t${w.word}(${w.translation}) = ${v.word}(${v.translation})`);
      }
    }
  }
}
