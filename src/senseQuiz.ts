import { Level, SenseQuizItem, Word } from "./types";
import { shuffle } from "./shuffle";
import { selectQuizWords } from "./selectQuestions";
import { SrsState } from "./srs";

/**
 * 語義分別クイズ（「この文の book はどの意味？」）の出題を組み立てる。
 *
 * データ（src/data/senseQuiz.ts）は起動時には要らないので遅延読み込みする。
 * 失敗したら控えを捨てる（読み直しで同じ失敗した約束を返さないように）。
 */

let cache: Promise<SenseQuizItem[]> | null = null;

export function loadSenseQuiz(): Promise<SenseQuizItem[]> {
  if (!cache) {
    cache = import("./data/senseQuiz")
      .then(m => m.senseQuiz)
      .catch(err => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

/**
 * 例文の印（{booked}）を取り出す。印がちょうど1つでなければ null。
 * 画面では印の部分を強調し、それ以外はそのまま見せる。
 */
export function parseSenseExample(example: string): { before: string; target: string; after: string } | null {
  const m = /^([^{}]*)\{([^{}]+)\}([^{}]*)$/.exec(example);
  if (!m) return null;
  return { before: m[1], target: m[2], after: m[3] };
}

/** 印を外した英文（読み上げ・結果一覧用） */
export function plainSenseExample(example: string): string {
  return example.replace(/[{}]/g, "");
}

export interface SenseQuestion {
  /** 結果一覧のキー（同じ語が2回出ることはない） */
  key: string;
  word: Word;
  item: SenseQuizItem;
  /** 出題した語義の位置。0 が教材の教えている語義 */
  senseIndex: number;
  options: string[];
  answer: string;
}

/**
 * 教材が教えている語義（先頭）の問題かどうか。
 *
 * 間隔反復と苦手単語は「教材が教えている意味を覚えたか」を追っているので、
 * 記録するのはこの語義の問題だけにする。別の語義（book の「予約する」）を
 * 当てられても、「本」を覚えたことにはならない。逆に別の語義を外しても、
 * 「本」が苦手になったわけではない。
 */
export function asksTaughtSense(q: Pick<SenseQuestion, "senseIndex">): boolean {
  return q.senseIndex === 0;
}

export function buildSenseQuestions(input: {
  items: SenseQuizItem[];
  vocabulary: Word[];
  level: Level;
  count: number;
  solvedHistory?: Record<string, { correctCount: number; attemptCount: number }>;
  srsData?: Record<string, SrsState>;
}): SenseQuestion[] {
  // 綴りで収録語と結び付ける（取り込んだ単語に同じ綴りがあっても、収録語の方を優先する）
  const byWord = new Map<string, Word>();
  for (const w of input.vocabulary) {
    const key = w.word.toLowerCase();
    if (!byWord.has(key)) byWord.set(key, w);
  }
  const itemByWordId = new Map<string, SenseQuizItem>();
  for (const item of input.items) {
    const w = byWord.get(item.word.toLowerCase());
    if (w && w.level === input.level && item.senses.length >= 2) itemByWordId.set(w.id, item);
  }
  const pool = input.vocabulary.filter(w => itemByWordId.has(w.id));
  const picked = selectQuizWords({
    pool,
    count: input.count,
    solvedHistory: input.solvedHistory ?? {},
    srsData: input.srsData ?? {}
  });

  return picked.map(word => {
    const item = itemByWordId.get(word.id)!;
    // どの語義も同じ確率で出す。教材の語義に偏ると「いつも見慣れた方が正解」になり、
    // 逆に別の語義ばかりだと「見慣れない方を選べば当たる」になる
    const senseIndex = Math.floor(Math.random() * item.senses.length);
    return {
      key: word.id,
      word,
      item,
      senseIndex,
      options: shuffle(item.senses.map(s => s.meaning)),
      answer: item.senses[senseIndex].meaning
    };
  });
}
