import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Check, X, Volume2, Loader2, Lightbulb } from "lucide-react";
import { Level, Word, UserStats } from "../types";
import { getAudioContext } from "../sound";
import { QuizTopBar, QuizPrompt } from "./QuizParts";
import { SrsState } from "../srs";
import { selectQuizWords } from "../selectQuestions";
import { isSpellingCorrect, diffChars } from "../spelling";
import { shuffle } from "../shuffle";
import { canSpell } from "../quizFormats";
import { toFillInSentence, showHoles } from "../fillIn";
import { LEVEL_LABELS } from "../levelLabels";
import QuizResult from "./QuizResult";

/**
 * 綴り入力クイズ。
 *
 * 他の3つのクイズ（一問一答・例文穴埋め・復習テスト）はいずれも四択の
 * 受容テストで、産出（自分で綴りを書く）練習が無かった。
 * ここでは日本語訳と例文を手がかりに、英単語そのものを入力してもらう。
 */

const playSpellSound = (isCorrect: boolean) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (isCorrect) {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    }
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn("Audio contexts blocked or not supported.");
  }
};

// 判定ロジックは src/spelling.ts に置いてある（テストから画面を読み込まずに検証するため）
export { isSpellingCorrect, diffChars };

interface SpellingQuizProps {
  level: Level;
  vocabulary: Word[];
  wrongWords: string[];
  setWrongWords: React.Dispatch<React.SetStateAction<string[]>>;
  solvedHistory: Record<string, { correctCount: number; attemptCount: number }>;
  setSolvedHistory: React.Dispatch<React.SetStateAction<Record<string, { correctCount: number; attemptCount: number }>>>;
  setStats: React.Dispatch<React.SetStateAction<UserStats>>;
  onBackToDashboard: () => void;
  updateRankingScore: (points: number) => void;
  questionCount?: number;
  // 復習セッション用: 指定された単語のみを出題する（レベルフィルタを上書きする）
  customWords?: Word[];
  // 復習セッションかどうか（表示文言の切り替え用）
  reviewMode?: boolean;
  srsData?: Record<string, SrsState>;
  recordAnswer?: (wordId: string, isCorrect: boolean) => void;
}

export default function SpellingQuiz({
  level,
  vocabulary,
  wrongWords,
  setWrongWords,
  solvedHistory,
  setSolvedHistory,
  setStats,
  onBackToDashboard,
  updateRankingScore,
  questionCount = 10,
  customWords,
  reviewMode = false,
  srsData = {},
  recordAnswer
}: SpellingQuizProps) {
  const [questions, setQuestions] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState("");
  const [judged, setJudged] = useState<"correct" | "incorrect" | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState(0);
  const [details, setDetails] = useState<{ word: Word; userInput: string; isCorrect: boolean }[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 綴りを問うので、記号や数字の多い見出し（イディオム・文法パターン）は除く。
  // customWords が渡された場合（復習）はそれを出題プールにする
  const prepareQuestions = () => {
    const review = customWords && customWords.length > 0;
    const pool = (review ? customWords! : vocabulary.filter(w => w.level === level)).filter(canSpell);
    // 復習セッションは既に対象が絞られているので、優先度づけをせずそのまま使う
    return review
      ? shuffle(pool).slice(0, Math.min(questionCount, pool.length))
      : selectQuizWords({ pool, count: questionCount, solvedHistory, srsData });
  };

  // 出題対象は「中身」で見る。配列の同一性で見ると、呼び出し側が毎回
  // 新しい配列を作るだけで出題し直しになり、解答の途中で問題が入れ替わる
  const customWordsKey = (customWords || []).map(w => w.id).join(",");

  useEffect(() => {
    setQuestions(prepareQuestions());
  }, [level, vocabulary, questionCount, customWordsKey]);

  const currentQuestion = questions[currentIndex];

  // 出題のたびに入力欄へフォーカスする
  useEffect(() => {
    if (currentQuestion && !isFinished && judged === null) {
      inputRef.current?.focus();
    }
  }, [currentIndex, currentQuestion, isFinished, judged]);

  const speak = (text: string) => {
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      console.warn("Speech synthesis error", e);
    }
  };

  /*
   * 解答の二度押しを同期的に止める。
   *
   * 「一度答えたら選び直せない」は state で守っているが、state が効くのは
   * 再描画のあとなので、同じ瞬間に2回押されると（スマホのダブルタップなど）両方が通る。
   * 解答の記録は学習データそのもので、1回の解答が2回分として記録されると
   * 間隔反復の箱が2段上がり、まだ覚えていない語が「習得済み」になる。
   * 別の選択肢を続けて押した場合は、両方が解答として記録される。
   * state の解答状態を消すのと同じ場所で、この印も消す（次の問題では押せるように）。
   */
  const answeredRef = useRef(false);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (answeredRef.current || judged !== null || !currentQuestion) return;
    if (input.trim() === "") return; // 空のまま送っても、解答済みにはしない
    answeredRef.current = true;

    const isCorrect = isSpellingCorrect(input, currentQuestion.word);
    playSpellSound(isCorrect);
    setJudged(isCorrect ? "correct" : "incorrect");
    // 正解の綴りを耳でも確認できるように読み上げる
    speak(currentQuestion.word);

    recordAnswer?.(currentQuestion.id, isCorrect);

    setSolvedHistory(prev => {
      const existing = prev[currentQuestion.id] || { correctCount: 0, attemptCount: 0 };
      return {
        ...prev,
        [currentQuestion.id]: {
          correctCount: existing.correctCount + (isCorrect ? 1 : 0),
          attemptCount: existing.attemptCount + 1
        }
      };
    });

    if (!isCorrect) {
      setWrongWords(prev => (prev.includes(currentQuestion.id) ? prev : [...prev, currentQuestion.id]));
    } else {
      setScore(prev => prev + 1);
    }

    setDetails(prev => [...prev, { word: currentQuestion, userInput: input.trim(), isCorrect }]);
  };

  const handleNext = () => {
    // 「次の問題へ」の二度押しで1問飛ばさない（最後の問題なら点数を二重に足さない）。
    // state の judged が効くのは再描画のあとなので、解答の印で同期的に止める
    if (!answeredRef.current) return;
    answeredRef.current = false;
    const finalScore = score;
    setJudged(null);
    setInput("");
    setShowHint(false);
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      finishQuiz(finalScore);
    }
  };

  const finishQuiz = (finalScore: number) => {
    setIsFinished(true);
    // 綴りを書く問題は四択より難しいので1問50P、パーフェクトボーナス250P
    const addedPoints = finalScore * 50 + (finalScore === questions.length ? 250 : 0);
    updateRankingScore(addedPoints);
    // 回答数・正答数は1問ごとに App（recordPractice）が数える。ここで足すと二重になる
    setStats(prev => ({
      ...prev,
      score: prev.score + addedPoints
    }));
  };

  const handleRetry = () => {
    setQuestions(prepareQuestions());
    setCurrentIndex(0);
    setInput("");
    setJudged(null);
    answeredRef.current = false;
    setShowHint(false);
    setScore(0);
    setDetails([]);
    setIsFinished(false);
  };

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border shadow-sm">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="mt-3 text-sm text-gray-500 font-medium">綴りクイズの準備をしています...</span>
      </div>
    );
  }

  if (isFinished) {
    const perfect = score === questions.length;
    return (
      <div className="max-w-xl mx-auto">
        <QuizResult
          id="spelling_result_card"
          title="綴りクイズ完了！"
          subtitle={reviewMode ? "復習・綴りを書く" : `${LEVEL_LABELS[level]}・綴りを書く`}
          score={score}
          total={questions.length}
          // 綴りを書く問題は四択より難しいので1問50P、全問正解で250P
          points={score * 50 + (perfect ? 250 : 0)}
          perfectBonus={250}
          reviewTitle="書いた単語の振り返り"
          items={details.map((item, idx) => ({
            key: `${idx}_${item.word.id}`,
            isCorrect: item.isCorrect,
            content: (
              <>
                <span className="block font-bold text-sm text-gray-900 select-all">{item.word.word}</span>
                <p className="text-xs text-gray-600 font-medium">意味: {item.word.translation}</p>
                {!item.isCorrect && (
                  <p className="text-xs text-rose-700 font-bold">あなたの入力: {item.userInput}</p>
                )}
              </>
            )
          }))}
          onRetry={handleRetry}
          onBack={onBackToDashboard}
          retryId="btn_retry_spelling"
          backId="btn_back_dashboard_from_spelling"
        />
      </div>
    );
  }

  const answer = currentQuestion.word;
  // ヒント: 最初の1文字と語の長さ（例: "e _ _ _ _ _ _ _"）
  const hintText = answer
    .split("")
    .map((c, i) => (i === 0 || c === " " || c === "-" ? c : "_"))
    .join(" ");

  return (
    <div className="max-w-xl mx-auto space-y-6" id="spelling_quiz_root">
      <div id="spelling_running_card">
        <QuizTopBar index={currentIndex} total={questions.length} onQuit={onBackToDashboard} quitId="btn_quit_spelling" />

        <div className="text-center flex flex-col items-center gap-3 mt-8 mb-8 px-2">
          <QuizPrompt>{reviewMode ? "復習・日本語訳に合う英単語を書いてください" : "日本語訳に合う英単語を書いてください"}</QuizPrompt>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            {currentQuestion.translation}
          </h2>
          <p className="font-headword text-base text-gray-600" lang="en">
            {/* 例文は手がかりとして出すので、答えは必ず伏せる。
                取り込んだ単語には答えの残った例文がある */}
            {showHoles(toFillInSentence(currentQuestion.sentence, currentQuestion.word))}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={judged !== null}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="英単語を入力"
            aria-label="英単語を入力"
            className={`w-full text-center text-2xl font-mono font-bold tracking-wide px-4 py-4 rounded-xl border-2 transition outline-none ${
              judged === "correct"
                ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                : judged === "incorrect"
                ? "border-rose-300 bg-rose-50 text-rose-900"
                : "border-gray-200 focus:border-indigo-500 bg-white"
            }`}
            id="spelling_input"
          />

          {judged === null ? (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setShowHint(true)}
                className="sm:w-auto min-h-12 px-5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 font-medium text-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                id="btn_spelling_hint"
              >
                <Lightbulb className="w-4 h-4 text-gray-500" aria-hidden="true" />
                <span>ヒントを見る</span>
              </button>
              <button
                type="submit"
                disabled={input.trim() === ""}
                className="flex-1 min-h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl transition cursor-pointer text-base"
                id="btn_spelling_submit"
              >
                答え合わせ
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="w-full min-h-13 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition cursor-pointer text-base flex items-center justify-center gap-2"
              id="btn_spelling_next"
            >
              <span>{currentIndex + 1 < questions.length ? "次の問題へ" : "結果を見る"}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </form>

        {showHint && judged === null && (
          <p className="mt-4 text-center font-mono text-lg text-amber-800 tracking-widest bg-amber-50 border border-amber-200 rounded-xl py-3">
            {hintText}
          </p>
        )}

        <AnimatePresence>
          {judged !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              // 正誤とその理由（正しい綴り）を読み上げにも伝える
              role="status"
              aria-live="polite"
              className={`mt-5 rounded-xl p-4 border text-center ${
                judged === "correct" ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
              }`}
            >
              {judged === "correct" ? (
                <p className="text-emerald-800 font-bold text-sm flex items-center justify-center gap-2">
                  <Check className="w-5 h-5 stroke-3" />
                  正解です！
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-rose-800 font-bold text-sm flex items-center justify-center gap-2">
                    <X className="w-5 h-5 stroke-3" />
                    おしい！正しい綴りはこちら
                  </p>
                  {/* どの文字から間違えたかが分かるように、入力を1文字ずつ色分けする */}
                  <p className="font-mono text-sm">
                    {diffChars(input, answer).map((c, i) => (
                      // 間違えた文字は rose-600 だと明るい背景に対して比 4.12 で基準に届かない
                      <span key={i} className={c.ok ? "text-gray-500" : "text-rose-700 font-bold underline"}>
                        {c.ch}
                      </span>
                    ))}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-center gap-2 mt-2">
                {/* いちばん読ませたい「正しい綴り」。周りより大きく、太く、はっきり出す */}
                {/* dark: を足してはいけない。このアプリの暗いテーマは
                    index.css で色の変数そのものを置き換えており、
                    text-gray-900 は暗いテーマでは自動的に明るい色になる。
                    dark:text-slate-50 と書くと --color-slate-50 が
                    暗い紺（#020617）に置き換わっているので、逆に読めなくなる */}
                <span className="font-mono font-bold text-xl md:text-2xl tracking-wide text-gray-900 select-all" id="spelling_correct_answer">
                  {answer}
                </span>
                <button
                  type="button"
                  onClick={() => speak(answer)}
                  className="w-11 h-11 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-full flex items-center justify-center transition cursor-pointer"
                  aria-label="発音を聴く"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
