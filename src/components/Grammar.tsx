import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { GrammarTopic, Level, Word, WordUsage } from "../types";
import {
  loadGrammar, findTopic, topicsByLevel, searchTopics, verbsForFrames,
  GrammarProgress, isTopicCleared, levelProgress, nextTopics,
  LEVEL_LABELS, LEVEL_ORDER
} from "../grammar";
import { loadUsage } from "../usage";
import { passages } from "../data/passages";
import { readStoredArray, readStoredObject, writeStored } from "../storage";
import {
  ArrowLeft, BookMarked, Search, Check, X, CircleCheck, Lightbulb,
  AlertTriangle, PencilLine, ChevronRight, Sparkles, RotateCcw
} from "lucide-react";

/**
 * 文法ガイド。
 *
 * この教材は単語と訳の1対1の暗記に寄っていて、文法の解説がまったく無かった。
 * 単語を覚えても並べ方を知らなければ長文は読めないので、
 * 結局は文法の参考書を別に買う必要があった。
 *
 * 読むだけで終わらせないために、各項目に練習問題を付け、
 * 「全問正解したら仕上がり」として進捗を残す。
 * さらに、その文法の形をとる動詞を収録語から引いて並べ、覚えた単語と結び付ける。
 *
 * 練習問題を間違えたことも残す。以前は正解だけを数えていたので、
 * 間違えた項目は「まだ手を付けていない項目」と見分けが付かず、
 * 復習に戻る手がかりが残らなかった。
 */
interface Props {
  vocabulary: Word[];
  onBackToDashboard: () => void;
  /** 長文や辞書から特定の項目を開いて入ってきたとき */
  initialTopicId?: string | null;
  /** 開いている項目が変わったことを伝える（URLに反映する） */
  onOpenTopicChange?: (topicId: string | null) => void;
}

const STORAGE_KEY = "quest_grammar_progress";
const WRONG_KEY = "quest_grammar_wrong";

export default function Grammar({
  vocabulary, onBackToDashboard, initialTopicId = null, onOpenTopicChange
}: Props) {
  const [openId, setOpenId] = useState<string | null>(initialTopicId);

  // 外（長文・辞書・URL）から指定が変わったら開き直す
  useEffect(() => {
    setOpenId(initialTopicId);
  }, [initialTopicId]);

  // 開いている項目をURLに反映する
  useEffect(() => {
    onOpenTopicChange?.(openId);
  }, [openId]);
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");
  const [progress, setProgress] = useState<GrammarProgress>(() =>
    readStoredObject<GrammarProgress>(STORAGE_KEY, {})
  );
  // 練習問題を間違えた項目。仕上がった時点で外れる
  const [wrongTopics, setWrongTopics] = useState<string[]>(() =>
    readStoredArray<string>(WRONG_KEY)
  );
  // 解説データは100KBを超え、使うのはこの画面だけなので必要になってから読む
  const [topics, setTopics] = useState<GrammarTopic[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadGrammar().then(t => { if (alive) setTopics(t); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    writeStored(STORAGE_KEY, progress);
  }, [progress]);

  useEffect(() => {
    writeStored(WRONG_KEY, wrongTopics);
  }, [wrongTopics]);

  // 仕上がった項目は復習の一覧から外す
  useEffect(() => {
    if (!topics || wrongTopics.length === 0) return;
    const stillWrong = wrongTopics.filter(id => {
      const t = findTopic(topics, id);
      return t ? !isTopicCleared(t, progress) : false;
    });
    if (stillWrong.length !== wrongTopics.length) setWrongTopics(stillWrong);
  }, [topics, progress, wrongTopics]);

  const filtered = useMemo(() => {
    if (!topics) return [];
    const byLevel = levelFilter === "all" ? topics : topics.filter(t => t.level === levelFilter);
    return searchTopics(byLevel, query);
  }, [topics, query, levelFilter]);

  const open = topics && openId ? findTopic(topics, openId) : undefined;
  const suggestions = useMemo(() => (topics ? nextTopics(topics, progress) : []), [topics, progress]);

  if (!topics) {
    return (
      <p className="text-sm text-gray-400 font-semibold text-center py-16" id="grammar_loading">
        文法データを読み込んでいます…
      </p>
    );
  }

  if (open) {
    return (
      <TopicDetail
        topic={open}
        vocabulary={vocabulary}
        progress={progress}
        setProgress={setProgress}
        onWrong={id => setWrongTopics(prev => (prev.includes(id) ? prev : [...prev, id]))}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="space-y-4" id="grammar_screen">
      <button
        onClick={onBackToDashboard}
        className="flex items-center gap-1 text-xs font-bold text-gray-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer"
        id="btn_grammar_back"
      >
        <ArrowLeft className="w-4 h-4" />
        ダッシュボードに戻る
      </button>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex items-start gap-2">
          <BookMarked className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-slate-100">文法ガイド</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed mt-1">
              中学から大学レベルまでの文法を {topics.length} 項目。
              説明・例文・よくある間違い・練習問題がそろっています。
              単語を覚えても並べ方を知らなければ長文は読めないので、ここで文の組み立てを確かめてください。
            </p>
          </div>
        </div>

        {/* 間違えた項目。単語の苦手リストにあたるもので、ここに残らないと
            「解いたが間違えた」項目が未着手と区別できない */}
        {wrongTopics.length > 0 && (
          <div
            className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900 rounded-2xl p-3 space-y-1.5"
            data-testid="grammar_wrong_topics"
          >
            <div className="flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <p className="text-xs font-black text-rose-700 dark:text-rose-300">
                練習問題を間違えた項目（{wrongTopics.length}件）
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {wrongTopics.map(id => {
                const t = findTopic(topics, id);
                if (!t) return null;
                return (
                  <button
                    key={id}
                    onClick={() => setOpenId(id)}
                    id={`grammar_wrong_${id}`}
                    className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-lg px-2.5 py-1 text-[11px] font-bold text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {t.title}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 font-semibold">
              全問正解するとこの一覧から外れます。
            </p>
          </div>
        )}

        {/* 次に読むとよい項目 */}
        {suggestions.length > 0 && (
          <div className="bg-indigo-50/60 border border-indigo-200/70 rounded-2xl p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <p className="text-xs font-black text-indigo-700">次に読むとよい項目</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map(t => (
                <button
                  key={t.id}
                  onClick={() => setOpenId(t.id)}
                  className="bg-white dark:bg-slate-900 border border-indigo-200 rounded-lg px-2.5 py-1 text-[11px] font-bold text-indigo-800 hover:bg-indigo-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="項目名・説明・例文で検索..."
            aria-label="文法項目を検索"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm font-semibold text-gray-900 dark:text-slate-100"
            id="grammar_search"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["all", ...LEVEL_ORDER] as const).map(l => {
            const p = l === "all" ? null : levelProgress(topics, l, progress);
            return (
              <button
                key={l}
                onClick={() => setLevelFilter(l)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition cursor-pointer ${
                  levelFilter === l
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100"
                }`}
              >
                {l === "all" ? "すべて" : LEVEL_LABELS[l]}
                {p && <span className="ml-1 font-mono opacity-70">{p.cleared}/{p.total}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-3xl p-8 text-center">
          <p className="text-sm font-bold text-gray-400">条件に合う項目が見つかりませんでした。</p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="grammar_topic_list">
        {topicsByLevel(filtered).map(group => (
          <div key={group.level} className="space-y-2">
            <h3 className="text-xs font-black text-gray-500 dark:text-slate-400 px-1">
              {LEVEL_LABELS[group.level]}
            </h3>
            <div className="space-y-2">
              {group.topics.map(t => {
                const cleared = isTopicCleared(t, progress);
                return (
                  <button
                    key={t.id}
                    onClick={() => setOpenId(t.id)}
                    id={`grammar_topic_${t.id}`}
                    className="w-full text-left bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-slate-800 transition cursor-pointer flex items-start gap-3"
                  >
                    <span className="shrink-0 mt-0.5">
                      {cleared
                        ? <CircleCheck className="w-5 h-5 text-emerald-500" aria-label="仕上がり" />
                        : <span className="block w-5 h-5 rounded-full border-2 border-gray-200 dark:border-slate-700" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-gray-900 dark:text-slate-100">{t.title}</span>
                        <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 rounded px-1.5 py-0.5">
                          {t.category}
                        </span>
                        {wrongTopics.includes(t.id) && (
                          <span className="text-[10px] font-black text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded px-1.5 py-0.5">
                            要復習
                          </span>
                        )}
                      </span>
                      <span className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {t.summary}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
}

/** 1項目の詳細。説明 → 例文 → よくある間違い → 練習の順に並べる */
function TopicDetail({
  topic, vocabulary, progress, setProgress, onWrong, onBack
}: {
  topic: GrammarTopic;
  vocabulary: Word[];
  progress: GrammarProgress;
  setProgress: Dispatch<SetStateAction<GrammarProgress>>;
  onWrong: (topicId: string) => void;
  onBack: () => void;
}) {
  const [usage, setUsage] = useState<Record<string, WordUsage> | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    setAnswers({});
  }, [topic.id]);

  useEffect(() => {
    let alive = true;
    if (!topic.verbFrames) return;
    loadUsage().then(table => { if (alive) setUsage(table); });
    return () => { alive = false; };
  }, [topic.verbFrames]);

  const verbs = useMemo(
    () => (usage ? verbsForFrames(topic.verbFrames, usage, vocabulary) : []),
    [usage, topic.verbFrames, vocabulary]
  );

  // この文法が出てくる長文（印は scripts/tag_passage_grammar.ts が本文から機械的に付ける）
  const readings = useMemo(
    () => passages.filter(p => p.grammarFocus?.includes(topic.id)).slice(0, 5),
    [topic.id]
  );

  const answer = (qIndex: number, optionIndex: number) => {
    if (answers[qIndex] !== undefined) return;
    setAnswers(prev => ({ ...prev, [qIndex]: optionIndex }));
    if (optionIndex !== topic.questions[qIndex].correctIndex) {
      // 間違えたことを残す。正解だけを数えていたので、
      // 間違えた項目とまだ手を付けていない項目が見分けられなかった
      onWrong(topic.id);
      return;
    }
    setProgress(prev => {
      const done = prev[topic.id] || [];
      if (done.includes(qIndex)) return prev;
      return { ...prev, [topic.id]: [...done, qIndex] };
    });
  };

  const cleared = isTopicCleared(topic, progress);

  return (
    <div className="space-y-4" id="grammar_detail">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-bold text-gray-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer"
        id="btn_grammar_detail_back"
      >
        <ArrowLeft className="w-4 h-4" />
        文法ガイドの一覧に戻る
      </button>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-3xl p-5 space-y-2 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">
            {LEVEL_LABELS[topic.level]}
          </span>
          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 rounded px-1.5 py-0.5">
            {topic.category}
          </span>
          {cleared && (
            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded px-1.5 py-0.5">
              仕上がり
            </span>
          )}
        </div>
        <h2 className="text-xl font-black text-gray-900 dark:text-slate-100">{topic.title}</h2>
        <p className="text-sm font-bold text-gray-600 dark:text-slate-300 leading-relaxed">{topic.summary}</p>
      </div>

      {/* 説明 */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-3xl p-5 space-y-4 shadow-sm" data-testid="grammar_sections">
        {topic.sections.map((s, i) => (
          <div key={i} className="space-y-1">
            <h3 className="text-sm font-black text-gray-900 dark:text-slate-100 flex items-start gap-1.5">
              <span className="text-indigo-500 font-mono text-xs mt-0.5">{i + 1}.</span>
              {s.heading}
            </h3>
            <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed pl-5">{s.body}</p>
          </div>
        ))}
      </div>

      {/* 例文 */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-3xl p-5 space-y-3 shadow-sm" data-testid="grammar_examples">
        <div className="flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-black text-gray-900 dark:text-slate-100">例文</h3>
        </div>
        <ul className="space-y-2.5">
          {topic.examples.map((e, i) => (
            <li key={i} className="border-l-2 border-amber-300 dark:border-amber-700 pl-3 space-y-0.5">
              <p className="font-mono text-sm font-bold text-gray-900 dark:text-slate-100 leading-snug">{e.english}</p>
              <p className="text-xs font-semibold text-gray-600 dark:text-slate-400">{e.japanese}</p>
              {e.note && (
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">→ {e.note}</p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* この文法をとる動詞（収録語から引く） */}
      {verbs.length > 0 && (
        <div className="bg-sky-50/50 dark:bg-slate-800/40 border border-sky-200/70 dark:border-slate-700 rounded-3xl p-5 space-y-2" data-testid="grammar_verbs">
          <h3 className="text-sm font-black text-sky-800 dark:text-sky-300">この形をとる動詞（収録語から）</h3>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
            英英辞典 WordNet が、実際にこの形で使われると記録している動詞です。
            覚えた単語がこの文法とどうつながるかを確かめてください。
          </p>
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {verbs.map(w => (
              <li key={w.id} className="bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-700 rounded-lg px-2 py-1">
                <span className="font-mono text-[11px] font-black text-gray-900 dark:text-slate-100">{w.word}</span>
                <span className="ml-1.5 text-[11px] font-bold text-gray-600 dark:text-slate-400">{w.translation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* この文法が出てくる長文 */}
      {readings.length > 0 && (
        <div className="bg-emerald-50/50 dark:bg-slate-800/40 border border-emerald-200/70 dark:border-slate-700 rounded-3xl p-5 space-y-2" data-testid="grammar_readings">
          <h3 className="text-sm font-black text-emerald-800 dark:text-emerald-300">この文法が出てくる長文</h3>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
            解説を読んだら、実際の英文の中で見つけてみてください。
            「長文読破 Quest」から読めます。
          </p>
          <ul className="space-y-1.5 pt-1">
            {readings.map(p => (
              <li key={p.id} className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5">
                <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 mr-1.5">
                  {LEVEL_LABELS[p.level]}
                </span>
                <span className="text-xs font-bold text-gray-900 dark:text-slate-100">{p.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* よくある間違い */}
      <div className="bg-rose-50/50 dark:bg-slate-800/40 border border-rose-200/70 dark:border-slate-700 rounded-3xl p-5 space-y-3" data-testid="grammar_mistakes">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-black text-gray-900 dark:text-slate-100">よくある間違い</h3>
        </div>
        <ul className="space-y-3">
          {topic.mistakes.map((m, i) => (
            <li key={i} className="space-y-1">
              <p className="font-mono text-sm font-bold text-rose-700 dark:text-rose-400 flex items-start gap-1.5">
                <X className="w-3.5 h-3.5 mt-1 shrink-0" />
                <span className="line-through decoration-rose-400/60">{m.wrong}</span>
              </p>
              <p className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 mt-1 shrink-0" />
                <span>{m.right}</span>
              </p>
              <p className="text-xs font-semibold text-gray-600 dark:text-slate-400 pl-5">{m.why}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* 練習問題 */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-3xl p-5 space-y-4 shadow-sm" data-testid="grammar_questions">
        <div className="flex items-center gap-1.5">
          <PencilLine className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-black text-gray-900 dark:text-slate-100">練習問題</h3>
          <span className="text-[11px] font-mono font-bold text-gray-400">
            {(progress[topic.id] || []).length} / {topic.questions.length} 正解
          </span>
        </div>

        {topic.questions.map((q, qi) => {
          const picked = answers[qi];
          const answered = picked !== undefined;
          return (
            <div key={qi} className="space-y-2 pt-1" data-testid={`grammar_question_${qi}`}>
              <p className="font-mono text-sm font-bold text-gray-900 dark:text-slate-100 leading-snug">
                {qi + 1}. {q.question}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.correctIndex;
                  let cls = "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:border-indigo-400";
                  if (answered) {
                    if (isCorrect) cls = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-900 dark:text-emerald-300 font-black";
                    else if (oi === picked) cls = "bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-300 font-black";
                    else cls = "bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-800 text-gray-400 opacity-60";
                  }
                  return (
                    <button
                      key={oi}
                      onClick={() => answer(qi, oi)}
                      disabled={answered}
                      id={`grammar_q${qi}_opt${oi}`}
                      className={`border rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${answered ? "cursor-default" : "cursor-pointer"} ${cls}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {answered && (
                <p className="text-xs font-semibold text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 leading-relaxed">
                  {picked === q.correctIndex ? "正解。" : `正解は「${q.options[q.correctIndex]}」。`}
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
