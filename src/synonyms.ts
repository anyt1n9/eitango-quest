import { Level, SynonymEntry, Word } from "./types";
import { shuffle } from "./shuffle";
import { selectQuizWords } from "./selectQuestions";
import { SrsState } from "./srs";

/**
 * 類義語クイズ（「big と同じ意味の語は？」）の出題を組み立てる。
 *
 * データ（src/data/synonyms.ts、約80KB）は起動時には要らないので遅延読み込みする。
 * 単語データと同じく、失敗したら控えを捨てる。控えを残すと、
 * 読み直しても同じ失敗した約束が返るだけになる。
 */

let cache: Promise<Record<string, SynonymEntry>> | null = null;

export function loadSynonyms(): Promise<Record<string, SynonymEntry>> {
  if (!cache) {
    cache = import("./data/synonyms")
      .then(m => m.wordSynonyms)
      .catch(err => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

export interface SynonymQuestion {
  /** 結果一覧・解答の記録に使うキー（出題語のID） */
  key: string;
  word: Word;
  /** この設問の正解の語 */
  answerWord: Word;
  /** 正解の綴り（選択肢と突き合わせる） */
  answer: string;
  /** 同じ意味の語のうち、正解に選ばなかったもの（解説で見せる） */
  others: Word[];
  /** 選択肢の英単語（正解を含む） */
  options: string[];
  /**
   * 選択肢の綴り → 出題時に選んだ語。誤答の解説（「選んだ X は『…』という意味」）に使う。
   * 綴りで単語データを引き直すと、同じ綴りの語（取り込んだ単語など）が先に並んだとき別の訳が出る
   */
  optionWords: Record<string, Word>;
}

/**
 * 出題する語を選び、設問にする。
 *
 * 正解・誤答の語が単語データに無い（取り込みで消えた、など）と選択肢が欠けるので、
 * 4つそろう語だけを出す。出題の重み付けは他の形式と同じ（期日を過ぎた語・未習の語を優先）。
 */
export function buildSynonymQuestions(input: {
  table: Record<string, SynonymEntry>;
  vocabulary: Word[];
  level: Level;
  count: number;
  solvedHistory?: Record<string, { correctCount: number; attemptCount: number }>;
  srsData?: Record<string, SrsState>;
}): SynonymQuestion[] {
  const byId = new Map(input.vocabulary.map(w => [w.id, w]));
  const usable = (w: Word) => {
    const e = input.table[w.id];
    if (!e) return false;
    return e.same.some(id => byId.has(id)) && e.distractors.every(id => byId.has(id));
  };
  const pool = input.vocabulary.filter(w => w.level === input.level && usable(w));
  const picked = selectQuizWords({
    pool,
    count: input.count,
    solvedHistory: input.solvedHistory ?? {},
    srsData: input.srsData ?? {}
  });

  return picked.map(word => {
    const e = input.table[word.id];
    const same = e.same.map(id => byId.get(id)).filter((w): w is Word => Boolean(w));
    const answer = same[Math.floor(Math.random() * same.length)];
    const distractors = e.distractors.map(id => byId.get(id)!);
    return {
      key: word.id,
      word,
      answerWord: answer,
      answer: answer.word,
      others: same.filter(w => w.id !== answer.id),
      options: shuffle([answer.word, ...distractors.map(d => d.word)]),
      optionWords: Object.fromEntries([answer, ...distractors].map(w => [w.word, w]))
    };
  });
}
