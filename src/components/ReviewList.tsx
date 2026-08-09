import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Brain, Volume2, Trash2, CheckCircle2, ChevronRight, GraduationCap } from "lucide-react";
import { Word, Level } from "../types";
import { QuizFormat } from "../quizFormats";
import QuizFormatPicker from "./QuizFormatPicker";

interface ReviewListProps {
  vocabulary: Word[];
  wrongWords: string[];
  setWrongWords: React.Dispatch<React.SetStateAction<string[]>>;
  onBackToDashboard: () => void;
  /**
   * 苦手克服テストを始める。出題は App 側のクイズ画面が受け持つ。
   * 以前はこの画面が四択のテストを自前で持っていたが、
   * 形式を選べるようにするとクイズ画面と同じものを二重に持つことになるため、
   * 出題は既存のクイズ画面にまかせ、この画面は一覧と入口だけを受け持つ。
   */
  onStartReviewQuiz: (format: QuizFormat) => void;
}

export default function ReviewList({
  vocabulary,
  wrongWords,
  setWrongWords,
  onBackToDashboard,
  onStartReviewQuiz
}: ReviewListProps) {
  // リストアップ対象の間違えた単語実体。
  // 苦手単語IDは Set にして定数時間で判定する。
  const wrongWordObjects: Word[] = useMemo(() => {
    const wrongSet = new Set(wrongWords);
    return vocabulary.filter(w => wrongSet.has(w.id));
  }, [vocabulary, wrongWords]);

  // フラッシュカード感覚のクリック詳細表示状態 (タップした単語のIDを保持)
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);


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
      
      {/* 苦手単語カード一覧 */}
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
                クイズで間違えてしまった単語たちの格納庫です。カードをタップして詳細を確認するか、
                テストに挑戦して苦手状態から卒業しましょう！
              </p>
            </div>
          </div>

          {/* 苦手克服テストの形式を選ぶ。
              以前は四択しか無く、綴りや文穴埋めで覚えた語も四択でしか出し直せなかった */}
          {wrongWordObjects.length > 0 ? (
            <div className="space-y-2.5" id="review_format_section">
              <div className="flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                <p className="text-sm font-black text-gray-800">苦手克服テストの形式を選ぶ</p>
              </div>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                正解した単語は苦手リストから卒業します。覚えたときと同じ形式で確かめると、
                「選べるが書けない」状態に気づけます。
              </p>
              <QuizFormatPicker words={wrongWordObjects} onSelect={onStartReviewQuiz} />
            </div>
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

    </div>
  );
}
