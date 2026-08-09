import { WordUsage } from "./types";

/**
 * 語法データの遅延読み込み。
 *
 * 語義（senses.ts）と同じく、使うのは辞書画面だけで起動時には要らないため
 * 必要になった時点で読み込む。一度読んだら同じ Promise を返す。
 */
let cache: Promise<Record<string, WordUsage>> | null = null;

export function loadUsage(): Promise<Record<string, WordUsage>> {
  if (!cache) {
    cache = import("./data/wordUsage")
      .then(m => m.wordUsage)
      .catch(e => {
        // 読み込めなくても学習は続けられるべきなので、空として扱う
        console.warn("語法データを読み込めませんでした", e);
        cache = null;
        return {};
      });
  }
  return cache;
}

/**
 * 動詞の文型（WordNet の sentence frame）。
 *
 * WordNet は動詞ごとに「その動詞が実際に現れる形」を1〜35の番号で持っている。
 * 訳語だけでは、say が that節をとり tell が「人＋that節」をとる、といった違いが
 * 分からない。番号のままでは読めないので、日本語のラベルと英語の型を添える。
 *
 * `label`   … 学習者向けの説明
 * `pattern` … WordNet が示す型（---- がその動詞の位置）
 * `kind`    … 大まかな分類。画面での並べ替えと絞り込みに使う
 */
export interface VerbPattern {
  label: string;
  pattern: string;
  kind: "自動詞" | "他動詞" | "二重目的語" | "不定詞・節" | "前置詞";
}

export const VERB_PATTERNS: Record<number, VerbPattern> = {
  1:  { label: "主語（もの）だけで使う", pattern: "Something ----s", kind: "自動詞" },
  2:  { label: "主語（人）だけで使う", pattern: "Somebody ----s", kind: "自動詞" },
  3:  { label: "It is ...ing の形で使う", pattern: "It is ----ing", kind: "自動詞" },
  4:  { label: "be ...ing に前置詞句が続く", pattern: "Something is ----ing PP", kind: "前置詞" },
  5:  { label: "目的語のあとに補語が続く（SVOC）", pattern: "Something ----s something Adjective/Noun", kind: "他動詞" },
  6:  { label: "補語が続く（SVC・主語はもの）", pattern: "Something ----s Adjective/Noun", kind: "自動詞" },
  7:  { label: "補語が続く（SVC・主語は人）", pattern: "Somebody ----s Adjective", kind: "自動詞" },
  8:  { label: "ものを目的語にとる（SVO）", pattern: "Somebody ----s something", kind: "他動詞" },
  9:  { label: "人を目的語にとる（SVO）", pattern: "Somebody ----s somebody", kind: "他動詞" },
  10: { label: "主語がもの、目的語が人（SVO）", pattern: "Something ----s somebody", kind: "他動詞" },
  11: { label: "主語も目的語ももの（SVO）", pattern: "Something ----s something", kind: "他動詞" },
  12: { label: "to＋人 が続く（主語はもの）", pattern: "Something ----s to somebody", kind: "前置詞" },
  13: { label: "on＋もの が続く", pattern: "Somebody ----s on something", kind: "前置詞" },
  14: { label: "人＋もの の順に2つ目的語をとる（SVOO）", pattern: "Somebody ----s somebody something", kind: "二重目的語" },
  15: { label: "もの＋to＋人 の順に置く", pattern: "Somebody ----s something to somebody", kind: "二重目的語" },
  16: { label: "もの＋from＋人 の順に置く", pattern: "Somebody ----s something from somebody", kind: "前置詞" },
  17: { label: "人＋with＋もの の順に置く", pattern: "Somebody ----s somebody with something", kind: "前置詞" },
  18: { label: "人＋of＋もの の順に置く", pattern: "Somebody ----s somebody of something", kind: "前置詞" },
  19: { label: "もの＋on＋人 の順に置く", pattern: "Somebody ----s something on somebody", kind: "前置詞" },
  20: { label: "人のあとに前置詞句が続く", pattern: "Somebody ----s somebody PP", kind: "前置詞" },
  21: { label: "もののあとに前置詞句が続く", pattern: "Somebody ----s something PP", kind: "前置詞" },
  22: { label: "前置詞句が続く", pattern: "Somebody ----s PP", kind: "前置詞" },
  23: { label: "体の部分が主語になる", pattern: "Somebody's (body part) ----s", kind: "自動詞" },
  24: { label: "人＋to不定詞 が続く", pattern: "Somebody ----s somebody to INFINITIVE", kind: "不定詞・節" },
  25: { label: "人＋動詞の原形 が続く", pattern: "Somebody ----s somebody INFINITIVE", kind: "不定詞・節" },
  26: { label: "that節 が続く", pattern: "Somebody ----s that CLAUSE", kind: "不定詞・節" },
  27: { label: "to＋人 が続く（主語は人）", pattern: "Somebody ----s to somebody", kind: "前置詞" },
  28: { label: "to不定詞 が続く", pattern: "Somebody ----s to INFINITIVE", kind: "不定詞・節" },
  29: { label: "whether to ... が続く", pattern: "Somebody ----s whether INFINITIVE", kind: "不定詞・節" },
  30: { label: "人＋into＋...ing が続く", pattern: "Somebody ----s somebody into V-ing something", kind: "前置詞" },
  31: { label: "もの＋with＋もの の順に置く", pattern: "Somebody ----s something with something", kind: "前置詞" },
  32: { label: "動詞の原形が続く", pattern: "Somebody ----s INFINITIVE", kind: "不定詞・節" },
  33: { label: "...ing（動名詞）が続く", pattern: "Somebody ----s VERB-ing", kind: "不定詞・節" },
  34: { label: "It ----s that ... の形で使う", pattern: "It ----s that CLAUSE", kind: "不定詞・節" },
  35: { label: "主語がもので不定詞が続く", pattern: "Something ----s INFINITIVE", kind: "不定詞・節" }
};

/** 番号を表示用の型に直す。未知の番号は捨てる（WordNet の版が変わっても落ちないように） */
export function describePatterns(patterns: number[] | undefined): VerbPattern[] {
  if (!patterns) return [];
  return patterns.map(n => VERB_PATTERNS[n]).filter((p): p is VerbPattern => Boolean(p));
}

/**
 * 文型から、その動詞が自動詞・他動詞のどちらで使えるかをまとめる。
 *
 * 「他動詞か自動詞か」は英作文でいちばん先に要る情報なのに、
 * 番号や型の一覧を眺めても掴みにくい。1行で言い切れる形にする。
 */
export function transitivity(patterns: number[] | undefined): string | null {
  const kinds = new Set(describePatterns(patterns).map(p => p.kind));
  const transitive = kinds.has("他動詞") || kinds.has("二重目的語");
  const intransitive = kinds.has("自動詞");
  if (transitive && intransitive) return "自動詞・他動詞のどちらでも使う";
  if (transitive) return "他動詞（目的語が要る）";
  if (intransitive) return "自動詞（目的語をとらない）";
  return null;
}
