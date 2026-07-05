import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, 
  Sparkles, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Volume2, 
  BookOpen, 
  Calendar, 
  Award, 
  CheckCircle,
  Clock,
  ExternalLink,
  Bot,
  Trash2
} from "lucide-react";
import { Word } from "../types";
import { getAudioContext } from "../sound";

// 簡単なクリック/ファンファーレ音効果
const playLocalSound = (type: "unlock" | "sparkle") => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (type === "unlock") {
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.35);
      });
    } else if (type === "sparkle") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    // ignore Audio Context blockage
  }
};

interface DiaryEntry {
  id: string;
  date: string;
  title: string;
  diaryText: string;
  diaryTranslation: string;
  usedWords: string[];
  isFallback?: boolean;
}

interface AIDiaryProps {
  vocabulary: Word[];
  solvedHistory: Record<string, { correctCount: number; attemptCount: number }>;
  setSolvedHistory: React.Dispatch<React.SetStateAction<Record<string, { correctCount: number; attemptCount: number }>>>;
  onBackToDashboard: () => void;
}

export default function AIDiary({
  vocabulary,
  solvedHistory,
  setSolvedHistory,
  onBackToDashboard
}: AIDiaryProps) {
  // 現在マスターした単語の全オブジェクト
  const masteredWords = vocabulary.filter(
    w => solvedHistory[w.id] && solvedHistory[w.id].correctCount > 0
  );

  const masteredCount = masteredWords.length;
  const isUnlocked = masteredCount >= 200;

  // ローカルステート
  const [diary, setDiary] = useState<DiaryEntry | null>(() => {
    const saved = localStorage.getItem("quest_current_diary_cache");
    return saved ? JSON.parse(saved) : null;
  });
  
  const [history, setHistory] = useState<DiaryEntry[]>(() => {
    const saved = localStorage.getItem("quest_diary_history");
    return saved ? JSON.parse(saved) : [];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTranslation, setShowTranslation] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  // キャッシュおよび履歴同期
  useEffect(() => {
    if (diary) {
      localStorage.setItem("quest_current_diary_cache", JSON.stringify(diary));
    } else {
      localStorage.removeItem("quest_current_diary_cache");
    }
  }, [diary]);

  useEffect(() => {
    localStorage.setItem("quest_diary_history", JSON.stringify(history));
  }, [history]);

  // 日記のTTS読み上げ機能
  const handleToggleSpeech = () => {
    if (!diary) return;
    if (isPlaying) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      setIsPlaying(false);
    } else {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(diary.diaryText);
        u.lang = "en-US";
        u.rate = 0.85;
        u.onend = () => setIsPlaying(false);
        u.onerror = () => setIsPlaying(false);
        setIsPlaying(true);
        window.speechSynthesis.speak(u);
      } catch (err) {
        console.warn("Speech synthesis error", err);
        setIsPlaying(false);
      }
    }
  };

  // 生成APIの呼び出し
  const handleGenerateDiary = async () => {
    if (!isUnlocked) return;
    setLoading(true);
    setError("");
    
    // 覚えたすべての単語の文字列をリストアップして送信
    const learnedWordStrings = masteredWords.map(w => w.word);

    try {
      const response = await fetch("/api/gemini/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: learnedWordStrings })
      });

      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "日記を構築できませんでした。");
      }

      const newEntry: DiaryEntry = {
        id: "diary_" + Date.now(),
        date: new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }),
        title: payload.title || "My customized diary",
        diaryText: payload.diaryText,
        diaryTranslation: payload.diaryTranslation,
        usedWords: payload.usedWords || [],
        isFallback: !!payload.isFallback
      };

      setDiary(newEntry);
      setHistory(prev => [newEntry, ...prev]);
      playLocalSound("sparkle");
      // ※以前ここで setSolvedHistory({}) を呼んでいたが、日記を1回生成するだけで
      //   全学習履歴（習熟度・習得単語数）が消えてしまう重大な不具合のため削除
    } catch (err: any) {
      console.error(err);
      setError(err.message || "通信または生成エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 1撃で200語習熟をクリアするテストシミュレーター
  const handleSimulateMastery = () => {
    playLocalSound("unlock");
    
    setSolvedHistory(prev => {
      const updated = { ...prev };
      // 既存の vocabulary から 205 個選んで mastered (correctCount = 1) に書き換え
      let count = 0;
      for (const word of vocabulary) {
        if (count >= 205) break;
        updated[word.id] = {
          correctCount: Math.max(1, (updated[word.id]?.correctCount || 0) + 1),
          attemptCount: Math.max(1, (updated[word.id]?.attemptCount || 0) + 1)
        };
        count++;
      }
      return updated;
    });

    alert("🎉 動作確認シミュレーター起動！\n初期ボキャブラリーから 205語の習熟実績をローカルストレージへ一瞬で移植しました！AI英語日記モードをご自由にお試しください。");
  };

  // 削除確認用の状態
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showActiveDiaryDeleteConfirm, setShowActiveDiaryDeleteConfirm] = useState(false);

  // 履歴の個別削除（確認画面の展開）
  const handleDeleteEntry = (entryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(entryId);
  };

  // 実際の個別削除実行
  const confirmDeleteEntry = (entryId: string) => {
    const updatedHistory = history.filter(h => h.id !== entryId);
    setHistory(updatedHistory);
    
    if (diary?.id === entryId) {
      if (updatedHistory.length > 0) {
        setDiary(updatedHistory[0]);
      } else {
        setDiary(null);
      }
    }
    setDeleteConfirmId(null);
  };

  // 履歴をすべて削除（確認画面の展開）
  const handleClearAllHistory = () => {
    setShowClearAllConfirm(true);
  };

  // 実際の全削除実行
  const confirmClearAllHistory = () => {
    setHistory([]);
    setDiary(null);
    setShowClearAllConfirm(false);
  };

  // 英語テキスト中の対象単語をハイライト表示する関数
  const highlightDiaryText = (text: string, used: string[]) => {
    if (!used || used.length === 0) return text;
    
    // 正規表現で対象単語（複数形・過去形などもできるだけ緩く部分一致・完全一致）をエスケープして分割
    // 重複を弾いて、長さ順にソート（長い単語から先にマッチさせる）
    const sortedUsed = [...new Set(used)]
      .filter(w => w.trim().length > 1)
      .sort((a, b) => b.length - a.length);

    if (sortedUsed.length === 0) return text;

    // 正規表現の作成: \b(word1|word2|word3s|word4ed)\b のようなパターン
    // 語尾変化も想定して境界やスペル全体をマッチ
    const escaped = sortedUsed.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    
    // 品詞変化も拾いやすいように単語の先頭や部分一致で処理
    const patternStr = `\\b(${escaped.join("|")})\\w*\\b`;
    const regex = new RegExp(patternStr, "gi");

    const parts = text.split(regex);
    // マッチ箇所を特定してスタイル変更
    // splitでキャプチャグループを使用すると、マッチした単語自体が奇数番目の要素として配列に格納されます
    
    return text.split(regex).map((part, index) => {
      const isMatch = sortedUsed.some(
        u => part.toLowerCase().startsWith(u.toLowerCase()) || u.toLowerCase().startsWith(part.toLowerCase())
      );
      
      if (isMatch && part.trim().length > 0) {
        return (
          <span 
            key={index} 
            className="bg-amber-100 dark:bg-amber-950/70 border-b-2 border-amber-500 text-amber-950 dark:text-amber-200 px-1 font-extrabold mx-0.5 rounded-sm shadow-3xs cursor-pointer select-none"
            title={`習得済み単語: ${part}`}
            onClick={(e) => {
              e.stopPropagation();
              playLocalSound("sparkle");
              try {
                if ("speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                  const u = new SpeechSynthesisUtterance(part);
                  u.lang = "en-US";
                  window.speechSynthesis.speak(u);
                }
              } catch(_) {}
            }}
          >
            {part}
          </span>
        );
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-6" id="ai_diary_view">
      {/* 戻るボタンヘッダー */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition"
          id="diary_back_btn"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ダッシュボードに戻る</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-indigo-700 bg-indigo-55 dark:bg-indigo-950 px-3 py-1 rounded-full uppercase tracking-wider font-mono">
            Premium Mode
          </span>
        </div>
      </div>

      {/* 開放ステータス看板 */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-[0.03] scale-150 rotate-45 pointer-events-none">
          <Sparkles className="w-64 h-64 text-indigo-900" />
        </div>

        <div className="space-y-3 z-10 max-w-xl">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl text-indigo-700 dark:text-indigo-400">
              {isUnlocked ? <Unlock className="w-6 h-6 animate-pulse" /> : <Lock className="w-6 h-6 text-gray-400" />}
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <span>AI 英語日記生成モード</span>
                {isUnlocked && <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase animate-bounce">解放済み</span>}
              </h2>
              <p className="text-xs text-gray-400 dark:text-slate-500 font-mono mt-0.5">English Diary Maker using learned vocabulary</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed font-semibold">
            クイズで正解した実績（マスター）が <span className="text-indigo-600 dark:text-indigo-400 font-black text-base font-mono">200単語</span> に到達すると自動解放される学習報酬モードです。AIがあなたが覚えた単語プールをくまなく解析し、それらから関連性の高い言葉を美しく散りばめた、自然で豊かなオリジナルストーリー日記を長さ制限なしでパーソナライズ生成します。
          </p>

          {/* プログレスバー */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="font-extrabold flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-indigo-500" />
                <span>習得合計実績:</span>
                <strong className="text-gray-700 dark:text-slate-200 font-mono text-sm pl-0.5">{masteredCount}</strong> / 200 単語
              </span>
              <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-black">
                {Math.min(100, Math.round((masteredCount / 200) * 100))}% Unlocked
              </span>
            </div>
            <div className="w-full h-3.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-indigo-50/50 dark:border-indigo-900/10">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 dark:from-indigo-600 dark:to-indigo-500 rounded-full transition-all duration-500 shadow-3xs"
                style={{ width: `${Math.min(100, (masteredCount / 200) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 右側アクション */}
        <div className="z-10 shrink-0 flex flex-col gap-2.5 justify-center md:items-end">
          {!isUnlocked && (
            <>
              <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-gray-50 dark:bg-slate-850/80 border border-gray-150 dark:border-slate-800 text-xs text-gray-500 dark:text-slate-400 font-medium leading-normal max-w-[240px]">
                <Clock className="w-4 h-4 text-gray-300 dark:text-slate-500 shrink-0" />
                <span>一問一答テストや例文穴埋めを行い、あと <strong>{200 - masteredCount} 単語</strong> 正解すると開放！</span>
              </div>
              {/* 開発時のみ表示するテスト用ボタン（本番ビルドでは非表示） */}
              {import.meta.env.DEV && (
                <button
                  onClick={handleSimulateMastery}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold px-4 py-3 rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  id="cheat_mastery_btn"
                >
                  <Sparkles className="w-4 h-4 fill-amber-100 animate-pulse" />
                  <span>【動作確認】200語の習得をシミュレート</span>
                </button>
              )}
            </>
          )}

          {isUnlocked && (
            <button
              onClick={handleGenerateDiary}
              disabled={loading}
              className="px-6 py-4.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-sm rounded-2xl transition shadow-lg hover:shadow-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2.5 select-none"
              id="generator_diary_btn"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>AI日記執筆中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 fill-indigo-100" />
                  <span>AIに英語日記をオーダーする</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* メインの書き下ろし日記ディスプレイ */}
      {(isUnlocked || diary !== null || history.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* 左カラム: 日記帳そのもの */}
          <div className="md:col-span-8 space-y-6">
            <AnimatePresence mode="wait">
              {diary ? (
                <motion.div
                  key={diary.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-3xl overflow-hidden shadow-md"
                  id="diary_book_content"
                >
                  {/* ヘッダー・スタンプ風 */}
                  <div className="bg-gradient-to-r from-gray-50 to-indigo-50/20 dark:from-slate-850 dark:to-slate-900 border-b border-gray-100 dark:border-slate-800 py-4 px-6 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="p-1.5 bg-indigo-100 dark:bg-indigo-950 rounded-lg text-[13px] text-indigo-700 dark:text-indigo-400 font-black uppercase font-mono">
                        Diary
                      </span>
                      <span className="text-[11px] text-gray-400 dark:text-slate-500 font-extrabold tracking-tight flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{diary.date}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowTranslation(!showTranslation)}
                        className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition ${
                          showTranslation
                            ? "bg-indigo-50 dark:bg-indigo-950 border-indigo-100 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300"
                            : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800"
                        }`}
                        id="toggle_translation_btn"
                      >
                        {showTranslation ? "和訳を非表示" : "和訳を表示"}
                      </button>
                      <button
                        onClick={handleToggleSpeech}
                        className={`p-1.5 rounded-xl border transition ${
                          isPlaying
                            ? "bg-rose-50 border-rose-100 text-rose-600 animate-pulse"
                            : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800"
                        }`}
                        title={isPlaying ? "音声を停止" : "AI音声で朗読"}
                        id="diary_tts_btn"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowActiveDiaryDeleteConfirm(true)}
                        className="p-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 transition shadow-3xs cursor-pointer"
                        title="この日記を削除"
                        id="diary_delete_btn"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </button>
                    </div>
                  </div>

                   {/* 本文領域 */}
                  <div className="p-6 md:p-8 space-y-6">
                    {showActiveDiaryDeleteConfirm && (
                      <div className="bg-rose-50 border border-rose-200/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-rose-950 text-xs animate-fade-in shadow-xs" id="active_diary_delete_confirm_banner">
                        <div className="flex items-center gap-2.5">
                          <span className="p-2 bg-rose-100 rounded-xl text-rose-600">
                            <Trash2 className="w-5 h-5" />
                          </span>
                          <div>
                            <p className="font-extrabold text-sm text-rose-950 font-sans">この日記を完全に削除しますか？</p>
                            <p className="text-gray-500 m-0 leading-normal font-semibold">削除された過去のAI英語日記は復元できません。</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                          <button
                            onClick={() => {
                              if (diary) {
                                confirmDeleteEntry(diary.id);
                                setShowActiveDiaryDeleteConfirm(false);
                              }
                            }}
                            className="flex-1 sm:flex-initial px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer"
                          >
                            削除する
                          </button>
                          <button
                            onClick={() => setShowActiveDiaryDeleteConfirm(false)}
                            className="flex-1 sm:flex-initial px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-750 rounded-xl text-xs font-black transition cursor-pointer"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 一時的フォールバック表示 */}
                    {diary.isFallback && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-4 flex gap-3 text-amber-800 dark:text-amber-300 text-xs">
                        <span className="text-sm">💡</span>
                        <div>
                          <p className="font-bold">一時的な自動調整中 (429過負荷の制限回避)</p>
                          <p className="mt-1 opacity-90 leading-relaxed">
                            現在APIへのアクセスが集中して一時的に読み込み制限がかかっているため、快適な学習を継続できるようローカルエンジンで自動組成した語彙確認用の仮日記を生成しました。時間を置いて再度実行すると、最新のAIによる完全生成に自動で戻ります。
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 日記のタイトル */}
                    <div>
                      <h3 className="text-xl md:text-2xl font-extrabold text-indigo-950 dark:text-indigo-200 font-sans tracking-tight">
                        {diary.title}
                      </h3>
                      <div className="h-1.5 w-12 bg-amber-400 rounded-full mt-2" />
                    </div>

                    {/* 英語テキスト */}
                    <div className="bg-gray-50/50 dark:bg-slate-850/50 border border-gray-100/50 dark:border-slate-800 rounded-2xl p-6 relative">
                      <p className="text-base md:text-lg text-gray-800 dark:text-slate-100 font-sans leading-relaxed tracking-wide font-medium">
                        {highlightDiaryText(diary.diaryText, diary.usedWords)}
                      </p>
                      
                      <div className="flex justify-end mt-4">
                        <span className="text-[10px] text-gray-450 dark:text-slate-500 font-mono">
                          長さ: {diary.diaryText.length} 文字
                        </span>
                      </div>
                    </div>

                    {/* 日本語翻訳（表示ONの時のみスライド表示） */}
                    {showTranslation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100/40 dark:border-indigo-900/40 rounded-xl p-5"
                      >
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mb-1">日本語訳:</p>
                        <p className="text-sm text-indigo-950 dark:text-indigo-300 font-medium leading-relaxed leading-normal">
                          {diary.diaryTranslation}
                        </p>
                      </motion.div>
                    )}

                    {/* 習得済み単語タグ表示 */}
                    <div className="border-t border-gray-100 dark:border-slate-800 pt-5 space-y-2.5">
                      <p className="text-xs text-gray-450 dark:text-slate-500 font-extrabold flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-indigo-500" />
                        <span>今回使われた、あなたが習得した単語 ({diary.usedWords.length}語):</span>
                      </p>
                      
                      <div className="flex flex-wrap gap-1.5">
                        {diary.usedWords.map((word, index) => {
                          // 本来の意味オブジェクトを探す
                          const orig = vocabulary.find(v => v.word.toLowerCase() === word.toLowerCase());
                          return (
                            <div 
                              key={index}
                              onClick={() => {
                                playLocalSound("sparkle");
                                try {
                                  if ("speechSynthesis" in window) {
                                    window.speechSynthesis.cancel();
                                    const u = new SpeechSynthesisUtterance(word);
                                    u.lang = "en-US";
                                    window.speechSynthesis.speak(u);
                                  }
                                } catch(_) {}
                              }}
                              className="px-2.5 py-1 bg-amber-50 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-amber-900 dark:text-slate-100 border border-amber-100 dark:border-slate-700 rounded-lg text-xs font-bold font-mono inline-flex items-center gap-1 cursor-pointer transition select-none"
                              title={orig ? `和訳: ${orig.translation}` : ""}
                            >
                              <span>{word}</span>
                              {orig && <span className="text-[10px] text-amber-600 dark:text-amber-450 font-normal">({orig.translation})</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </motion.div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-3xl p-10 text-center space-y-4 shadow-sm py-16">
                  <Sparkles className="w-16 h-16 text-indigo-300 mx-auto animate-bounce fill-indigo-250" />
                  <h3 className="text-xl font-bold text-gray-700 dark:text-slate-200">
                    あなただけの物語（日記）を創り出そう
                  </h3>
                  <p className="text-sm text-gray-400 dark:text-slate-500 max-w-sm mx-auto">
                    右上の「AIに英語日記をオーダーする」ボタンを押すと、あなたが習得した {masteredCount} 語から瞬時にAIがカスタム生成します。
                  </p>
                </div>
              )}
            </AnimatePresence>

            {error && (
              <p className="text-sm text-rose-500 font-medium bg-rose-50 dark:bg-rose-950 border border-rose-100 dark:border-rose-900 rounded-xl p-4.5">
                {error}
              </p>
            )}
          </div>

          {/* 右カラム: 歴史（バックナンバー履歴リスト） */}
          <div className="md:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-3xl p-4 shadow-sm">
              <h3 className="text-xs font-black text-gray-400 dark:text-slate-500 tracking-wider uppercase font-mono mb-3.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-gray-450" />
                  <span>過去のAI英語日記履歴 ({history.length})</span>
                </div>
                {history.length > 0 && (
                  <button 
                    onClick={handleClearAllHistory}
                    className="text-[10px] text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1 transition cursor-pointer"
                    title="すべての履歴を消去"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>すべて削除</span>
                  </button>
                )}
              </h3>

              {history.length > 0 ? (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {history.map((hEntry) => {
                    const isActive = diary?.id === hEntry.id;
                    const isDeleteConfirm = deleteConfirmId === hEntry.id;
                    return (
                      <div
                        key={hEntry.id}
                        onClick={() => {
                          if (isDeleteConfirm) return;
                          setDiary(hEntry);
                          playLocalSound("sparkle");
                        }}
                        className={`text-left p-3 rounded-2xl border transition-all cursor-pointer select-none relative group overflow-hidden ${
                          isActive
                            ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/60 shadow-sm"
                            : "bg-gray-50/50 dark:bg-slate-850 hover:bg-gray-150 dark:hover:bg-slate-800 border-gray-150 dark:border-slate-800"
                        }`}
                      >
                        {isDeleteConfirm && (
                          <div className="absolute inset-0 bg-rose-50/95 dark:bg-slate-900/95 flex flex-col justify-center items-center p-2 z-10 text-center">
                            <p className="text-[10px] font-black text-rose-800 dark:text-rose-200 mb-1.5">この日記を削除しますか？</p>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmDeleteEntry(hEntry.id);
                                }}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[10px] font-bold shadow-3xs cursor-pointer transition"
                              >
                                削除
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(null);
                                }}
                                className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 dark:text-slate-300 dark:bg-slate-805 dark:border-slate-800 rounded-md text-[10px] font-bold shadow-3xs cursor-pointer transition"
                              >
                                戻る
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="font-extrabold text-gray-400 dark:text-slate-500 font-mono">
                            {hEntry.date}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-indigo-600 dark:text-indigo-400 font-black text-[9px] bg-indigo-100/50 dark:bg-indigo-950 px-1.5 py-0.5 rounded">
                              {hEntry.usedWords.length}語使用
                            </span>
                            <button
                              onClick={(e) => handleDeleteEntry(hEntry.id, e)}
                              className="text-gray-400 hover:text-rose-600 p-1 rounded-lg transition duration-150 hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0"
                              title="この履歴を削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200 truncate pr-2">
                          {hEntry.title}
                        </h4>
                        <p className="text-[10px] text-gray-450 dark:text-slate-500 truncate mt-1">
                          {hEntry.diaryText}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-gray-400 dark:text-slate-600 font-medium">
                  書き溜めた日記履歴はここに蓄積されます。
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* すべて削除の確認用モーダル ダイアログ */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center"
          >
            <div className="space-y-2">
              <div className="w-12 h-12 bg-rose-550/10 dark:bg-rose-950/40 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl">
                ⚠️
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 font-sans tracking-tight">
                すべての履歴を完全に削除しますか？
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed font-semibold">
                これまでに書き溜めたすべてのAI英語日記が消去され、元に戻せなくなります。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={confirmClearAllHistory}
                className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer"
              >
                完全に消去する
              </button>
              <button
                onClick={() => setShowClearAllConfirm(false)}
                className="w-full py-2.5 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-gray-700 dark:text-slate-200 rounded-xl text-xs font-black transition cursor-pointer"
              >
                キャンセル
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
