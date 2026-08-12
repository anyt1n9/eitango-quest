import { useEffect, useState } from "react";
import { GrammarTopic, WordUsage as Usage } from "../types";
import { loadUsage, describePatterns, transitivity } from "../usage";
import { loadGrammar, topicsForFrames } from "../grammar";
import { POS_SHARE_LABELS } from "../senses";
import { Link2, Blocks, Puzzle, BookMarked } from "lucide-react";

/**
 * 単語の使い方（語法・コロケーション・語族）。
 *
 * この教材は「1語 = 1つの訳語」しか持たず、訳を覚えても英文が組み立てられなかった。
 *   - give を「与える」と覚えても、give me the book の形（SVOO）が取れるか分からない
 *   - station を「駅」と覚えても、gas station が「ガソリンスタンド」だと結び付かない
 *   - decide を覚えても decision / decisive が別の語として現れる
 * 出典はすべて WordNet と EJDict で、生成は scripts/bake_usage.ts。
 */
interface Props {
  wordId: string;
  className?: string;
  /** 文型の説明にあたる文法項目を開く */
  onOpenGrammar?: (topicId: string) => void;
}

export default function WordUsageInfo({ wordId, className = "", onOpenGrammar }: Props) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [grammarTopics, setGrammarTopics] = useState<GrammarTopic[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadUsage().then(table => {
      if (!alive) return;
      setUsage(table[wordId] || null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [wordId]);

  // 文型から文法の解説へ戻れるようにする。
  // 解説データは重いので、文型を持つ語を開いたときだけ読む
  useEffect(() => {
    let alive = true;
    if (!onOpenGrammar || !usage?.patterns?.length) {
      setGrammarTopics([]);
      return;
    }
    loadGrammar().then(topics => {
      if (alive) setGrammarTopics(topicsForFrames(topics, usage.patterns));
    });
    return () => { alive = false; };
  }, [usage, onOpenGrammar]);

  if (loading) {
    return <p className={`text-xs text-gray-400 font-semibold ${className}`}>使い方を読み込んでいます…</p>;
  }
  if (!usage) return null;

  const patterns = describePatterns(usage.patterns);
  const summary = transitivity(usage.patterns);
  const collocations = usage.collocations || [];
  const family = usage.family || [];
  if (patterns.length === 0 && collocations.length === 0 && family.length === 0) return null;

  return (
    <div
      className={`bg-sky-50/50 border border-sky-200/70 dark:bg-slate-800/40 dark:border-slate-700 p-3.5 rounded-xl space-y-3 ${className}`}
      data-testid="word_usage"
    >
      <div className="flex items-center gap-1.5">
        <Blocks className="w-4 h-4 text-sky-600 dark:text-sky-400" />
        <p className="font-extrabold text-sky-700 dark:text-sky-400 text-xs">この単語の使い方</p>
      </div>

      {/* --- 文型 ------------------------------------------------------- */}
      {patterns.length > 0 && (
        <div data-testid="usage_patterns">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black text-gray-500 dark:text-slate-400">文の形</span>
            {summary && (
              <span className="px-1.5 py-0.5 rounded-md bg-sky-600 text-white text-[10px] font-black">
                {summary}
              </span>
            )}
          </div>
          <ul className="mt-1.5 space-y-1">
            {patterns.map((p, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-gray-700 dark:text-slate-300 leading-snug">
                  {p.label}
                </span>
                {/* ---- がその動詞の位置。WordNet が示す型をそのまま見せる */}
                <span className="font-mono text-[11px] font-semibold text-sky-800 dark:text-sky-300">
                  {p.pattern}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- その形を扱う文法項目 ---------------------------------------- */}
      {grammarTopics.length > 0 && onOpenGrammar && (
        <div data-testid="usage_grammar_links">
          <div className="flex items-center gap-1">
            <BookMarked className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] font-black text-gray-500 dark:text-slate-400">この形の説明を読む</span>
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {grammarTopics.map(t => (
              <li key={t.id}>
                <button
                  onClick={() => onOpenGrammar(t.id)}
                  id={`btn_usage_grammar_${t.id}`}
                  className="bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold text-sky-800 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-slate-800 cursor-pointer transition"
                >
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- コロケーション --------------------------------------------- */}
      {collocations.length > 0 && (
        <div data-testid="usage_collocations">
          <div className="flex items-center gap-1">
            <Puzzle className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] font-black text-gray-500 dark:text-slate-400">よく組んで使う語</span>
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {collocations.map((c, i) => (
              <li
                key={i}
                className="bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-700 rounded-lg px-2 py-1"
              >
                <span className="font-mono text-[11px] font-black text-gray-900 dark:text-slate-100">{c.phrase}</span>
                <span className="ml-1.5 text-[11px] font-bold text-gray-600 dark:text-slate-400">{c.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- 語族 ------------------------------------------------------- */}
      {family.length > 0 && (
        <div data-testid="usage_family">
          <div className="flex items-center gap-1">
            <Link2 className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] font-black text-gray-500 dark:text-slate-400">同じ語源の語</span>
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {family.map((f, i) => (
              <li
                key={i}
                className="bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-700 rounded-lg px-2 py-1 flex items-center gap-1.5"
              >
                <span className="font-mono text-[11px] font-black text-gray-900 dark:text-slate-100">{f.word}</span>
                <span className="text-[9px] font-black text-sky-700 dark:text-sky-300">
                  {POS_SHARE_LABELS[f.pos] || f.pos}
                </span>
                <span className="text-[11px] font-bold text-gray-600 dark:text-slate-400">{f.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-[10px] text-gray-500 dark:text-slate-400 leading-relaxed pt-1.5 border-t border-sky-200/70 dark:border-slate-700 space-y-0.5">
        {patterns.length > 0 && (
          <p>
            文の形は英英辞典 WordNet が動詞ごとに持つ型です（<span className="font-mono">----</span> がこの動詞の位置）。
            意味ごとではなく、その語のすべての意味をまとめた一覧なので、
            意味によっては使えない形も含まれます。載っていない形もあります。
          </p>
        )}
        {(collocations.length > 0 || family.length > 0) && (
          <p>組んで使う語と語源が同じ語は、WordNet の見出しと EJDict の和訳によります。</p>
        )}
      </div>
    </div>
  );
}
