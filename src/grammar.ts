import { GrammarTopic, Level, Word, WordUsage } from "./types";

/**
 * 文法解説の読み出しと、収録語との結び付け。
 *
 * 解説だけを置いても「読んで終わり」になりやすい。
 * この教材には 7,700 語の単語データと、WordNet から焼いた動詞の文型（wordUsage.ts）が
 * すでにあるので、文法項目に紐づけた文型番号から「実際にその形をとる動詞」を引いて
 * 解説の横に並べる。覚えた単語と文法がつながるようにするため。
 *
 * データ本体（data/grammar.ts）は 100KB を超え、使うのは文法ガイドの画面だけなので、
 * 語義・語法と同じく必要になった時点で読み込む。
 */

let cache: Promise<GrammarTopic[]> | null = null;

export function loadGrammar(): Promise<GrammarTopic[]> {
  if (!cache) {
    cache = import("./data/grammar")
      .then(m => m.grammarTopics)
      .catch(e => {
        // 読み込めなくても他の学習は続けられるべきなので、空として扱う
        console.warn("文法データを読み込めませんでした", e);
        cache = null;
        return [];
      });
  }
  return cache;
}

export const LEVEL_LABELS: Record<Level, string> = {
  junior: "初級（中学）",
  senior: "中級1（高1）",
  senior2: "中級2（高2）",
  senior3: "中級3（高3）",
  advanced: "上級（大・社会人）"
};

/** 学習する順。目次と「次に読む項目」の並びに使う */
export const LEVEL_ORDER: Level[] = ["junior", "senior", "senior2", "senior3", "advanced"];

export function findTopic(topics: GrammarTopic[], id: string): GrammarTopic | undefined {
  return topics.find(t => t.id === id);
}

/** レベルごとにまとめる。並びは LEVEL_ORDER に従う */
export function topicsByLevel(topics: GrammarTopic[]): { level: Level; topics: GrammarTopic[] }[] {
  return LEVEL_ORDER
    .map(level => ({ level, topics: topics.filter(t => t.level === level) }))
    .filter(g => g.topics.length > 0);
}

/**
 * 検索。題名・要約・説明・例文のどこに当たってもよい。
 * 「現在完了」で引けるだけでなく、"have been" のような英語でも引けるようにする。
 */
export function searchTopics(topics: GrammarTopic[], query: string): GrammarTopic[] {
  const q = query.trim().toLowerCase();
  if (!q) return topics;
  return topics.filter(t => {
    const haystack = [
      t.title,
      t.summary,
      t.category,
      ...t.sections.map(s => `${s.heading} ${s.body}`),
      ...t.examples.map(e => `${e.english} ${e.japanese}`)
    ].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

/**
 * その文法の形をとる動詞を、収録語のデータから探す。
 *
 * @param frames  文法項目が持つ WordNet の文型番号
 * @param usage   wordUsage.ts の中身（遅延読み込みなので呼び出し側から渡す）
 * @param words   収録語（訳とレベルを引くのに使う）
 * @param limit   出しすぎると読む気が失せるので既定は8語
 */
export function verbsForFrames(
  frames: number[] | undefined,
  usage: Record<string, WordUsage>,
  words: Word[],
  limit = 8
): Word[] {
  if (!frames || frames.length === 0) return [];
  const wanted = new Set(frames);
  const out: Word[] = [];
  for (const w of words) {
    if (w.pos !== "verb") continue;
    const patterns = usage[w.id]?.patterns;
    if (!patterns || !patterns.some(p => wanted.has(p))) continue;
    out.push(w);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * その文型を扱っている文法項目を引く（verbsForFrames の逆向き）。
 *
 * 文法ガイドから「この形をとる動詞」へは辿れるが、
 * 辞書で語の文型を見ているときに「その形の説明」へ戻る道が無かった。
 * 易しい項目から順に返す（同じ形を複数の項目が扱うことがあるため）。
 */
export function topicsForFrames(
  topics: GrammarTopic[],
  frames: number[] | undefined,
  limit = 3
): GrammarTopic[] {
  if (!frames || frames.length === 0) return [];
  const wanted = new Set(frames);
  return topics
    .filter(t => t.verbFrames?.some(f => wanted.has(f)))
    .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))
    .slice(0, limit);
}

/**
 * 練習問題の成績。
 * 「読んだ」ではなく「解けた」を進捗とするため、項目ごとに正解した問題の番号を持つ。
 */
export interface GrammarProgress {
  [topicId: string]: number[];
}

/** その項目を仕上げたと言えるか（全問正解しているか） */
export function isTopicCleared(topic: GrammarTopic, progress: GrammarProgress): boolean {
  const done = progress[topic.id];
  if (!done) return false;
  return topic.questions.every((_, i) => done.includes(i));
}

/** レベルごとの達成状況。目次に出す */
export function levelProgress(
  topics: GrammarTopic[],
  level: Level,
  progress: GrammarProgress
): { cleared: number; total: number } {
  const inLevel = topics.filter(t => t.level === level);
  return {
    cleared: inLevel.filter(t => isTopicCleared(t, progress)).length,
    total: inLevel.length
  };
}

/**
 * 次に読むとよい項目。
 * まだ仕上げていない項目のうち、前提（requires）を満たしているものを学習順に返す。
 */
export function nextTopics(topics: GrammarTopic[], progress: GrammarProgress, limit = 3): GrammarTopic[] {
  const cleared = new Set(topics.filter(t => isTopicCleared(t, progress)).map(t => t.id));
  const ordered = LEVEL_ORDER.flatMap(level => topics.filter(t => t.level === level));
  const ready = ordered.filter(t =>
    !cleared.has(t.id) && (t.requires || []).every(r => cleared.has(r))
  );
  // 前提を満たすものが無ければ（学習の初めなど）、順番の先頭から出す
  const source = ready.length > 0 ? ready : ordered.filter(t => !cleared.has(t.id));
  return source.slice(0, limit);
}
