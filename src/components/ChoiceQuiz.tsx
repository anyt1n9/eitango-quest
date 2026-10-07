import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Award, Check, Loader2, RotateCcw, Trophy, X } from "lucide-react";
import { Level, UserStats } from "../types";
import { LEVEL_LABELS } from "../grammar";
import { getAudioContext } from "../sound";

/**
 * 選択式クイズの共通の枠（類義語クイズ・語義分別クイズが使う）。
 *
 * 2つとも「問いを見て、選択肢から1つ選び、解説を読んで次へ」という流れで、
 * 違うのは問いと解説の中身だけなので、流れ（解答・記録・結果）はここにまとめる。
 *
 * 四択クイズと違い、答えたあと自動では次へ進まない。この2つは解説
 * （同じ意味の語の一覧、例文の和訳と他の語義）を読むこと自体が学習なので、
 * 数秒で消えると読み切れない。「次へ」を押すまで出しておく。
 */

export interface ChoiceQuestion {
  /** 結果一覧のキー */
  key: string;
  options: string[];
  answer: string;
}

interface ChoiceQuizProps<Q extends ChoiceQuestion> {
  /** 画面の見出し（「類義語クイズ」） */
  title: string;
  /** 問いの上に出す短い指示（「同じ意味の語を選ぶ」） */
  instruction: string;
  level: Level;
  /** null は準備中 */
  questions: Q[] | null;
  /** データを読み込めなかったときの理由 */
  error?: string | null;
  /** そのレベルで出せる問題が1つも無いときの文言 */
  emptyMessage: string;
  /** 選択肢が英単語か（等幅で見せる） */
  englishOptions?: boolean;
  renderPrompt: (q: Q) => React.ReactNode;
  /** 答えたあとに出す解説 */
  renderExplanation: (q: Q, choice: string) => React.ReactNode;
  /** 結果一覧の1行ぶんの中身 */
  renderReviewItem: (q: Q, choice: string) => React.ReactNode;
  /** 解答1件ごとの記録（間隔反復・苦手単語・学習の記録は呼び出し側が決める） */
  onAnswer: (q: Q, isCorrect: boolean) => void;
  setStats: React.Dispatch<React.SetStateAction<UserStats>>;
  updateRankingScore: (points: number) => void;
  /** もう一度挑戦するときに、出題を作り直す */
  onRetry: () => void;
  onBack: () => void;
}

const playSound = (isCorrect: boolean) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isCorrect ? "sine" : "sawtooth";
    osc.frequency.setValueAtTime(isCorrect ? 523.25 : 120, ctx.currentTime);
    if (isCorrect) osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // 音が鳴らせない環境でも解答は続けられる
  }
};

/** 正解数から獲得ポイントを出す（四択などと同じ：1問30P、全問正解で150P） */
export function choiceQuizPoints(score: number, total: number): number {
  return score * 30 + (total > 0 && score === total ? 150 : 0);
}

export default function ChoiceQuiz<Q extends ChoiceQuestion>({
  title,
  instruction,
  level,
  questions,
  error,
  emptyMessage,
  englishOptions = false,
  renderPrompt,
  renderExplanation,
  renderReviewItem,
  onAnswer,
  setStats,
  updateRankingScore,
  onRetry,
  onBack
}: ChoiceQuizProps<Q>) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [results, setResults] = useState<{ question: Q; choice: string; isCorrect: boolean }[]>([]);
  const [finished, setFinished] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  /*
   * 解答の二度押しを同期的に止める（Quiz.tsx と同じ理由）。
   * state の choice が効くのは再描画のあとなので、ダブルタップの2回目も通ってしまい、
   * 1回の解答が2回分として記録される（間隔反復の箱が2段上がる）。
   * choice を消すのと同じ場所でこの印も消す。
   */
  const answeredRef = useRef(false);
  /** 結果の確定（ポイントの加算）も1回だけにする */
  const finishedRef = useRef(false);

  // 出題が作り直されたら最初から
  useEffect(() => {
    setIndex(0);
    setChoice(null);
    answeredRef.current = false;
    setResults([]);
    setFinished(false);
    finishedRef.current = false;
  }, [questions]);

  const current = questions && questions.length > 0 ? questions[index] : null;

  const handleSelect = (option: string) => {
    if (!current || answeredRef.current || choice !== null) return;
    answeredRef.current = true;
    const isCorrect = option === current.answer;
    setChoice(option);
    setResults(prev => [...prev, { question: current, choice: option, isCorrect }]);
    playSound(isCorrect);
    onAnswer(current, isCorrect);
  };

  const handleNext = () => {
    // 「次へ」の二度押しで1問飛ばさないよう、解答の印で見る（state の choice は再描画まで残る）
    if (!questions || choice === null || !answeredRef.current) return;
    if (index + 1 < questions.length) {
      setIndex(i => i + 1);
      setChoice(null);
      answeredRef.current = false;
      return;
    }
    if (finishedRef.current) return;
    finishedRef.current = true;
    const score = results.filter(r => r.isCorrect).length;
    const points = choiceQuizPoints(score, questions.length);
    updateRankingScore(points);
    setStats(prev => ({
      ...prev,
      completedQuestions: prev.completedQuestions + questions.length,
      correctAnswers: prev.correctAnswers + score,
      score: prev.score + points
    }));
    setFinished(true);
  };

  // 答えたら「次へ」に移る。キーボードで解いている人が Enter で進めるように
  useEffect(() => {
    if (choice !== null) nextRef.current?.focus();
  }, [choice]);

  // 数字キー（1〜）で選ぶ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || finished || choice !== null) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      const option = current.options[n - 1];
      if (option === undefined) return;
      e.preventDefault();
      handleSelect(option);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const header = (
    <div className="flex items-center justify-between mb-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition min-h-11"
        id="btn_quit_quiz"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>中断して戻る</span>
      </button>
      {questions && questions.length > 0 && !finished && (
        <div className="bg-gray-100 px-3.5 py-1.5 rounded-full text-xs font-black font-mono text-indigo-700">
          Q: {index + 1} / {questions.length}
        </div>
      )}
    </div>
  );

  if (error) {
    return (
      <div className="max-w-xl mx-auto" id="quiz_section_root">
        <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-4">
          {header}
          <p className="text-sm font-bold text-gray-800" role="alert">{error}</p>
        </div>
      </div>
    );
  }

  if (!questions) {
    return (
      <div className="max-w-xl mx-auto flex flex-col items-center justify-center py-20 bg-white rounded-3xl border shadow-sm gap-3" id="quiz_section_root">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-sm text-gray-600 font-medium">{title}の準備をしています...</span>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-xl mx-auto" id="quiz_section_root">
        <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-4">
          {header}
          <p className="text-sm font-bold text-gray-800">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  if (finished) {
    const score = results.filter(r => r.isCorrect).length;
    const points = choiceQuizPoints(score, questions.length);
    return (
      <div className="max-w-xl mx-auto" id="quiz_section_root">
        <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-6" id="quiz_result_card">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center mx-auto shadow-md">
              <Award className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">{title} 完了！</h2>
            <p className="text-xs text-gray-600 font-bold">{LEVEL_LABELS[level]}</p>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 flex justify-around text-center">
            <div>
              <span className="text-xs text-gray-600 font-bold">正解数</span>
              <p className="text-3xl font-black text-indigo-700 mt-1 font-mono">
                {score} <span className="text-xs text-gray-600 font-bold">/ {questions.length}</span>
              </p>
            </div>
            <div className="border-r border-gray-200" />
            <div>
              <span className="text-xs text-gray-600 font-bold">獲得スコア</span>
              <p className="text-3xl font-black text-emerald-700 mt-1 font-mono">
                +{points} <span className="text-xs text-gray-600 font-bold">P</span>
              </p>
            </div>
          </div>

          {score === questions.length && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center text-amber-900 font-bold text-sm flex items-center justify-center gap-2">
              <Trophy className="w-5 h-5 text-amber-700" aria-hidden="true" />
              <span>パーフェクト達成！ボーナス +150 P</span>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-gray-800">振り返り</h3>
            <ul className="max-h-80 overflow-y-auto space-y-2.5 pr-1" id="quiz_mini_review_pool">
              {results.map(r => (
                <li
                  key={r.question.key}
                  className={`p-3.5 border rounded-xl flex items-start justify-between gap-3 ${
                    r.isCorrect ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
                  }`}
                >
                  <div className="min-w-0 space-y-1">{renderReviewItem(r.question, r.choice)}</div>
                  {r.isCorrect ? (
                    <span className="shrink-0 text-emerald-800 font-bold text-xs bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" aria-hidden="true" />
                      <span>正解</span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-rose-800 font-bold text-xs bg-rose-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <X className="w-3 h-3" aria-hidden="true" />
                      <span>誤答</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={onRetry}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-8 py-3.5 rounded-2xl shadow transition text-sm flex items-center justify-center gap-2"
              id="btn_retry_quiz"
            >
              <RotateCcw className="w-4 h-4" />
              <span>もう一度挑戦する</span>
            </button>
            <button
              onClick={onBack}
              className="bg-white hover:bg-gray-50 text-gray-800 font-extrabold px-8 py-3.5 rounded-2xl border border-gray-200 transition text-sm"
              id="btn_back_dashboard_from_quiz"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = current!;
  const answered = choice !== null;
  const isCorrect = answered && choice === q.answer;

  return (
    <div className="max-w-xl mx-auto" id="quiz_section_root">
      <div className="bg-white border rounded-3xl p-6 shadow-sm" id="quiz_running_card">
        {header}

        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-6">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${((index + 1) / questions.length) * 100}%` }}
          />
        </div>

        <div className="text-center space-y-3 mb-6">
          <span className="text-xs font-black tracking-wider text-indigo-700">
            {title}・{instruction}
          </span>
          {renderPrompt(q)}
          <p className="text-xs text-gray-600 font-bold">{LEVEL_LABELS[level]}</p>
        </div>

        <div className="grid grid-cols-1 gap-3" id="quiz_options_container">
          {q.options.map((option, i) => {
            const selected = choice === option;
            const correct = option === q.answer;
            let tone = "bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100 hover:border-gray-300";
            if (answered) {
              if (correct) tone = "bg-emerald-50 border-emerald-400 text-emerald-900 font-black";
              else if (selected) tone = "bg-rose-50 border-rose-300 text-rose-900 font-black";
              else tone = "bg-gray-50 border-gray-100 text-gray-600";
            }
            return (
              <button
                key={option}
                id={`option_btn_${i}`}
                onClick={() => handleSelect(option)}
                disabled={answered}
                className={`border rounded-2xl p-4 text-left text-sm font-semibold transition-all flex items-center gap-3 min-h-11 ${tone}`}
              >
                <span
                  aria-hidden="true"
                  className="hidden sm:flex shrink-0 w-6 h-6 rounded-md border border-current/20 items-center justify-center text-[11px] font-mono font-black opacity-60"
                >
                  {i + 1}
                </span>
                <span data-testid="option_label" className={`flex-1 ${englishOptions ? "font-mono" : ""}`}>
                  {option}
                </span>
                {answered && correct && <Check className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />}
                {answered && selected && !correct && <X className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="mt-6 space-y-4" id="choice_quiz_feedback">
            <p
              role="status"
              aria-live="polite"
              className={`text-sm font-black ${isCorrect ? "text-emerald-800" : "text-rose-800"}`}
            >
              {isCorrect ? "正解です" : `不正解です。正解は「${q.answer}」`}
            </p>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm text-gray-800 space-y-2">
              {renderExplanation(q, choice!)}
            </div>
            <button
              ref={nextRef}
              onClick={handleNext}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-2xl shadow transition text-sm flex items-center justify-center gap-2 min-h-11"
              id="btn_next_question"
            >
              <span>{index + 1 < questions.length ? "次の問題へ" : "結果を見る"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
