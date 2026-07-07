import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Brain, Volume2, Trash2, CheckCircle2, ChevronRight, GraduationCap, Trophy, X, Check } from "lucide-react";
import { Word, Level, UserStats } from "../types";
import { getAudioContext } from "../sound";

// クイズ回答時の効果音（シンセ）
const playReviewSound = (isCorrect: boolean) => {
  try {
    const ctx = getAudioContext();
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
    console.warn("Audio Context blocked.");
  }
};

interface ReviewListProps {
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

export default function ReviewList({
  vocabulary,
  wrongWords,
  setWrongWords,
  solvedHistory,
  setSolvedHistory,
  setStats,
  onBackToDashboard,
  updateRankingScore,
  recordAnswer
}: ReviewListProps) {
  // リストアップ対象の間違えた単語実体
  const wrongWordObjects = vocabulary.filter(w => wrongWords.includes(w.id));

  // 復習モード管理: "list" (カード一覧で自習) | "test" (四択テストで卒業にチャレンジ)
  const [mode, setMode] = useState<"list" | "test">("list");
  
  // フラッシュカード感覚のクリック詳細表示状態 (タップした単語のIDを保持)
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);

  // 復習テスト状態
  const [testQuestions, setTestQuestions] = useState<Word[]>([]);
  const [testIndex, setTestIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [graduatedWordIds, setGraduatedWordIds] = useState<string[]>([]);
  const [isTestFinished, setIsTestFinished] = useState(false);

  // 不正解時のカウントダウン・即スキップ管理用（他の一問一答クイズと同様の挙動）
  const timerRef = React.useRef<any>(null);
  const nextCallbackRef = React.useRef<(() => void) | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // 復習テストの開始
  const handleStartReviewTest = () => {
    if (wrongWordObjects.length === 0) return;
    const prepared = [...wrongWordObjects].sort(() => Math.random() - 0.5).map(q => {
      return {
        ...q,
        options: q.options ? [...q.options].sort(() => Math.random() - 0.5) : []
      };
    });
    setTestQuestions(prepared);
    setTestIndex(0);
    setSelectedOption(null);
    setTestFeedback(null);
    setGraduatedWordIds([]);
    setIsTestFinished(false);
    setMode("test");
  };

  // 復習テストの回答選択
  const handleTestAnswer = (option: string) => {
    if (selectedOption !== null || testFeedback !== null) return;
    
    setSelectedOption(option);
    const activeWord = testQuestions[testIndex];
    const isCorrect = option === activeWord.translation;

    playReviewSound(isCorrect);
    setTestFeedback(isCorrect ? "correct" : "incorrect");

    // 間隔反復(SRS)・デイリー目標の更新
    recordAnswer?.(activeWord.id, isCorrect);

    // もし正解なら、苦手リスト（wrongWords）からの「卒業予定（graduated）」に追加
    // 最後の問題で handleFinishTest を呼ぶ際、state 更新は非同期で間に合わないため
    // 確定した卒業リストをローカル変数で持ち、そのまま終了処理へ渡す（古いクロージャ参照によるバグ防止）
    const newGraduated = isCorrect ? [...graduatedWordIds, activeWord.id] : graduatedWordIds;
    if (isCorrect) {
      setGraduatedWordIds(newGraduated);
    }

    // 次へ移る処理（ユーザーによる即時スキップでも共通で呼べるようにクロージャとして定義）
    const onNext = () => {
      setTestFeedback(null);
      setSelectedOption(null);
      setCountdown(0);
      nextCallbackRef.current = null;
      if (testIndex + 1 < testQuestions.length) {
        setTestIndex(prev => prev + 1);
      } else {
        // テスト終了
        handleFinishTest(newGraduated);
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

  // 復習テストの終了処理
  const handleFinishTest = (finalGraduated: string[] = graduatedWordIds) => {
    setIsTestFinished(true);

    // 卒業した単語を「苦手リスト」から永久削除
    setWrongWords(prev => prev.filter(id => !finalGraduated.includes(id)));

    // 卒業した単語履歴（solvedHistory）でも、正解カウントを底上げ
    setSolvedHistory(prev => {
      const copy = { ...prev };
      finalGraduated.forEach(id => {
        if (copy[id]) {
          copy[id] = {
            correctCount: copy[id].correctCount + 1,
            attemptCount: copy[id].attemptCount
          };
        }
      });
      return copy;
    });

    // 卒業ボーナススコア支給 (1単語卒業につき50ポイント)
    const bonus = finalGraduated.length * 50;
    if (bonus > 0) {
      updateRankingScore(bonus);
      setStats(prev => ({
        ...prev,
        score: prev.score + bonus
      }));
    }
  };

  const handleSpeakWord = (wordText: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(wordText);
        u.lang = "en-US";
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // 苦手リストから手動で削除する
  const handleManualRemove = (wordId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("この単語を苦手リストから削除して、覚えたことにしますか？")) {
      setWrongWords(prev => prev.filter(id => id !== wordId));
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 relative" id="review_section_root">
      
      {/* 大きな〇×のアニメーション (テスト中のみ) */}
      <AnimatePresence>
        {testFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-50 flex items-center justify-center rounded-3xl overflow-hidden backdrop-blur-xs ${
              testFeedback === "correct" ? "bg-emerald-500/10" : "bg-rose-500/10"
            }`}
          >
            {testFeedback === "correct" ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1.2 }}
                exit={{ scale: 0 }}
                className="w-48 h-48 rounded-full border-16 border-emerald-500 flex items-center justify-center bg-white shadow-2xl"
              >
                <span className="text-emerald-500 font-extrabold text-9xl">〇</span>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1.2 }}
                  exit={{ scale: 0 }}
                  className="w-48 h-48 rounded-full border-16 border-rose-500 flex items-center justify-center bg-white shadow-2xl"
                >
                  <span className="text-rose-500 font-extrabold text-9xl">×</span>
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
                    {testQuestions[testIndex].word}
                  </p>
                  <p className="text-sm text-emerald-400 font-bold border-t border-slate-800 w-full pt-1.5 mt-1">
                    {testQuestions[testIndex].translation}
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

      {/* 苦手単語カード一覧モード */}
      {mode === "list" && (
        <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-6" id="review_list_card">
          
          <div className="flex items-center justify-between">
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition"
              id="btn_back_from_review"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ダッシュボードに戻る</span>
            </button>
            <span className="bg-rose-100 text-rose-700 text-xs px-3.5 py-1.5 rounded-full font-black font-mono">
              苦手単語: {wrongWordObjects.length} 語
            </span>
          </div>

          <div className="flex items-center gap-3 bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl p-4 text-white shadow-sm">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">苦手な英単語プール</h3>
              <p className="text-xs text-rose-100 mt-0.5 font-medium leading-relaxed">
                クイズで間違えてしまった単語たちの格納庫です。カードをタップして詳細を確認するか、四択テストに挑戦して苦手状態から卒業しましょう！
              </p>
            </div>
          </div>

          {/* 卒業テスト開始ボタン */}
          {wrongWordObjects.length > 0 ? (
            <button
              onClick={handleStartReviewTest}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-2xl shadow hover:shadow-md transition flex items-center justify-center gap-2 text-sm cursor-pointer"
              id="btn_start_graduation_test"
            >
              <GraduationCap className="w-4 h-4" />
              <span>苦手克服テストをスタートする</span>
            </button>
          ) : (
            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-gray-800 font-extrabold">苦手な単語はありません！</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
                素晴らしい学習進捗です。ダッシュボードからクイズにどんどん挑戦して、英単語マスターを目指していきましょう！
              </p>
            </div>
          )}

          {/* 単語カードリスト */}
          {wrongWordObjects.length > 0 && (
            <div className="space-y-3 pt-2" id="wrong_words_loop">
              {wrongWordObjects.map((word) => {
                const isExpanded = expandedWordId === word.id;
                
                return (
                  <div 
                    key={word.id} 
                    onClick={() => setExpandedWordId(isExpanded ? null : word.id)}
                    className={`border rounded-2xl p-4.5 cursor-pointer transition-all hover:bg-gray-50/50 ${
                      isExpanded ? "bg-rose-50/20 border-rose-200 shadow-sm" : "bg-white border-gray-150"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase font-mono ${
                          word.level === "junior"
                            ? "bg-blue-100 text-blue-700"
                            : word.level === "senior"
                              ? "bg-emerald-100 text-emerald-700"
                              : word.level === "senior2"
                                ? "bg-purple-100 text-purple-700"
                                : word.level === "senior3"
                                  ? "bg-pink-100 text-pink-700"
                                  : "bg-amber-100 text-amber-700"
                        }`}>
                          {word.level === "junior" ? "初級" : word.level === "senior" ? "中級1" : word.level === "senior2" ? "中級2" : word.level === "senior3" ? "中級3" : "上級"}
                        </span>
                        <span className="font-extrabold text-base tracking-wide text-gray-900 font-mono select-all">
                          {word.word}
                        </span>
                        <button
                          onClick={(e) => handleSpeakWord(word.word, e)}
                          className="p-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* 削除ボタン */}
                        <button
                          onClick={(e) => handleManualRemove(word.id, e)}
                          className="p-1.5 bg-gray-50 hover:bg-rose-100 text-gray-400 hover:text-rose-600 rounded-xl transition cursor-pointer"
                          title="覚えたので削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`} />
                      </div>
                    </div>

                    {/* 詳細展開表示（アコーディオン） */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 border-t border-gray-100 pt-4 space-y-3 text-xs md:text-sm">
                            <div className="grid grid-cols-3 bg-gray-50 p-3 rounded-xl border">
                              <div className="col-span-1 font-bold text-gray-500">日本語訳:</div>
                              <div className="col-span-2 font-extrabold text-indigo-700">{word.translation}</div>
                            </div>
                            
                            <div className="bg-gray-50 p-3 rounded-xl border space-y-1.5">
                              <p className="font-bold text-gray-500 flex items-center gap-1">
                                <span>英文穴埋めでの例:</span>
                              </p>
                              <p className="font-sans font-semibold text-gray-800 italic pr-4 pl-1">
                                {word.sentence.replace("[_____]", `【 ${word.word} 】`)}
                              </p>
                              <p className="text-[11px] text-gray-500 font-medium pl-1">
                                訳: {word.sentenceTranslation}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 苦手卒業四択テストモード */}
      {mode === "test" && (
        <div id="review_test_container">
          {!isTestFinished ? (
            <div className="bg-white border rounded-3xl p-6 shadow-sm relative overflow-hidden" id="review_test_card">
              
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setMode("list")}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>テストをやめて戻る</span>
                </button>
                <div className="bg-gray-100 px-3.5 py-1.5 rounded-full text-xs font-black font-mono text-indigo-700">
                  TEST: {testIndex + 1} / {testQuestions.length}
                </div>
              </div>

              {/* 出題プログレス */}
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-8">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${((testIndex + 1) / testQuestions.length) * 100}%` }}
                />
              </div>

              <div className="text-center space-y-4 my-8">
                <span className="text-xs font-black uppercase tracking-wider text-rose-500 font-mono">
                  卒業テスト単語
                </span>
                <div className="flex items-center justify-center gap-3">
                  <h2 className="text-4xl font-black text-gray-900 font-mono select-all">
                    {testQuestions[testIndex].word}
                  </h2>
                  <button
                    onClick={(e) => handleSpeakWord(testQuestions[testIndex].word, e)}
                    className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-all cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 4択 */}
              <div className="grid grid-cols-1 gap-3 mt-8">
                {testQuestions[testIndex].options.map((option, idx) => {
                  const isSelected = selectedOption === option;
                  const isCorrectAnswer = option === testQuestions[testIndex].translation;

                  let btnClass = "bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100";
                  if (selectedOption !== null) {
                    if (isSelected) {
                      btnClass = isCorrectAnswer
                        ? "bg-emerald-50 border-emerald-400 text-emerald-950 font-bold"
                        : "bg-rose-50 border-rose-300 text-rose-950 font-bold";
                    } else if (isCorrectAnswer) {
                      btnClass = "bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold opacity-90";
                    } else {
                      btnClass = "bg-gray-55 border-gray-100 text-gray-400 opacity-50";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleTestAnswer(option)}
                      disabled={selectedOption !== null}
                      className={`border rounded-2xl p-4.5 text-left text-sm font-semibold transition-all flex items-center justify-between cursor-pointer ${btnClass}`}
                      id={`test_option_btn_${idx}`}
                    >
                      <span>{option}</span>
                      <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center">
                        {selectedOption !== null && isCorrectAnswer && <Check className="w-3.5 h-3.5 text-emerald-600 stroke-3" />}
                        {selectedOption !== null && isSelected && !isCorrectAnswer && <X className="w-3.5 h-3.5 text-rose-600 stroke-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>

            </div>
          ) : (
            /* 卒業テスト完了結果 */
            <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-6" id="review_test_result_card">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-md">
                  <GraduationCap className="w-8 h-8 font-black" />
                </div>
                <h2 className="text-2xl font-black text-gray-900">克服テスト結果</h2>
                <p className="text-xs text-gray-400 font-mono tracking-wider">
                  GRADUATION TEST COMPLETED
                </p>
              </div>

              <div className="bg-gray-50 border rounded-2xl p-5 flex justify-around text-center my-6">
                <div>
                  <span className="text-xs text-gray-400 font-bold">克服・卒業した単語</span>
                  <p className="text-3xl font-black text-emerald-700 mt-1 font-mono">
                    {graduatedWordIds.length} <span className="text-xs text-gray-400 font-bold">/ {testQuestions.length} 語</span>
                  </p>
                </div>
                <div className="border-r border-gray-200" />
                <div>
                  <span className="text-xs text-gray-400 font-bold">獲得克服オファー</span>
                  <p className="text-3xl font-black text-indigo-700 mt-1 font-mono">
                    +{graduatedWordIds.length * 50} <span className="text-xs text-gray-400 font-bold">P</span>
                  </p>
                </div>
              </div>

              {graduatedWordIds.length > 0 ? (
                <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 space-y-2 text-emerald-950 font-semibold text-xs leading-relaxed">
                  <p className="font-extrabold text-sm flex items-center gap-1">
                    <Trophy className="w-4 h-4 text-amber-500 fill-amber-300" />
                    <span>苦手リストから以下の単語が卒業しました！</span>
                  </p>
                  <p className="font-mono text-gray-700 pl-1">
                    {testQuestions.filter(q => graduatedWordIds.includes(q.id)).map(q => q.word).join(", ")}
                  </p>
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-150 rounded-2xl p-4 text-rose-900 font-semibold text-xs text-center leading-relaxed">
                  卒業した単語はありませんでした。もう少し詳細カードで見返してから再チャレンジしてみましょう！諦めずにレッツゴー！
                </div>
              )}

              <div className="pt-4 flex justify-center">
                <button
                  onClick={() => {
                    setMode("list");
                    setIsTestFinished(false);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-10 py-3.5 rounded-2xl shadow hover:shadow-md cursor-pointer transition text-sm text-center"
                >
                  カード一覧に戻る
                </button>
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
}
