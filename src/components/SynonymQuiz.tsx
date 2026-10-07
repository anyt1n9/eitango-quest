import React, { useCallback, useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { Level, UserStats, Word } from "../types";
import { SrsState } from "../srs";
import { buildSynonymQuestions, loadSynonyms, SynonymQuestion } from "../synonyms";
import ChoiceQuiz from "./ChoiceQuiz";

/**
 * 類義語クイズ。英単語を見て、同じ意味の英単語を選ぶ。
 *
 * 訳語を1つずつ覚えるだけだと、英文を読んで big と large が同じことを言っていると
 * 結び付かない。言い換えに気づけることは読解でも英作文でも要るので、
 * 「訳を介さずに英語どうしをつなぐ」練習として置く。
 *
 * 組は WordNet と教材の訳の両方で裏付けたもの（scripts/bake_synonyms.ts）。
 */

interface SynonymQuizProps {
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
  recordAnswer?: (wordId: string, isCorrect: boolean) => void;
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

export default function SynonymQuiz({
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
  recordAnswer
}: SynonymQuizProps) {
  const [questions, setQuestions] = useState<SynonymQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 出題を作り直した回数。枠の key にして、解答の状態ごと作り直す（ChoiceQuiz.tsx を参照） */
  const [round, setRound] = useState(0);

  // 出題の重み付けに使う記録は、解答のたびに変わる。依存に入れると
  // 解いている途中で問題が作り直されるので、最新の値を ref で読む
  const historyRef = useRef(solvedHistory);
  historyRef.current = solvedHistory;
  const srsRef = useRef(srsData);
  srsRef.current = srsData;

  const prepare = useCallback(() => {
    setQuestions(null);
    loadSynonyms()
      .then(table => {
        setError(null);
        setRound(r => r + 1);
        setQuestions(buildSynonymQuestions({
          table, vocabulary, level, count: questionCount,
          solvedHistory: historyRef.current, srsData: srsRef.current
        }));
      })
      .catch(() => setError("類義語のデータを読み込めませんでした。通信の状態を確かめて、もう一度開いてください。"));
  }, [level, vocabulary, questionCount]);

  useEffect(() => { prepare(); }, [prepare]);

  const onAnswer = (q: SynonymQuestion, isCorrect: boolean) => {
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
      <ChoiceQuiz<SynonymQuestion>
        title="類義語クイズ"
        instruction="同じ意味の語を選ぶ"
        level={level}
        questions={questions}
        error={error}
        emptyMessage="このレベルには、類義語クイズに出せる語がまだありません。"
        englishOptions
        renderPrompt={q => (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-3">
              <h2 className="text-4xl font-black text-gray-900 tracking-tight" id="synonym_prompt_word">{q.word.word}</h2>
              <button
                onClick={() => speak(q.word.word)}
                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition"
                title="発音を聴く"
                aria-label={`${q.word.word} の発音を聴く`}
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm font-bold text-gray-700">この語と同じ意味の語はどれ？</p>
          </div>
        )}
        renderExplanation={(q, choice) => {
          const chosen = q.optionWords[choice];
          return (
            <>
              <p>
                <span className="font-black font-mono">{q.word.word}</span>（{q.word.translation}）
                {" ＝ "}
                <span className="font-black font-mono">{q.answerWord.word}</span>（{q.answerWord.translation}）
              </p>
              {q.others.length > 0 && (
                <p className="text-gray-700">
                  ほかにも同じ意味：{q.others.map(w => `${w.word}（${w.translation}）`).join("、")}
                </p>
              )}
              {chosen && choice !== q.answer && (
                <p className="text-gray-700">
                  選んだ <span className="font-mono font-bold">{chosen.word}</span> は「{chosen.translation}」という意味です。
                </p>
              )}
            </>
          );
        }}
        renderReviewItem={q => (
          <>
            <p className="text-sm font-bold text-gray-900">
              <span className="font-mono">{q.word.word}</span> ＝ <span className="font-mono">{q.answerWord.word}</span>
            </p>
            <p className="text-xs text-gray-700">{q.word.translation} ／ {q.answerWord.translation}</p>
          </>
        )}
        onAnswer={onAnswer}
        setStats={setStats}
        updateRankingScore={updateRankingScore}
        onRetry={prepare}
        onBack={onBackToDashboard}
      />
    </React.Fragment>
  );
}
