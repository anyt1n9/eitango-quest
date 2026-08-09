/**
 * 多義語の語義を vocabulary.ts に焼き込むスクリプト。
 *
 * これまで1語につき語義は1つだけだった（収録7,743語のうち3,224語＝42%が単一語義）。
 * そのため、教材が教えていない語義に長文や例文で出会うと手がかりが無かった。
 * 実際、収録している長文15本には watch / order / well / fine / matter / left /
 * right / kind の8語が「教材にない語義」で登場している。
 *
 * さらに、教えている語義が最も使われる語義とは限らなかった。
 * WordNet の SemCor 頻度で見ると、例えば次のようになっている。
 *   watch  教材「腕時計」= 名詞 9%   ← 実際は動詞が 91%
 *   kind   教材「親切な」= 形容詞 5% ← 実際は名詞が 95%
 *   well   教材「元気な」= 形容詞 6% ← 実際は副詞が 86%
 *
 * ここでは2つの公開データを突き合わせて語義を用意する。
 *   1. EJDict（英和辞書 / パブリックドメイン）… 日本語の語義そのもの
 *      https://github.com/kujirahand/EJDict  src/a.txt 〜 src/z.txt
 *      『』で囲まれた語義は辞書が重要と示しているもの。
 *   2. WordNet の SemCor 頻度（cntlist.rev）… 品詞ごとの実際の使用割合
 *      語義そのものの対応付けは日英で信頼できないため、品詞の単位でのみ使う。
 *
 * 並び順は「コーパスでよく使われる品詞」→「辞書が重要とする語義」→「辞書の掲載順」。
 * EJDict の掲載順は語源や同綴異義語のまとまりで並んでおり頻度順ではないため
 * （bank は 土手→銀行、well は 井戸→よく の順）、順序をそのまま使ってはいけない。
 *
 * 実行: npx tsx scripts/bake_senses.ts
 * ネットワークから辞書を取得するため、実行には通信が必要。
 */
import fs from "fs";
import path from "path";
import { PartOfSpeech } from "../src/types";
import { inferPartOfSpeech } from "../src/pos";

const EJDICT_BASE = "https://raw.githubusercontent.com/kujirahand/EJDict/master/src";
const WORDNET_URL = "https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip";

/** 1語あたりに焼き込む語義の上限。多すぎると学習者が読めず、データも肥大する */
const MAX_SENSES = 4;
/** 1つの語義の最大文字数 */
const MAX_SENSE_LEN = 28;

const CACHE_DIR = path.join(process.cwd(), ".cache");

async function fetchText(url: string, cacheName: string): Promise<string> {
  const cached = path.join(CACHE_DIR, cacheName);
  if (fs.existsSync(cached)) return fs.readFileSync(cached, "utf8");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} の取得に失敗しました (HTTP ${res.status})`);
  const text = await res.text();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cached, text);
  return text;
}

/**
 * EJDict を読み込み、見出し語 → 語義本文 の対応表を作る。
 *
 * 大文字小文字を区別した表と、区別しない表の2つを返す。
 * 区別せずに引くと、略語の見出し（AID = artificial insemination by donor、
 * SALT = Strategic Arms Limitation Talks など）が同じ綴りの普通の語を
 * 上書きしてしまう。辞書は昇順に並んでおり大文字が先に来るため、
 * 「先に見つかった方を採用」では必ず略語が勝つ。
 */
async function loadEjdict(): Promise<{ exact: Map<string, string>; lower: Map<string, string> }> {
  const exact = new Map<string, string>();
  const lower = new Map<string, string>();
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  for (const c of letters) {
    const body = await fetchText(`${EJDICT_BASE}/${c}.txt`, `ejdict-${c}.txt`);
    for (const line of body.split("\n")) {
      const i = line.indexOf("\t");
      if (i < 0) continue;
      // 「英単語, 英単語」は綴りの違いだけで意味が同じもの
      const heads = line.slice(0, i).split(",").map(s => s.trim()).filter(Boolean);
      const meaning = line.slice(i + 1);
      for (const h of heads) {
        if (!exact.has(h)) exact.set(h, meaning);
        const l = h.toLowerCase();
        if (!lower.has(l)) lower.set(l, meaning);
      }
    }
  }
  return { exact, lower };
}

/** 収録語の綴りで辞書を引く。綴りが一致するものを優先する */
function lookup(dict: { exact: Map<string, string>; lower: Map<string, string> }, word: string): string | undefined {
  const w = word.trim();
  return dict.exact.get(w) ?? dict.exact.get(w.toLowerCase()) ?? dict.lower.get(w.toLowerCase());
}

/**
 * WordNet の SemCor 頻度から、語ごとの品詞別使用割合を作る。
 * cntlist.rev の1行は「sense_key sense_number tag_cnt」。
 * sense_key の "%" の直後の数字が品詞（1=名詞 2=動詞 3=形容詞 4=副詞 5=形容詞）。
 */
async function loadPosShares(): Promise<Map<string, Record<string, number>>> {
  const cached = path.join(CACHE_DIR, "cntlist.rev");
  if (!fs.existsSync(cached)) {
    const res = await fetch(WORDNET_URL);
    if (!res.ok) throw new Error(`WordNet の取得に失敗しました (HTTP ${res.status})`);
    const zipPath = path.join(CACHE_DIR, "wordnet.zip");
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
    const { execFileSync } = await import("child_process");
    execFileSync("unzip", ["-o", "-j", zipPath, "wordnet/cntlist.rev", "-d", CACHE_DIR]);
  }

  const POS_OF: Record<string, PartOfSpeech> = {
    "1": "noun", "2": "verb", "3": "adjective", "4": "adverb", "5": "adjective"
  };
  const counts = new Map<string, Record<string, number>>();
  for (const line of fs.readFileSync(cached, "utf8").split("\n")) {
    const parts = line.trim().split(/\s+/);
    const key = parts[0], cnt = Number(parts[2]);
    if (!key || !cnt) continue;
    const m = key.match(/^(.+?)%(\d)/);
    if (!m) continue;
    const pos = POS_OF[m[2]];
    if (!pos) continue;
    const lemma = m[1].replace(/_/g, " ");
    const rec = counts.get(lemma) || {};
    rec[pos] = (rec[pos] || 0) + cnt;
    counts.set(lemma, rec);
  }

  // 回数を割合(%)に直す
  const shares = new Map<string, Record<string, number>>();
  for (const [lemma, rec] of counts) {
    const total = Object.values(rec).reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const s: Record<string, number> = {};
    for (const [pos, c] of Object.entries(rec)) s[pos] = Math.round((100 * c) / total);
    shares.set(lemma, s);
  }
  return shares;
}

interface RawSense {
  meaning: string;
  /** 辞書が『』で重要と示している語義か */
  important: boolean;
  /** 辞書での掲載順 */
  order: number;
}

/** EJDict の語義本文を1語義ずつに分け、表示用に記号を整理する */
export function parseSenses(body: string): RawSense[] {
  const out: RawSense[] = [];
  body.split(" / ").forEach((raw, order) => {
    const important = /『/.test(raw);
    const meaning = raw
      .replace(/《[^》]*》/g, "")            // 用法注記（+『up』+『名』など）
      .replace(/〈[CU]〉/g, "")              // 可算・不可算の印
      .replace(/[『』]/g, "")                // 重要語義の囲み
      .replace(/\([a-zA-Z][^)]*\)/g, "")     // 英語の言い換え (brightness) など
      .replace(/\s+/g, "")
      .replace(/^[;,、，･・]+|[;,、，･・]+$/g, "")
      .trim();
    if (!meaning) return;
    // 「leaveの過去・過去分詞」のような活用の相互参照は語義ではないので除く
    if (/(の(過去|過去分詞|複数形|比較級|最上級|現在分詞|三人称)|の別形|の短縮形)/.test(meaning)) return;
    // 「=enshrine」のような別見出しへの参照や、日本語を含まない項目も語義ではない
    if (/^=/.test(meaning) || !/[ぁ-んァ-ヶ一-鿿]/.test(meaning)) return;
    out.push({ meaning, important, order });
  });
  return out;
}

/**
 * 品詞を推定するための下ごしらえ。
 * 括弧書きを付けたまま推定すると、括弧内の読点で語義が切れて誤判定する。
 * 例)「(丘などの,通例けわしい)傾斜面,坂」→ 先頭が「(丘などの」となり形容詞と誤る。
 * 表示には括弧付きの方が情報量があるので、推定用にだけ落とす。
 */
function forPosInference(meaning: string): string {
  return meaning.replace(/[（(][^）)]*[）)]/g, "").replace(/^[、,，･・]+/, "").trim() || meaning;
}

/**
 * 語義を並べて上限まで絞る。
 *
 * 単純に「よく使う品詞順」で並べて上から切ると、上位の品詞の語義だけで枠が埋まり、
 * 肝心の「別の品詞の意味」が1つも残らない。
 *   例) watch を動詞の割合(91%)順に並べると動詞の語義が5つ並び、
 *       この教材が教えている「腕時計」（名詞）が消える。
 * そこで品詞ごとにまとめ、割合の高い品詞から1つずつ巡回して取り出す。
 * こうすると watch は 見つめる(動詞) → 時計(名詞) → 見張る(動詞) … と並ぶ。
 *
 * @param ownPos この教材が教えている語義の品詞。割合が低くても必ず1つは残す
 * @param ownTranslation この教材が教えている訳語。同じ意味の語義を各品詞の先頭に置く
 */
export function rankSenses(
  word: string,
  senses: RawSense[],
  shares: Record<string, number> | undefined,
  ownPos?: PartOfSpeech,
  ownTranslation?: string
): { meaning: string; pos: PartOfSpeech; share?: number }[] {
  // 教材が教えている訳語の見出し（「銀行」「春」など）。
  // 辞書の掲載順は頻度順ではないため（bank は 土手 → 銀行 の順）、
  // これを手がかりに「学習者が覚えている意味」を各品詞の先頭へ引き上げる
  const ownKeys = (ownTranslation || "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .split(/[、,，/／;；]/)
    .map(s => s.replace(/^[〜～を]/, "").trim())
    .filter(s => s.length >= 2);
  const matchesOwn = (meaning: string) => ownKeys.some(k => meaning.includes(k));
  // 同じ語義文が重複することがあるため取り除く
  const seen = new Set<string>();
  const withPos = senses
    .filter(s => (seen.has(s.meaning) ? false : (seen.add(s.meaning), true)))
    .map(s => {
      const pos = inferPartOfSpeech(word, forPosInference(s.meaning));
      return { ...s, pos, share: shares?.[pos] };
    });

  // 品詞ごとにまとめ、各群の中は「辞書が重要とする語義」→「掲載順」
  const groups = new Map<PartOfSpeech, typeof withPos>();
  for (const s of withPos) {
    const g = groups.get(s.pos) || [];
    g.push(s);
    groups.set(s.pos, g);
  }
  for (const g of groups.values()) {
    g.sort((a, b) => {
      const ma = matchesOwn(a.meaning), mb = matchesOwn(b.meaning);
      if (ma !== mb) return ma ? -1 : 1;               // 教材が教えている意味を先に
      if (a.important !== b.important) return a.important ? -1 : 1; // 辞書が重要とする語義を先に
      return a.order - b.order;                        // 残りは掲載順
    });
  }

  // 品詞の並びは使用割合の高い順。教材が教えている品詞は、割合が低くても先頭付近に置く
  const order = [...groups.keys()].sort((a, b) => {
    if (a === ownPos) return -1;
    if (b === ownPos) return 1;
    return (shares?.[b] ?? -1) - (shares?.[a] ?? -1);
  });

  // 品詞を巡回しながら1つずつ取り出す
  const picked: typeof withPos = [];
  for (let round = 0; picked.length < MAX_SENSES; round++) {
    let added = false;
    for (const pos of order) {
      const g = groups.get(pos)!;
      if (round < g.length && picked.length < MAX_SENSES) {
        picked.push(g[round]);
        added = true;
      }
    }
    if (!added) break;
  }

  return picked.map(s => {
    const meaning = s.meaning.length > MAX_SENSE_LEN
      ? s.meaning.slice(0, MAX_SENSE_LEN) + "…"
      : s.meaning;
    return s.share === undefined
      ? { meaning, pos: s.pos }
      : { meaning, pos: s.pos, share: s.share };
  });
}

async function main() {
  console.log("辞書データを取得しています…");
  const [dict, shares] = await Promise.all([loadEjdict(), loadPosShares()]);
  console.log(`EJDict: ${dict.exact.size}語 / WordNet頻度: ${shares.size}語`);

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
  const arr: any[] = JSON.parse(src.slice(arrStart, arrEnd + 1));

  const table: Record<string, any[]> = {};
  let multi = 0, withShare = 0, minority = 0;
  for (const w of arr) {
    // 語義は別ファイルに置くため、単語データ側には残さない
    delete w.senses;
    const key = String(w.word).trim().toLowerCase();
    const body = lookup(dict, String(w.word));
    if (!body) continue;

    const ranked = rankSenses(w.word, parseSenses(body), shares.get(key), w.pos, w.translation);
    if (ranked.length === 0) continue;

    table[w.id] = ranked;
    if (ranked.length >= 2) multi++;
    if (ranked.some(s => s.share !== undefined)) withShare++;
    if (ranked[0].share !== undefined && ranked[0].pos !== w.pos) minority++;
  }

  // 単語データから senses を取り除いた状態で書き戻す
  fs.writeFileSync(vocabFile, src.slice(0, arrStart) + JSON.stringify(arr) + src.slice(arrEnd + 1));

  const out = `import { WordSense } from "../types";

/**
 * 単語ごとの語義一覧。scripts/bake_senses.ts が生成する。
 *
 * 単語データ(vocabulary.ts)と分けてあるのは、語義を使うのが辞書とクイズの結果表示だけで、
 * 起動時には要らないため。まとめて持つと初回読み込みが gzip で 400KB 以上増える。
 * 利用側は src/senses.ts の loadSenses() を使い、必要になった時点で読み込む。
 *
 * 出典:
 *   - 語義: EJDict（パブリックドメインの英和辞書）https://github.com/kujirahand/EJDict
 *   - 品詞ごとの使用割合: WordNet の SemCor 頻度（cntlist.rev）
 */
export const wordSenses: Record<string, WordSense[]> = ${JSON.stringify(table)};
`;
  fs.writeFileSync(path.join(process.cwd(), "src/data/senses.ts"), out);

  const kb = (f: string) => Math.round(fs.statSync(path.join(process.cwd(), f)).size / 1024);
  console.log(`語義を付けた語: ${Object.keys(table).length} / ${arr.length}`);
  console.log(`  うち語義が2つ以上: ${multi}`);
  console.log(`  うち使用割合のデータあり: ${withShare}`);
  console.log(`  教材の品詞が最頻でない語: ${minority}`);
  console.log(`src/data/senses.ts: ${kb("src/data/senses.ts")} KB / vocabulary.ts: ${kb("src/data/vocabulary.ts")} KB`);
}

if (process.argv[1] && process.argv[1].includes("bake_senses")) main();
