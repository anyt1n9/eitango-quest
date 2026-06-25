import React, { useState, useEffect } from "react";
import { Level, UserStats, RankingUser } from "../types";
import { passages, Passage } from "../data/passages";
import { ArrowLeft, BookOpen, Clock, Heart, Sparkles, CheckCircle, Search, Eye, EyeOff } from "lucide-react";

interface ReadingProps {
  stats: UserStats;
  setStats: React.Dispatch<React.SetStateAction<UserStats>>;
  onBackToDashboard: () => void;
  updateRankingScore: (points: number) => void;
}

export default function Reading({ stats, setStats, onBackToDashboard, updateRankingScore }: ReadingProps) {
  const [selectedPassage, setSelectedPassage] = useState<Passage | null>(null);
  const [showJapanese, setShowJapanese] = useState(true);
  const [selectedWordObj, setSelectedWordObj] = useState<{ word: string; translation: string } | null>(null);
  
  // 読了済みの長文IDを管理するローカルステート
  const [readPassages, setReadPassages] = useState<string[]>(() => {
    const saved = localStorage.getItem("quest_read_passages");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("quest_read_passages", JSON.stringify(readPassages));
  }, [readPassages]);

  // レベルバッジ用スタイル
  const getLevelBadge = (level: Level) => {
    switch (level) {
      case "junior":
        return { text: "初級 (中学生)", bg: "bg-emerald-50 text-emerald-700 border-emerald-200/50" };
      case "senior":
        return { text: "中級1 (高1)", bg: "bg-blue-50 text-blue-700 border-blue-200/50" };
      case "senior2":
        return { text: "中級2 (高2)", bg: "bg-purple-50 text-purple-700 border-purple-200/50" };
      case "senior3":
        return { text: "中級3 (高3)", bg: "bg-pink-50 text-pink-700 border-pink-200/50" };
      case "advanced":
        return { text: "上級 (社会人)", bg: "bg-amber-50 text-amber-700 border-amber-200/50" };
    }
  };

  const getLevelColorSchema = (level: Level) => {
    switch (level) {
      case "junior":
        return "emerald";
      case "senior":
        return "blue";
      case "senior2":
        return "purple";
      case "senior3":
        return "pink";
      case "advanced":
        return "amber";
    }
  };

  const handleCompletePassage = (passage: Passage) => {
    if (readPassages.includes(passage.id)) return;

    // 読了追加
    setReadPassages(prev => [...prev, passage.id]);

    // スコア加算
    setStats(prev => ({
      ...prev,
      score: prev.score + passage.pointReward,
      completedQuestions: prev.completedQuestions + 1 // 読破も実績にカウント
    }));

    updateRankingScore(passage.pointReward);

    // お祝いメッセージ表示
    alert(`🎉 素晴らしい！『${passage.title}』を完全読破しました！\n\n報酬として ${passage.pointReward} ポイントを獲得しました！\n（世界ランキングに反映されます）`);
  };

  // 英単語のハイライトレンダリング
  const renderEnglishWithHighlights = (text: string, highlightList: { word: string; translation: string }[], level: Level) => {
    const colorMap: Record<Level, string> = {
      junior: "border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100",
      senior: "border-blue-200 bg-blue-50/70 text-blue-800 hover:bg-blue-100",
      senior2: "border-purple-200 bg-purple-50/70 text-purple-800 hover:bg-purple-100",
      senior3: "border-pink-200 bg-pink-50/70 text-pink-800 hover:bg-pink-100",
      advanced: "border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100"
    };
    const colorClass = colorMap[level] || "border-indigo-200 bg-indigo-50 text-indigo-800";

    const wordsToMatch = highlightList.map(h => h.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    if (wordsToMatch.length === 0) {
      return <span>{text}</span>;
    }

    // 複数語や単語境界を安全にマッチさせる正規表現
    const regex = new RegExp(`\\b(${wordsToMatch.join('|')})\\b`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      const matchedWord = highlightList.find(h => h.word.toLowerCase() === part.toLowerCase());
      if (matchedWord) {
        return (
          <span
            key={index}
            className={`relative inline-block px-1 rounded border-b-2 font-semibold cursor-pointer transition-all duration-150 group/word ${colorClass}`}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedWordObj(matchedWord);
            }}
          >
            {part}
            {/* ホバースマートツールチップ */}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/word:block bg-slate-900 text-white text-[11px] px-2 py-1 rounded shadow-lg max-w-xs whitespace-nowrap z-50 animate-fade-in font-sans">
              {matchedWord.translation}
            </span>
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  if (selectedPassage) {
    const badge = getLevelBadge(selectedPassage.level);
    const schema = getLevelColorSchema(selectedPassage.level);
    const isCompleted = readPassages.includes(selectedPassage.id);

    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 sm:p-8 animate-fade-in" id="passage_detail_screen">
        {/* ヘッダーエリア */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-gray-150">
          <button
            onClick={() => {
              setSelectedPassage(null);
              setSelectedWordObj(null);
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition border border-gray-200 rounded-xl px-3 py-2 cursor-pointer"
            id="back_to_passages_list_btn"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
            <span>長文一覧へ</span>
          </button>
          
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs px-3 py-1 rounded-full font-bold border ${badge.bg}`}>
              {badge.text}
            </span>
            <div className="flex items-center gap-1 text-xs text-gray-400 font-mono font-bold bg-slate-50 border border-gray-200 px-2.5 py-1 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              <span>報酬: +{selectedPassage.pointReward}P</span>
            </div>
            {isCompleted && (
              <span className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-bold">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>読覇済み</span>
              </span>
            )}
          </div>
        </div>

        {/* メインの読解タイトル */}
        <div className="mt-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight font-sans">
            {selectedPassage.title}
          </h2>
          <p className="text-xs text-gray-400 mt-2 max-w-lg mx-auto font-medium">
            下線部が引かれた重要単語にカーソルを合わせると、いつでも意味をチェックできます。
          </p>
        </div>

        {/* コントロールパネル */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 bg-slate-50 border border-gray-200/50 p-4 rounded-2xl">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowJapanese(!showJapanese)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border cursor-pointer select-none transition ${
                showJapanese
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {showJapanese ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>日本語訳: {showJapanese ? "非表示にする (暗記確認)" : "表示する"}</span>
            </button>
          </div>
          <span className="text-[11px] text-gray-400 font-semibold">
            重要単語数: <span className="text-gray-700 font-bold font-mono">{selectedPassage.vocabularyHighlight.length}語</span>
          </span>
        </div>

        {/* 読解・重要単語エリアのグリッド */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 本文（英語 ＆ 日本語のパラグラフ並列） */}
          <div className="lg:col-span-2 space-y-8" id="passage_text_container">
            {selectedPassage.englishParagraphs.map((eng, idx) => {
              const jap = selectedPassage.japaneseParagraphs[idx];
              return (
                <div key={idx} className="space-y-3.5 border-l-4 border-slate-100 pl-4 py-1">
                  {/* 英語本文 */}
                  <p className="text-gray-800 text-base sm:text-lg leading-relaxed font-sans font-medium tracking-wide">
                    {renderEnglishWithHighlights(eng, selectedPassage.vocabularyHighlight, selectedPassage.level)}
                  </p>

                  {/* 日本語翻訳 (表示トグル対象) */}
                  {showJapanese && (
                    <p className="text-sm text-gray-500 font-medium leading-relaxed font-sans">
                      {jap}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* 右サイドバー：ターゲット単語リスト & 情報 */}
          <div className="space-y-6">
            
            {/* 特徴辞書 */}
            <div className="bg-slate-50 border border-gray-150 rounded-2xl p-5 shadow-2xs">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>収録されている重要語彙</span>
              </h3>
              
              <div className="grid grid-cols-1 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                {selectedPassage.vocabularyHighlight.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedWordObj(v)}
                    className={`text-left p-3 rounded-xl border text-xs font-sans transition-all w-full flex justify-between items-center cursor-pointer ${
                      selectedWordObj?.word === v.word
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white hover:bg-gray-100 text-gray-800 border-gray-250/50"
                    }`}
                  >
                    <span className="font-bold font-mono text-sm">{v.word}</span>
                    <span className={selectedWordObj?.word === v.word ? "text-indigo-150 font-medium" : "text-gray-400 font-medium text-[11px]"}>
                      {v.translation}
                    </span>
                  </button>
                ))}
              </div>

              {selectedWordObj && (
                <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl animate-fade-in">
                  <span className="text-[10px] text-indigo-500 font-semibold block uppercase">選択中の単語</span>
                  <p className="text-sm font-black text-indigo-950 font-mono">{selectedWordObj.word}</p>
                  <p className="text-xs font-semibold text-indigo-800 mt-1">{selectedWordObj.translation}</p>
                </div>
              )}
            </div>

            {/* 一致スコア報酬 */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-md shadow-gray-250">
              <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 w-32 h-32 bg-slate-800/60 rounded-full" />
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                  <div className="flex gap-1.5 items-center">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] font-black tracking-widest uppercase text-amber-300">Quest Completed Rewards</span>
                  </div>
                  <h4 className="text-lg font-black mt-2 leading-tight">このストーリーの読破を目指そう！</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    長文を自分の力で最後まで読み、語彙への理解が深まったら、下のボタンを押して読破を完了してください。
                  </p>
                </div>

                <div className="mt-6 border-t border-slate-800 pt-4 flex flex-col gap-2">
                  {isCompleted ? (
                    <div className="w-full bg-slate-800 border border-emerald-500/30 text-emerald-400 font-bold py-3 px-4 rounded-xl text-center text-xs flex items-center justify-center gap-2 select-none">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span>報酬獲得済み (+{selectedPassage.pointReward}P)</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCompletePassage(selectedPassage)}
                      className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black font-black py-3 px-4 rounded-xl text-center text-xs shadow-md shadow-amber-950/20 active:translate-y-px transition block cursor-pointer select-none"
                    >
                      読破を完了して +{selectedPassage.pointReward}P
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-150 rounded-2xl shadow-sm p-6 sm:p-8 animate-fade-in" id="passages_list_screen">
      {/* 上部ヘッダー */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-150">
        <div>
          <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-full border border-indigo-150/40">
            新セクション 🎉
          </span>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight mt-2 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            <span>長文ストーリー読破 Quest</span>
          </h2>
          <p className="text-xs text-gray-400 font-medium">
            各レベルの収録語のみを用いた高品質な英語長文を読み、より実践的なリーディング力を養いましょう！
          </p>
        </div>
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 transition border border-gray-200 rounded-xl px-3 py-2 cursor-pointer bg-white shadow-2xs"
          id="btn_reading_to_dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ダッシュボードへ</span>
        </button>
      </div>

      {/* 読破の進進捗状況 */}
      <div className="mt-6 bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold font-mono">STORY XP PROGRESS</p>
            <p className="text-sm font-black text-indigo-950">
              読覇ストーリー: <span className="font-mono text-base">{readPassages.length}</span> / {passages.length}
            </p>
          </div>
        </div>
        {/* プログレスバー */}
        <div className="flex-1 max-w-xs w-full bg-slate-200/60 rounded-full h-2 overflow-hidden shadow-inner">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-1000"
            style={{ width: `${(readPassages.length / passages.length) * 100}%` }}
          />
        </div>
      </div>

      {/* ストーリーの一覧 */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6" id="passages_grid_container">
        {passages.map((p) => {
          const badge = getLevelBadge(p.level);
          const isCompleted = readPassages.includes(p.id);
          const schema = getLevelColorSchema(p.level);

          return (
            <div
              key={p.id}
              onClick={() => setSelectedPassage(p)}
              className="bg-white border hover:border-indigo-200 hover:shadow-md transition-all duration-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between cursor-pointer group border-gray-200/80"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${badge.bg}`}>
                    {badge.text}
                  </span>
                  
                  {isCompleted ? (
                    <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 rounded-full font-bold">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      <span>読覇完了</span>
                    </span>
                  ) : (
                    <span className="text-[10.5px] text-indigo-600 font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>+{p.pointReward}P</span>
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-black text-gray-900 mt-3 group-hover:text-indigo-600 transition font-sans">
                  {p.title}
                </h3>
                
                <p className="text-xs text-gray-500 mt-2 leading-relaxed font-sans line-clamp-3">
                  {p.description}
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-gray-100 flex justify-between items-center">
                <span className="text-[10px] text-gray-400 font-bold font-mono tracking-wider">
                  ターゲット語数: {p.vocabularyHighlight.length}語
                </span>
                <span className="text-xs font-black text-indigo-600 group-hover:translate-x-1 transition-all flex items-center gap-0.5">
                  読む ➔
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
