import * as fs from "fs";
import * as path from "path";

/**
 * WordNet の index / data を読む共通処理（bake_synonyms.ts と bake_wordnet_pos.ts が使う）。
 *
 * ファイルは bake_senses.ts が `.cache/` に展開したものを使う
 * （wordnet.zip から cntlist.rev・data.*・index.*・*.exc を取り出す）。
 */

export type WnPos = "noun" | "verb" | "adjective" | "adverb";

const FILES: [suffix: string, pos: WnPos][] = [
  ["noun", "noun"], ["verb", "verb"], ["adj", "adjective"], ["adv", "adverb"]
];

export interface Synset {
  pos: WnPos;
  offset: string;
  /** 見出し（小文字、句は空白区切り） */
  lemmas: string[];
  /** 関係先の synset（"品詞:オフセット"）と関係の種類（! は反意語） */
  pointers: { symbol: string; target: string }[];
}

export interface WordNet {
  /** "見出し|品詞" → synset のキー（"品詞:オフセット"）。よく使われる順 */
  index: Map<string, string[]>;
  synsets: Map<string, Synset>;
  /**
   * 活用形 → その品詞（*.exc）。WordNet は比較級・不規則な活用形を見出しに持たず、
   * 例外表で原形へつなぐ（lower → low、better → good）。見出しだけを見ると
   * lower に形容詞が無いことになってしまう
   */
  inflected: Map<string, Set<WnPos>>;
}

const POS_BY_LETTER: Record<string, WnPos> = { n: "noun", v: "verb", a: "adjective", s: "adjective", r: "adverb" };

function requireFile(file: string): string {
  if (!fs.existsSync(file)) {
    throw new Error(
      `${file} がありません。scripts/bake_senses.ts を一度回して .cache/ に WordNet を展開してください。`
    );
  }
  return fs.readFileSync(file, "utf8");
}

export function loadWordNet(cacheDir = path.join(process.cwd(), ".cache")): WordNet {
  const index = new Map<string, string[]>();
  const synsets = new Map<string, Synset>();
  const inflected = new Map<string, Set<WnPos>>();

  for (const [suffix, pos] of FILES) {
    for (const line of requireFile(path.join(cacheDir, `index.${suffix}`)).split("\n")) {
      if (line.startsWith("  ") || !line.trim()) continue;
      const parts = line.trim().split(/\s+/);
      const lemma = parts[0].replace(/_/g, " ");
      const count = Number(parts[2]);
      index.set(`${lemma}|${pos}`, parts.slice(parts.length - count).map(o => `${pos}:${o}`));
    }

    for (const line of requireFile(path.join(cacheDir, `data.${suffix}`)).split("\n")) {
      if (line.startsWith("  ") || !line.trim()) continue;
      const head = line.slice(0, line.indexOf(" | ") >= 0 ? line.indexOf(" | ") : line.length).split(" ");
      const offset = head[0];
      const wordCount = parseInt(head[3], 16);
      const lemmas: string[] = [];
      for (let i = 0; i < wordCount; i++) {
        lemmas.push(head[4 + i * 2].replace(/\(.*\)$/, "").replace(/_/g, " ").toLowerCase());
      }
      let at = 4 + wordCount * 2;
      const ptrCount = Number(head[at++]);
      const pointers: Synset["pointers"] = [];
      for (let i = 0; i < ptrCount; i++) {
        const symbol = head[at];
        const target = head[at + 1];
        const targetPos = POS_BY_LETTER[head[at + 2]];
        pointers.push({ symbol, target: `${targetPos}:${target}` });
        at += 4;
      }
      synsets.set(`${pos}:${offset}`, { pos, offset, lemmas, pointers });
    }

    const excPath = path.join(cacheDir, `${suffix}.exc`);
    if (fs.existsSync(excPath)) {
      for (const line of fs.readFileSync(excPath, "utf8").split("\n")) {
        const [form, ...bases] = line.trim().split(/\s+/);
        // 「after after」のように原形と同じ綴りの行は、見出しの側で足りている
        if (!form || bases.length === 0 || bases.every(b => b === form)) continue;
        const lemma = form.replace(/_/g, " ");
        if (!inflected.has(lemma)) inflected.set(lemma, new Set());
        inflected.get(lemma)!.add(pos);
      }
    }
  }
  return { index, synsets, inflected };
}

/**
 * WordNet が規則で原形に戻す語尾（morphy の detachment rules）。
 * 規則的な比較級（lower → low）は例外表にも載らないため、形容詞についてはこの規則でも引く。
 * 動詞の活用形（-ed / -ing）と名詞の複数形は対象にしない。irrigated（灌漑した）や
 * adjoining（隣接する）は形容詞として教えている語で、原形の動詞に寄せると
 * 正しい品詞を誤りとして拾ってしまう。
 */
const MORPHY: Partial<Record<WnPos, [string, string][]>> = {
  adjective: [["er", ""], ["est", ""], ["er", "e"], ["est", "e"]]
};

/** その語を WordNet が見出しとして記録している品詞 */
export function posOf(wn: WordNet, lemma: string): WnPos[] {
  return FILES.map(([, pos]) => pos).filter(pos => wn.index.has(`${lemma}|${pos}`));
}

/**
 * 見出しに加えて、例外表と規則的な比較級からも品詞を拾う（lower の形容詞など）。
 * 語義の品詞を絞り込むとき（bake_senses.ts）にだけ使う。拾いすぎることがあり
 * （customer に custom の形容詞が付く）、絞り込みを緩める側にしか働かないのでそこでは害が無いが、
 * 「辞書がこの品詞を記録しているか」を問う品詞の検査（bake_wordnet_pos.ts）には使わない。
 */
export function posOfWithForms(wn: WordNet, lemma: string): WnPos[] {
  return FILES.map(([, pos]) => pos).filter(pos => {
    if (wn.index.has(`${lemma}|${pos}`)) return true;
    // 例外表から拾うのは比較級・最上級（better / worse）だけ。動詞の例外表は過去分詞を持つので、
    // 形容詞として使う satisfied（納得している）に動詞まで許してしまう
    if ((pos === "adjective" || pos === "adverb") && wn.inflected.get(lemma)?.has(pos)) return true;
    return (MORPHY[pos] ?? []).some(([suffix, ending]) =>
      lemma.endsWith(suffix) && lemma.length > suffix.length + 1
      && wn.index.has(`${lemma.slice(0, -suffix.length) + ending}|${pos}`));
  });
}
