import * as fs from "fs";
import * as path from "path";

/**
 * WordNet の index / data を読む共通処理（bake_synonyms.ts と bake_wordnet_pos.ts が使う）。
 *
 * ファイルは bake_senses.ts が `.cache/` に展開したものを使う
 * （wordnet.zip から cntlist.rev・data.*・index.* を取り出しておくこと）。
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
  }
  return { index, synsets };
}

/** その語を WordNet が記録している品詞 */
export function posOf(wn: WordNet, lemma: string): WnPos[] {
  return FILES.map(([, pos]) => pos).filter(pos => wn.index.has(`${lemma}|${pos}`));
}
