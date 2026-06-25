import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Check, X, Award, HelpCircle, Trophy, Volume2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Level, Word, UserStats } from "../types";

// クイズ回答時の効果音（シンセ）
const playSentenceSound = (isCorrect: boolean) => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isCorrect) {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.warn("Audio Context error blocked.");
  }
};

interface SentenceQuizProps {
  level: Level;
  vocabulary: Word[];
  wrongWords: string[];
  setWrongWords: React.Dispatch<React.SetStateAction<string[]>>;
  solvedHistory: Record<string, { correctCount: number; attemptCount: number }>;
  setSolvedHistory: React.Dispatch<React.SetStateAction<Record<string, { correctCount: number; attemptCount: number }>>>;
  setStats: React.Dispatch<React.SetStateAction<UserStats>>;
  onBackToDashboard: () => void;
  updateRankingScore: (points: number) => void;
  // 解答1件ごとに呼ばれるコールバック（間隔反復・デイリー目標の更新用）
  recordAnswer?: (wordId: string, isCorrect: boolean) => void;
}

export default function SentenceQuiz({
  level,
  vocabulary,
  wrongWords,
  setWrongWords,
  solvedHistory,
  setSolvedHistory,
  setStats,
  onBackToDashboard,
  updateRankingScore,
  recordAnswer
}: SentenceQuizProps) {
  const [questions, setQuestions] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  // 〇・×の大きな表示用
  const [showFeedback, setShowFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  // クイズ成績
  const [score, setScore] = useState(0);
  const [details, setDetails] = useState<{ word: Word; userChoice: string; isCorrect: boolean }[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  // タイマーとスキップ管理用
  const timerRef = React.useRef<any>(null);
  const nextCallbackRef = React.useRef<(() => void) | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  // 不正解のカウントダウン処理
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // コンポーネント破棄時のクリーンアップ
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // 初期化で問題をピックアップし、各問題の4択選択肢をシャッフル
  useEffect(() => {
    const levelWords = vocabulary.filter(w => w.level === level);
    const shuffled = [...levelWords].sort(() => Math.random() - 0.5);
    const limitNum = Math.min(10, shuffled.length);
    const preparedQuestions = shuffled.slice(0, limitNum).map(q => {
      return {
        ...q,
        sentenceOptions: q.sentenceOptions ? [...q.sentenceOptions].sort(() => Math.random() - 0.5) : []
      };
    });
    setQuestions(preparedQuestions);
  }, [level, vocabulary]);

  const currentQuestion = questions[currentIndex];

  // 新しい問題に遷移した際、自動で英文を1回だけ発音する
  useEffect(() => {
    if (currentQuestion && !isFinished) {
      try {
        if ("speechSynthesis" in window) {
          const cleanText = currentQuestion.sentence.replace("[_____]", "something");
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(cleanText);
          u.lang = "en-US";
          u.rate = 0.85;
          window.speechSynthesis.speak(u);
        }
      } catch (err) {
        console.warn("Speak sentence on start error:", err);
      }
    }
  }, [currentIndex, currentQuestion, isFinished]);

  const handleSelectOption = (option: string) => {
    if (selectedOption !== null || showFeedback !== null) return;

    setSelectedOption(option);
    // 例文穴埋めの正解は、本来の英単語（currentQuestion.word）
    const isCorrect = option.toLowerCase() === currentQuestion.word.toLowerCase();

    playSentenceSound(isCorrect);
    setShowFeedback(isCorrect ? "correct" : "incorrect");

    // 間隔反復(SRS)・デイリー目標の更新
    recordAnswer?.(currentQuestion.id, isCorrect);

    // 進捗履歴と苦手単語の永続化
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
      setWrongWords(prev => {
        if (!prev.includes(currentQuestion.id)) {
          return [...prev, currentQuestion.id];
        }
        return prev;
      });
    }

    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    setDetails(prev => [
      ...prev,
      {
        word: currentQuestion,
        userChoice: option,
        isCorrect
      }
    ]);

    // 次へ移る処理（ユーザーによる即時スキップでも共通で呼べるようにクロージャとして定義）
    const onNext = () => {
      setShowFeedback(null);
      setSelectedOption(null);
      setShowTranslation(false);
      setCountdown(0);
      nextCallbackRef.current = null;
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(prev => prev + 1);
      } else {
        handleFinishQuiz(isCorrect ? score + 1 : score);
      }
    };
    nextCallbackRef.current = onNext;

    // 不正解の場合は6秒（6000ms）、正解の場合は1200ms待つ（「すぐに次に進む」で即スキップ可）
    const delay = isCorrect ? 1200 : 6000;
    if (!isCorrect) {
      setCountdown(6);
    }

    const timerId = setTimeout(() => {
      if (nextCallbackRef.current === onNext) {
        onNext();
      }
    }, delay);
    timerRef.current = timerId;
  };

  const handleForceNext = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (nextCallbackRef.current) {
      nextCallbackRef.current();
    }
  };

  const handleFinishQuiz = (finalScore: number) => {
    setIsFinished(true);

    // 例文は少し難しいので、1問あたり40P支給、パーフェクトボーナス200P
    const addedPoints = finalScore * 40 + (finalScore === questions.length ? 200 : 0);
    updateRankingScore(addedPoints);

    setStats(prev => ({
      ...prev,
      completedQuestions: prev.completedQuestions + questions.length,
      correctAnswers: prev.correctAnswers + finalScore,
      score: prev.score + addedPoints
    }));
  };

  const handleSpeakText = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if ("speechSynthesis" in window) {
        // [_____] を何かしらの単語、またはそのままポーズとして発音させるために読み上げ
        const cleanText = text.replace("[_____]", "something");
        const u = new SpeechSynthesisUtterance(cleanText);
        u.lang = "en-US";
        u.rate = 0.85;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      console.warn("TTS error", e);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border shadow-sm">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-sm text-gray-500 font-medium font-sans mt-3">例文穴埋めクイズの準備をしています...</span>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 relative" id="sentence_quiz_section_root">
      
      {/* 〇×フィードバックアニメーション */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-50 flex items-center justify-center rounded-3xl overflow-hidden backdrop-blur-xs ${
              showFeedback === "correct" ? "bg-emerald-500/10" : "bg-rose-500/10"
            }`}
          >
            {showFeedback === "correct" ? (
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1.2, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-48 h-48 rounded-full border-16 border-emerald-500 flex items-center justify-center bg-white shadow-2xl"
              >
                <span className="text-emerald-500 font-extrabold text-9xl leading-none">〇</span>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  initial={{ scale: 0, rotate: 45 }}
                  animate={{ scale: [1.2, 0.9, 1.1, 1], rotate: [0, -10, 10, 0] }}
                  exit={{ scale: 0 }}
                  transition={{ duration: 0.4 }}
                  className="w-48 h-48 rounded-full border-16 border-rose-500 flex items-center justify-center bg-white shadow-2xl"
                >
                  <span className="text-rose-500 font-extrabold text-9xl leading-none font-sans">×</span>
                </motion.div>

                {/* 不正解の場合に正解を表示する */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-slate-900/95 text-white px-6 py-3.5 rounded-2xl shadow-xl text-center max-w-sm border border-slate-800 backdrop-blur-xs flex flex-col items-center gap-1.5"
                >
                  <span className="text-[10px] text-rose-400 font-black tracking-wider uppercase">
                    正解の単語 ＆ 日本語訳
                  </span>
                  <p className="text-base font-black text-white font-mono">
                    {currentQuestion.word}
                  </p>
                  <p className="text-sm text-emerald-400 font-bold border-t border-slate-800 w-full pt-1.5 mt-1">
                    {currentQuestion.translation}
                  </p>

                  <div className="border-t border-slate-800 w-full pt-2.5 mt-1 flex flex-col items-center gap-2">
                    <span className="text-xs text-slate-300 font-semibold">
                      次の問題まで あと <span className="text-yellow-400 font-black font-mono text-sm">{countdown}</span> 秒...
                    </span>
                    <button
                      onClick={handleForceNext}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black px-4.5 py-1.5 rounded-xl transition shadow-md border border-indigo-500/40 cursor-pointer"
                    >
                      すぐに次に進む
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!isFinished ? (
        <div className="bg-white border rounded-3xl p-6 shadow-sm relative overflow-hidden" id="sentence_quiz_running_card">
          
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition"
              id="btn_quit_sentence_quiz"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>中断して戻る</span>
            </button>
            <div className="bg-gray-100 px-3.5 py-1.5 rounded-full text-xs font-black font-mono text-emerald-700">
              Q: {currentIndex + 1} / {questions.length}
            </div>
          </div>

          {/* 出題プログレス */}
          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-8">
            <div 
              className="bg-emerald-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>

          {/* 穴埋め例文の出題 */}
          <div className="space-y-6 my-6 relative bg-gray-50/50 p-6 rounded-2xl border border-gray-100 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              穴埋めに当てはまる英単語を選択
            </span>
            
            <div className="space-y-4">
              {/* 英文。穴埋め箇所を強調 */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-xl md:text-2xl font-black text-gray-800 tracking-wide leading-relaxed font-sans max-w-md antialiased break-words">
                  {currentQuestion.sentence.split("[_____]").map((part, i, arr) => (
                    <React.Fragment key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span className="inline-block px-3 py-0.5 mx-1.5 bg-yellow-100 border-2 border-dashed border-yellow-400 text-yellow-900 rounded-lg text-sm font-black font-mono animate-pulse">
                          {selectedOption ? selectedOption : "_____"}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </p>
                <button
                  onClick={(e) => handleSpeakText(currentQuestion.sentence, e)}
                  className="p-1.5 bg-white shadow-sm border hover:bg-gray-100 text-gray-600 rounded-full transition-all cursor-pointer active:scale-90"
                  title="英文発音を聴く"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {/* 日本語訳をトグルまたは薄く表示 */}
              <div className="pt-2 border-t border-gray-100 max-w-sm mx-auto">
                {showTranslation ? (
                  <p className="text-xs md:text-sm font-bold text-gray-600 leading-relaxed font-sans transition-all duration-300">
                    和訳: {currentQuestion.sentenceTranslation}
                  </p>
                ) : (
                  <button
                    onClick={() => setShowTranslation(true)}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 font-bold transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>日本語訳のヒントをみる</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 4択選択肢 (今回は英単語のため、英単語が並ぶ) */}
          <div className="grid grid-cols-2 gap-3" id="sentence_quiz_options_grid">
            {currentQuestion.sentenceOptions.map((option, idx) => {
              const isSelected = selectedOption === option;
              const isCorrectAnswer = option.toLowerCase() === currentQuestion.word.toLowerCase();

              let btnClass = "bg-white border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-gray-300";
              if (selectedOption !== null) {
                if (isSelected) {
                  btnClass = isCorrectAnswer
                    ? "bg-emerald-50 border-emerald-400 text-emerald-900 font-black shadow-inner"
                    : "bg-rose-50 border-rose-300 text-rose-900 font-black";
                } else if (isCorrectAnswer) {
                  btnClass = "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold opacity-80";
                } else {
                  btnClass = "bg-gray-100/50 border-gray-100 text-gray-400 opacity-50";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(option)}
                  disabled={selectedOption !== null}
                  className={`border rounded-2xl p-4.5 text-center text-sm font-black font-mono tracking-tight transition-all cursor-pointer ${btnClass}`}
                  id={`sentence_option_btn_${idx}`}
                >
                  {option}
                </button>
              );
            })}
          </div>

        </div>
      ) : (
        /* 例文クイズ・リザルト */
        <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-6" id="sentence_result_card">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-md">
              <Award className="w-8 h-8 font-black" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">例文穴埋め完了！</h2>
            <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">
              {level === "junior" ? "初級 (中学生)" : level === "senior" ? "中級 (高校1年)" : level === "senior2" ? "中級 (高校2年)" : level === "senior3" ? "中級 (高校3年)" : "上級 (大・社会人)"}・例文クイズリザルト
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 flex justify-around text-center my-6">
            <div>
              <span className="text-xs text-gray-400 font-bold">正解数</span>
              <p className="text-3xl font-black text-emerald-700 mt-1 font-mono">
                {score} <span className="text-xs text-gray-400 font-bold">/ {questions.length}</span>
              </p>
            </div>
            <div className="border-r border-gray-200" />
            <div>
              <span className="text-xs text-gray-400 font-bold">獲得スコア</span>
              <p className="text-3xl font-black text-indigo-700 mt-1 font-mono">
                +{score * 40 + (score === questions.length ? 200 : 0)} <span className="text-xs text-gray-400 font-bold">P</span>
              </p>
            </div>
          </div>

          {score === questions.length && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center text-amber-900 font-bold text-sm flex items-center justify-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500 fill-amber-300" />
              <span>パーフェクト！例文特別ボーナス +200 P 獲得！ 🎉</span>
            </div>
          )}

          {/* 小問レビュー */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-gray-700">英文の復習</h3>
            <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1.5 p-1 rounded-2xl border border-gray-150 shadow-inner">
              {details.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 border rounded-xl space-y-2.5 ${
                    item.isCorrect ? "bg-emerald-50/40 border-emerald-100" : "bg-rose-50/40 border-rose-100"
                  }`}
                >
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-xs font-black uppercase text-gray-400 font-mono">Q.{idx + 1}</span>
                    {item.isCorrect ? (
                      <span className="text-emerald-700 text-xs font-bold leading-none bg-emerald-100/60 px-2 py-0.5 rounded">正解</span>
                    ) : (
                      <span className="text-rose-700 text-xs font-bold leading-none bg-rose-100/60 px-2 py-0.5 rounded">誤答</span>
                    )}
                  </div>

                  <p className="text-[13px] font-semibold text-gray-800 leading-relaxed font-sans">
                    {item.word.sentence.replace("[_____]", `【 ${item.word.word} 】`)}
                  </p>
                  <p className="text-xs text-gray-500 font-semibold leading-relaxed">
                    訳: {item.word.sentenceTranslation}
                  </p>
                  {!item.isCorrect && (
                    <p className="text-xs text-rose-700 font-black">
                      あなたの誤回答: {item.userChoice} (正解: {item.word.word})
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-center">
            <button
              onClick={onBackToDashboard}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-10 py-3.5 rounded-2xl shadow transition cursor-pointer text-sm"
              id="btn_back_dashboard_from_sentence_quiz"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
