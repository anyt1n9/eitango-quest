import React, { useCallback, useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { Level, UserStats, Word } from "../types";
import { SrsState } from "../srs";
import {
  asksTaughtSense, buildSenseQuestions, loadSenseQuiz, parseSenseExample, plainSenseExample, SenseQuestion
} from "../senseQuiz";
import ChoiceQuiz from "./ChoiceQuiz";

/**
 * 語義分別クイズ。例文を読んで、その文での意味を同じ語の語義の中から選ぶ。
 *
 * 単語帳は1語に1つの訳を覚えさせるので、book を「本」とだけ覚えた人は
 * 「I booked a table.」で止まる。よく使う語ほど意味が多いので、
 * 文脈から意味を決める練習を別に置く。
 *
 * 記録の扱い：教材が教えている語義（先頭）の問題だけを間隔反復・苦手単語に入れる。
 * 別の語義の問題は、その日の学習量（今日の目標・学習カレンダー）にだけ数える
 * （src/senseQuiz.ts の asksTaughtSense を参照）。
 */

interface SenseQuizProps {
  level: Level;
  vocabulary: Word[];
  setWrongWords: React.Dispatch<React.SetStateAction<string[]>>;
  solvedHistory: Record<string, { correctCount: number; attemptCount: number }>;
  setSolvedHistory: React.Dispatch<React.SetStateAction<Record<string, { correctCount: number; attemptCount: number }>>>;
  setStats: React.Dispatch<React.SetStateAction<UserStats>>;
  onBackToDashboard: () => void;
  updateRankingScore: (points: number) => void;
  questionCount?: number;
  srsData?: Record<string, SrsState>;
  /** 教材の語義の問題（間隔反復・今日の目標・学習カレンダー） */
  recordAnswer?: (wordId: string, isCorrect: boolean) => void;
  /** 別の語義の問題（今日の目標・学習カレンダーだけ） */
  recordPractice?: (isCorrect: boolean) => void;
}

const speak = (text: string) => {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch {
    // 読み上げが使えなくても解ける
  }
};

/** 例文の対象の語を強調して見せる */
export function SenseExampleText({ example, className = "" }: { example: string; className?: string }) {
  const parsed = parseSenseExample(example);
  if (!parsed) return <span className={className}>{plainSenseExample(example)}</span>;
  return (
    <span className={className}>
      {parsed.before}
      <mark className="bg-transparent text-indigo-800 font-black underline decoration-2 underline-offset-4">
        {parsed.target}
      </mark>
      {parsed.after}
    </span>
  );
}

export default function SenseQuiz({
  level,
  vocabulary,
  setWrongWords,
  solvedHistory,
  setSolvedHistory,
  setStats,
  onBackToDashboard,
  updateRankingScore,
  questionCount = 10,
  srsData = {},
  recordAnswer,
  recordPractice
}: SenseQuizProps) {
  const [questions, setQuestions] = useState<SenseQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 出題を作り直した回数。枠の key にして、解答の状態ごと作り直す（ChoiceQuiz.tsx を参照） */
  const [round, setRound] = useState(0);

  // 解答のたびに変わる記録は ref で読む（依存に入れると途中で問題が作り直される）
  const historyRef = useRef(solvedHistory);
  historyRef.current = solvedHistory;
  const srsRef = useRef(srsData);
  srsRef.current = srsData;

  const prepare = useCallback(() => {
    setQuestions(null);
    loadSenseQuiz()
      .then(items => {
        setError(null);
        setRound(r => r + 1);
        setQuestions(buildSenseQuestions({
          items, vocabulary, level, count: questionCount,
          solvedHistory: historyRef.current, srsData: srsRef.current
        }));
      })
      .catch(() => setError("語義分別クイズのデータを読み込めませんでした。通信の状態を確かめて、もう一度開いてください。"));
  }, [level, vocabulary, questionCount]);

  useEffect(() => { prepare(); }, [prepare]);

  const onAnswer = (q: SenseQuestion, isCorrect: boolean) => {
    if (!asksTaughtSense(q)) {
      recordPractice?.(isCorrect);
      return;
    }
    recordAnswer?.(q.word.id, isCorrect);
    setSolvedHistory(prev => {
      const e = prev[q.word.id] || { correctCount: 0, attemptCount: 0 };
      return { ...prev, [q.word.id]: { correctCount: e.correctCount + (isCorrect ? 1 : 0), attemptCount: e.attemptCount + 1 } };
    });
    if (!isCorrect) {
      setWrongWords(prev => (prev.includes(q.word.id) ? prev : [...prev, q.word.id]));
    }
  };

  return (
    // key が変わると中身ごと作り直される（解答の状態も同じ描画で初めからになる）
    <React.Fragment key={round}>
      <ChoiceQuiz<SenseQuestion>
        title="語義分別クイズ"
        instruction="文の中での意味を選ぶ"
        level={level}
        questions={questions}
        error={error}
        emptyMessage="このレベルには、語義分別クイズに出せる語がまだありません。"
        renderPrompt={q => {
          const sense = q.item.senses[q.senseIndex];
          return (
            <div className="space-y-3">
              <div className="flex items-start justify-center gap-2">
                <p className="text-lg md:text-xl font-bold text-gray-900 leading-relaxed" id="sense_prompt_sentence" lang="en">
                  <SenseExampleText example={sense.example} />
                </p>
                <button
                  onClick={() => speak(plainSenseExample(sense.example))}
                  className="shrink-0 p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition"
                  title="英文を聴く"
                  aria-label="英文を聴く"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm font-bold text-gray-700">
                この文の <span className="font-mono font-black">{q.word.word}</span> の意味はどれ？
              </p>
            </div>
          );
        }}
        renderExplanation={q => {
          const sense = q.item.senses[q.senseIndex];
          return (
            <>
              <p className="font-bold">{sense.translation}</p>
              <div className="border-t border-gray-200 pt-2 space-y-1.5">
                <p className="text-xs font-black text-gray-700">{q.word.word} のほかの意味</p>
                <ul className="space-y-1.5">
                  {q.item.senses.map((s, i) => i === q.senseIndex ? null : (
                    <li key={s.meaning} className="text-xs text-gray-800 leading-relaxed">
                      <span className="font-black">{s.meaning}</span>
                      {"："}
                      <SenseExampleText example={s.example} className="font-mono" />
                      <span className="block text-gray-700">{s.translation}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {!asksTaughtSense(q) && (
                <p className="text-xs text-gray-700">
                  この語義は単語帳で教えている意味（{q.item.senses[0].meaning}）とは別なので、
                  復習の予定には入れず、今日の学習量にだけ数えています。
                </p>
              )}
            </>
          );
        }}
        renderReviewItem={q => {
          const sense = q.item.senses[q.senseIndex];
          return (
            <>
              <p className="text-sm text-gray-900" lang="en">
                <SenseExampleText example={sense.example} />
              </p>
              <p className="text-xs text-gray-700">{q.word.word}：{sense.meaning}</p>
            </>
          );
        }}
        onAnswer={onAnswer}
        setStats={setStats}
        updateRankingScore={updateRankingScore}
        onRetry={prepare}
        onBack={onBackToDashboard}
      />
    </React.Fragment>
  );
}
