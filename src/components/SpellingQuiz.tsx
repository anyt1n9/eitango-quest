import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Check, X, Award, Trophy, Volume2, Loader2, RotateCcw, Lightbulb, Keyboard } from "lucide-react";
import { Level, Word, UserStats } from "../types";
import { getAudioContext } from "../sound";
import { SrsState } from "../srs";
import { selectQuizWords } from "../selectQuestions";
import { isSpellingCorrect, diffChars } from "../spelling";
import { shuffle } from "../shuffle";
import { canSpell } from "../quizFormats";

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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (judged !== null || !currentQuestion) return;
    if (input.trim() === "") return;

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
    setStats(prev => ({
      ...prev,
      completedQuestions: prev.completedQuestions + questions.length,
      correctAnswers: prev.correctAnswers + finalScore,
      score: prev.score + addedPoints
    }));
  };

  const handleRetry = () => {
    setQuestions(prepareQuestions());
    setCurrentIndex(0);
    setInput("");
    setJudged(null);
    setShowHint(false);
    setScore(0);
    setDetails([]);
    setIsFinished(false);
  };

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border shadow-sm">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="mt-3 text-sm text-gray-500 font-medium">綴りクイズの準備をしています...</span>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-6" id="spelling_result_card">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center mx-auto shadow-md">
              <Award className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">綴りクイズ完了！</h2>
            <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">spelling challenge result</p>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 flex justify-around text-center">
            <div>
              <span className="text-xs text-gray-400 font-bold">正解数</span>
              <p className="text-3xl font-black text-indigo-700 mt-1 font-mono">
                {score} <span className="text-xs text-gray-400 font-bold">/ {questions.length}</span>
              </p>
            </div>
            <div className="border-r border-gray-200" />
            <div>
              <span className="text-xs text-gray-400 font-bold">獲得スコア</span>
              <p className="text-3xl font-black text-emerald-600 mt-1 font-mono">
                +{score * 50 + (score === questions.length ? 250 : 0)}{" "}
                <span className="text-xs text-gray-400 font-bold">P</span>
              </p>
            </div>
          </div>

          {score === questions.length && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center text-amber-900 font-bold text-sm flex items-center justify-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500 fill-amber-300" />
              <span>全問正解！特別ボーナス +250 P 贈呈！ 🎉</span>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-gray-700">書けなかった単語の振り返り</h3>
            <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1.5 border border-gray-150 p-2.5 rounded-2xl shadow-inner">
              {details.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 border rounded-xl ${
                    item.isCorrect ? "bg-emerald-50/40 border-emerald-100" : "bg-rose-50/40 border-rose-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm font-mono text-gray-900 select-all">{item.word.word}</span>
                    {item.isCorrect ? (
                      <span className="text-emerald-600 font-bold text-xs bg-emerald-100/60 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-3" />
                        <span>正解</span>
                      </span>
                    ) : (
                      <span className="text-rose-600 font-bold text-xs bg-rose-100/60 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <X className="w-3 h-3 stroke-3" />
                        <span>誤答</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-medium mt-1">意味: {item.word.translation}</p>
                  {!item.isCorrect && (
                    <p className="text-xs text-rose-700 font-bold mt-0.5 font-mono">あなたの入力: {item.userInput}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={handleRetry}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-10 py-3.5 rounded-2xl shadow cursor-pointer transition text-sm flex items-center justify-center gap-2"
              id="btn_retry_spelling"
            >
              <RotateCcw className="w-4 h-4" />
              <span>もう一度挑戦する</span>
            </button>
            <button
              onClick={onBackToDashboard}
              className="bg-white hover:bg-gray-50 text-gray-700 font-extrabold px-10 py-3.5 rounded-2xl border border-gray-200 shadow-2xs cursor-pointer transition text-sm"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
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
      <div className="bg-white border rounded-3xl p-6 shadow-sm" id="spelling_running_card">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition py-2"
            id="btn_quit_spelling"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>中断して戻る</span>
          </button>
          <div className="bg-gray-100 px-3.5 py-1.5 rounded-full text-xs font-black font-mono text-indigo-700">
            Q: {currentIndex + 1} / {questions.length}
          </div>
        </div>

        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-8">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        <div className="text-center space-y-4 mb-8">
          <span className="text-xs font-black uppercase tracking-wider text-indigo-500 font-mono flex items-center justify-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5" />
            {reviewMode ? "🔁 復習 — 日本語訳から英単語を書く" : "日本語訳から英単語を書く"}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {currentQuestion.translation}
          </h2>
          <p className="text-sm text-gray-500 font-medium">
            {currentQuestion.sentence.replace("[_____]", "＿＿＿")}
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
            className={`w-full text-center text-2xl font-mono font-black tracking-wide px-4 py-4 rounded-2xl border-2 transition outline-none ${
              judged === "correct"
                ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                : judged === "incorrect"
                ? "border-rose-300 bg-rose-50 text-rose-900"
                : "border-gray-200 focus:border-indigo-500 bg-gray-50"
            }`}
            id="spelling_input"
          />

          {judged === null ? (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setShowHint(true)}
                className="sm:w-auto px-5 py-3 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                id="btn_spelling_hint"
              >
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>ヒントを見る</span>
              </button>
              <button
                type="submit"
                disabled={input.trim() === ""}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-extrabold py-3 rounded-2xl shadow transition cursor-pointer text-sm"
                id="btn_spelling_submit"
              >
                答え合わせ
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-2xl shadow transition cursor-pointer text-sm"
              id="btn_spelling_next"
            >
              {currentIndex + 1 < questions.length ? "次の問題へ ➔" : "結果を見る ➔"}
            </button>
          )}
        </form>

        {showHint && judged === null && (
          <p className="mt-4 text-center font-mono text-lg text-amber-700 tracking-widest bg-amber-50 border border-amber-200 rounded-2xl py-3">
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
              className={`mt-5 rounded-2xl p-4 border text-center ${
                judged === "correct" ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
              }`}
            >
              {judged === "correct" ? (
                <p className="text-emerald-800 font-black text-sm flex items-center justify-center gap-2">
                  <Check className="w-5 h-5 stroke-3" />
                  正解です！
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-rose-800 font-black text-sm flex items-center justify-center gap-2">
                    <X className="w-5 h-5 stroke-3" />
                    おしい！正しい綴りはこちら
                  </p>
                  {/* どの文字から間違えたかが分かるように、入力を1文字ずつ色分けする */}
                  <p className="font-mono text-sm">
                    {diffChars(input, answer).map((c, i) => (
                      // 間違えた文字は rose-600 だと明るい背景に対して比 4.12 で基準に届かない
                      <span key={i} className={c.ok ? "text-gray-500" : "text-rose-700 font-black underline"}>
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
                <span className="font-mono font-black text-xl md:text-2xl tracking-wide text-gray-900 select-all">
                  {answer}
                </span>
                <button
                  type="button"
                  onClick={() => speak(answer)}
                  className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition cursor-pointer"
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
