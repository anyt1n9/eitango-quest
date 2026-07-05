import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, 
  Search, 
  BookOpen, 
  ChevronRight, 
  Volume2, 
  CheckCircle2, 
  X, 
  Sparkles,
  ArrowUpDown,
  Layers,
  GraduationCap,
  MessageSquare,
  Briefcase,
  TrendingUp,
  Loader2,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { Word, Level } from "../types";
import Phonetic from "./Phonetic";
import { getWordPosLabel } from "../pos";

interface DictionaryProps {
  vocabulary: Word[];
  wrongWords: string[];
  solvedHistory: Record<string, { correctCount: number; attemptCount: number }>;
  onBackToDashboard: () => void;
}

type FilterLevel = "all" | Level | "custom" | "weak";
type SortOption = "alphabetical-asc" | "alphabetical-desc" | "level-asc" | "level-desc";

// ユーザーが追加した単語（AI追加・CSVインポート・PDF抽出）の判定
const isCustomWordId = (id: string) => /^(ai_|csv_|pdf_)/.test(id);

export default function Dictionary({
  vocabulary,
  wrongWords,
  solvedHistory,
  onBackToDashboard
}: DictionaryProps) {
  // AI単語使用頻度の情報キャッシュ
  const [wordFrequencies, setWordFrequencies] = useState<Record<string, any>>({});
  const [frequencyLoading, setFrequencyLoading] = useState<Record<string, boolean>>({});
  const [frequencyError, setFrequencyError] = useState<Record<string, string>>({});

  // AI単語イメージ（SVG）の情報キャッシュ
  const [wordImages, setWordImages] = useState<Record<string, string>>({});
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});
  const [imageError, setImageError] = useState<Record<string, string>>({});

  // 類義語・反意語・コロケーションの情報キャッシュ
  const [wordRelations, setWordRelations] = useState<Record<string, any>>({});
  const [relationsLoading, setRelationsLoading] = useState<Record<string, boolean>>({});
  const [relationsError, setRelationsError] = useState<Record<string, string>>({});

  const handleFetchWordRelations = async (wordText: string, translationText?: string) => {
    const trimmed = wordText.trim();
    const key = trimmed.toLowerCase();
    if (wordRelations[key] || relationsLoading[key]) return;

    setRelationsLoading(prev => ({ ...prev, [key]: true }));
    setRelationsError(prev => ({ ...prev, [key]: "" }));

    try {
      const response = await fetch("/api/gemini/word-relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: trimmed, translation: translationText })
      });

      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "類義語・反意語を取得できませんでした。");
      }

      setWordRelations(prev => ({ ...prev, [key]: payload }));
    } catch (err: any) {
      console.error(err);
      setRelationsError(prev => ({ ...prev, [key]: err.message || "通信または解析エラーが発生しました。" }));
    } finally {
      setRelationsLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleFetchWordFrequency = async (wordText: string) => {
    const trimmed = wordText.trim();
    const key = trimmed.toLowerCase();
    if (wordFrequencies[key] || frequencyLoading[key]) return;

    setFrequencyLoading(prev => ({ ...prev, [key]: true }));
    setFrequencyError(prev => ({ ...prev, [key]: "" }));

    try {
      const response = await fetch("/api/gemini/word-frequency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: trimmed })
      });

      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "詳細な頻度分析を取得できませんでした。");
      }

      setWordFrequencies(prev => ({ ...prev, [key]: payload }));
    } catch (err: any) {
      console.error(err);
      setFrequencyError(prev => ({ ...prev, [key]: err.message || "通信または解析エラーが発生しました。" }));
    } finally {
      setFrequencyLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleFetchWordImage = async (wordText: string, meaningText?: string) => {
    const trimmed = wordText.trim();
    const key = trimmed.toLowerCase();
    if (wordImages[key] || imageLoading[key]) return;

    setImageLoading(prev => ({ ...prev, [key]: true }));
    setImageError(prev => ({ ...prev, [key]: "" }));

    try {
      const response = await fetch("/api/gemini/word-image-svg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: trimmed, meaning: meaningText })
      });

      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "イメージを生成できませんでした。");
      }

      setWordImages(prev => ({ ...prev, [key]: payload.svg }));
    } catch (err: any) {
      console.error(err);
      setImageError(prev => ({ ...prev, [key]: err.message || "通信または生成エラーが発生しました。" }));
    } finally {
      setImageLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // 1. 検索・フィルター・ソートのステート
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<FilterLevel>("all");
  const [sortBy, setSortBy] = useState<SortOption>("level-asc");
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);

  // アコーディオンが展開された時、自動的に該当する単語のシーン別使われ方頻度データとコンセプトイラストイメージをAIから引き出す
  React.useEffect(() => {
    if (expandedWordId) {
      const found = vocabulary.find(w => w.id === expandedWordId);
      if (found) {
        handleFetchWordFrequency(found.word);
        handleFetchWordImage(found.word, found.translation);
      }
    }
  }, [expandedWordId, vocabulary]);

  // 2. ページネーション用
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // 3. 単語の読み上げ機能
  const handleSpeakWord = (wordText: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(wordText);
        u.lang = "en-US";
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  };

  // 4. データ処理（絞り込み・検索・並べ替え）
  const processedVocabulary = useMemo(() => {
    let result = [...vocabulary];

    // レベル・条件フィルター
    if (filterLevel !== "all") {
      if (filterLevel === "custom") {
        result = result.filter(w => isCustomWordId(w.id));
      } else if (filterLevel === "weak") {
        result = result.filter(w => wrongWords.includes(w.id));
      } else {
        result = result.filter(w => w.level === filterLevel);
      }
    }

    // 検索ワードマッチング
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        w => 
          w.word.toLowerCase().includes(query) || 
          w.translation.toLowerCase().includes(query) ||
          w.sentence.toLowerCase().includes(query)
      );
    }

    // ソート順序の定義
    const levelOrder: Record<Level, number> = {
      junior: 1,
      senior: 2,
      senior2: 3,
      senior3: 4,
      advanced: 5
    };

    result.sort((a, b) => {
      if (sortBy === "alphabetical-asc") {
        return a.word.localeCompare(b.word);
      } else if (sortBy === "alphabetical-desc") {
        return b.word.localeCompare(a.word);
      } else if (sortBy === "level-asc") {
        const orderA = levelOrder[a.level] || 99;
        const orderB = levelOrder[b.level] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.word.localeCompare(b.word); // レベル内はアルファベット
      } else if (sortBy === "level-desc") {
        const orderA = levelOrder[a.level] || 99;
        const orderB = levelOrder[b.level] || 99;
        if (orderA !== orderB) return orderB - orderA;
        return a.word.localeCompare(b.word);
      }
      return 0;
    });

    return result;
  }, [vocabulary, filterLevel, searchQuery, sortBy, wrongWords]);

  // 5. フィルターや検索が変更されたらページを1に戻す
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterLevel, sortBy, pageSize]);

  // 6. ページ分割されたデータ取得
  const totalItems = processedVocabulary.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedVocabulary = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedVocabulary.slice(start, start + pageSize);
  }, [processedVocabulary, currentPage, pageSize]);

  // 各種のバッジ表示用の文言とクラス関数
  const getLevelBadgeProps = (level: Level, isCustom: boolean) => {
    if (isCustom) {
      return {
        text: "追加単語",
        className: "bg-pink-100 text-pink-700 border-pink-200"
      };
    }
    switch (level) {
      case "junior":
        return { text: "初級 (中学)", className: "bg-blue-100 text-blue-700 border-blue-200" };
      case "senior":
        return { text: "中級1 (高1)", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
      case "senior2":
        return { text: "中級2 (高2)", className: "bg-purple-100 text-purple-700 border-purple-200" };
      case "senior3":
        return { text: "中級3 (高3)", className: "bg-pink-100 text-pink-700 border-pink-200" };
      case "advanced":
        return { text: "上級 (社会人)", className: "bg-amber-100 text-amber-700 border-amber-200" };
    }
  };

  return (
    <div className="space-y-6" id="dictionary_section_root">
      {/* 上部ヘッダー（ナビゲーション） */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white border border-gray-150 rounded-3xl p-6 shadow-xs">
        <div className="space-y-1">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition"
            id="btn_back_from_dictionary"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ダッシュボードに戻る</span>
          </button>
          
          <div className="flex items-center gap-2 mt-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">単語辞書一覧</h1>
          </div>
          <p className="text-xs text-gray-400 font-medium">
            全レベルの単語を検索したり、例文を読んで学んだり、発音を確認することができます。
          </p>
        </div>

        {/* 総単語数カウンタ */}
        <div className="flex gap-2 text-right">
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3 px-4 shadow-2xs">
            <span className="text-[10px] text-indigo-400 font-black tracking-wider block uppercase">全収録単語数</span>
            <span className="font-black text-xl text-indigo-950 font-mono">{vocabulary.length}</span>
            <span className="text-xs text-indigo-400 font-bold ml-1">語</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 px-4 shadow-2xs">
            <span className="text-[10px] text-emerald-400 font-black tracking-wider block uppercase">習得済み単語</span>
            <span className="font-black text-xl text-emerald-950 font-mono">
              {vocabulary.filter(w => solvedHistory[w.id] && solvedHistory[w.id].correctCount > 0).length}
            </span>
            <span className="text-xs text-emerald-400 font-bold ml-1">語</span>
          </div>
        </div>
      </div>

      {/* 検索・ソート・フィルターコントロールパネル */}
      <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* 検索フォーム (6 cols) */}
          <div className="md:col-span-6 relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="英単語、日本語訳、例文をキーワード検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-sans"
              id="search_input_vocabulary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* ソートセレクタ (3 cols) */}
          <div className="md:col-span-3 relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
              <ArrowUpDown className="w-4 h-4" />
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
              id="sort_select_vocabulary"
            >
              <option value="level-asc">レベル順 (昇順)</option>
              <option value="level-desc">レベル順 (降順)</option>
              <option value="alphabetical-asc">A - Z (アルファベット順)</option>
              <option value="alphabetical-desc">Z - A (アルファベット逆順)</option>
            </select>
          </div>

          {/* 表示件数 (3 cols) */}
          <div className="md:col-span-3 relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
              <Layers className="w-4 h-4" />
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
              id="pagesize_select_vocabulary"
            >
              <option value={20}>1ページに 20件 表示</option>
              <option value={50}>1ページに 50件 表示</option>
              <option value={100}>1ページに 100件 表示</option>
            </select>
          </div>

        </div>

        {/* フィルター用横スクロールタブ */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1" id="filter_tabs_container">
          <span className="text-xs font-bold text-gray-400 mr-2">絞り込み:</span>
          {(
            [
              { value: "all", label: "すべて" },
              { value: "junior", label: "初級 (中学)" },
              { value: "senior", label: "中級1 (高1)" },
              { value: "senior2", label: "中級2 (高2)" },
              { value: "senior3", label: "中級3 (高3)" },
              { value: "advanced", label: "上級" },
              { value: "custom", label: "追加した単語 (AI/CSV/PDF)" },
              { value: "weak", label: "苦手な単語のみ" }
            ] as const
          ).map((tab) => {
            const isActive = filterLevel === tab.value;
            let count = 0;
            if (tab.value === "all") count = vocabulary.length;
            else if (tab.value === "custom") count = vocabulary.filter(w => isCustomWordId(w.id)).length;
            else if (tab.value === "weak") count = vocabulary.filter(w => wrongWords.includes(w.id)).length;
            else count = vocabulary.filter(w => w.level === tab.value).length;

            return (
              <button
                key={tab.value}
                onClick={() => setFilterLevel(tab.value)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                    : "bg-gray-50 hover:bg-gray-100 border-gray-250 text-gray-600"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                  isActive ? "bg-white/20 text-white" : "bg-gray-200/60 text-gray-500"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 検索・絞り込み結果情報 */}
      <div className="flex items-center justify-between px-2 text-xs font-semibold text-gray-500 font-mono">
        <div>
          該当：<span className="text-indigo-600 font-bold">{totalItems}語</span> 
          {searchQuery && ` (キーワード: "${searchQuery}")`}
        </div>
        <div>
          ページ：{currentPage} / {totalPages}
        </div>
      </div>

      {/* メイン単語アコーディオンリスト */}
      <div className="space-y-2.5" id="dictionary_words_container">
        {paginatedVocabulary.length > 0 ? (
          paginatedVocabulary.map((word) => {
            const isExpanded = expandedWordId === word.id;
            const isCustom = isCustomWordId(word.id);
            const badge = getLevelBadgeProps(word.level, isCustom);
            
            // クイズ習熟度状況判定
            const history = solvedHistory[word.id];
            const isWrong = wrongWords.includes(word.id);
            const isCompleted = history && history.correctCount > 0;
            const attemptCount = history ? history.attemptCount : 0;

            let statusBadge = null;
            if (isWrong) {
              statusBadge = (
                <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                  苦手
                </span>
              );
            } else if (isCompleted) {
              statusBadge = (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  習得済
                </span>
              );
            } else if (attemptCount > 0) {
              statusBadge = (
                <span className="bg-gray-100 text-gray-600 border border-gray-200 text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0">
                  未定着 ({attemptCount}回挑戦)
                </span>
              );
            }

            return (
              <div 
                key={word.id} 
                onClick={() => setExpandedWordId(isExpanded ? null : word.id)}
                className={`bg-white border rounded-2xl p-4.5 cursor-pointer transition-all ${
                  isExpanded 
                    ? "border-indigo-300 ring-2 ring-indigo-600/10 shadow-sm" 
                    : "border-gray-150 hover:border-gray-300 hover:bg-gray-50/20"
                }`}
                id={`dictionary_word_item_${word.id}`}
              >
                <div className="flex items-center justify-between gap-4">
                  
                  {/* 単語英語 + バッジ */}
                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase font-mono tracking-tight shrink-0 ${badge?.className}`}>
                      {badge?.text}
                    </span>
                    
                    <span className="text-gray-900 font-extrabold text-lg font-mono tracking-wide select-all truncate">
                      {word.word}
                    </span>

                    {/* 発音スピーカーボタン */}
                    <button
                      onClick={(e) => handleSpeakWord(word.word, e)}
                      className="p-1 px-1.5 bg-gray-50 hover:bg-gray-200/70 border border-gray-150 rounded-lg text-gray-400 hover:text-gray-600 transition shrink-0"
                      title="発音を再生"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>

                    {/* 発音記号(IPA) */}
                    <Phonetic word={word.word} className="text-xs shrink-0" />

                    {/* 品詞バッジ */}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-500 shrink-0">
                      {getWordPosLabel(word)}
                    </span>

                    {/* 習得ステータス */}
                    {statusBadge}
                  </div>

                  {/* 日本語訳（初期状態で少し見せておく、幅調整のためtruncate） */}
                  <div className="flex items-center gap-2 max-w-[40%] text-right shrink-0">
                    <span className="text-sm font-extrabold text-indigo-950 font-sans truncate">
                      {word.translation}
                    </span>
                    <ChevronRight className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-90 text-indigo-600" : ""}`} />
                  </div>

                </div>

                {/* 詳細開閉ブロック */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 border-t border-gray-100 pt-4 space-y-4 text-xs md:text-sm" onClick={(e) => e.stopPropagation()}>
                        
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* 左側: 和訳詳細と例文 */}
                          <div className="md:col-span-8 space-y-4">
                            {/* 和訳詳細 */}
                            <div className="grid grid-cols-12 bg-indigo-50/30 border border-indigo-100 p-3.5 rounded-xl gap-2 items-center">
                              <div className="col-span-3 font-black text-indigo-700/80 flex items-center gap-1">
                                <GraduationCap className="w-4 h-4" />
                                <span>正しい日本語訳:</span>
                              </div>
                              <div className="col-span-9 font-black text-indigo-900 text-sm md:text-base">
                                {word.translation}
                              </div>
                            </div>

                            {/* 例文セクション */}
                            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-2">
                              <p className="font-extrabold text-gray-400 text-xs">例文 (穴埋めテスト用文脈):</p>
                              
                              {/* 例文を表示。穴埋めの場所もわかりやすく。 */}
                              <div className="pl-1 space-y-2">
                                <p className="font-sans font-extrabold text-gray-800 italic text-sm md:text-base leading-relaxed tracking-wide">
                                  {/* [_____] を 補完済みの英単語に置換して太字＆アンダーライン表示 */}
                                  {word.sentence.includes("[_____]") ? (
                                    <>
                                      {word.sentence.split("[_____]")[0]}
                                      <span className="bg-indigo-100 border-b-2 border-indigo-600 px-1 font-mono text-indigo-800 rounded mx-0.5 italic not-italic font-black">
                                        {word.word}
                                      </span>
                                      {word.sentence.split("[_____]")[1]}
                                    </>
                                  ) : (
                                    word.sentence
                                  )}
                                </p>
                                <p className="text-gray-500 font-bold pl-0.5 text-xs md:text-sm">
                                  訳: {word.sentenceTranslation}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* 右側: AI自動生成ビジュアルイメージ */}
                          <div className="md:col-span-4 flex flex-col justify-between">
                            <div className="border border-indigo-100 rounded-2xl overflow-hidden bg-white shadow-3xs p-3.5 flex flex-col h-full items-center justify-center min-h-[165px] relative">
                              {/* ヘッダー */}
                              <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-gray-100 text-[11px]">
                                <span className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 fill-indigo-250 animate-pulse" />
                                  <span>AI 概念イメージ</span>
                                </span>
                                <span className="text-[9px] bg-indigo-100 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                                  Concept
                                </span>
                              </div>

                              {/* コンテンツ */}
                              {imageLoading[word.word.trim().toLowerCase()] ? (
                                <div className="flex flex-col items-center justify-center py-6 space-y-2 h-full">
                                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                                  <span className="text-[10px] text-indigo-600 font-extrabold">AIイメージ創出中...</span>
                                </div>
                              ) : imageError[word.word.trim().toLowerCase()] ? (
                                <div className="text-center p-2 flex flex-col items-center justify-center h-full">
                                  <AlertCircle className="w-5 h-5 text-rose-500 mb-1" />
                                  <p className="text-[10px] text-gray-500 font-semibold leading-normal">
                                    画像の生成に失敗しました
                                  </p>
                                  <button
                                    onClick={() => handleFetchWordImage(word.word, word.translation)}
                                    className="mt-2 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[9px] font-bold rounded transition flex items-center gap-1"
                                  >
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    <span>再試行</span>
                                  </button>
                                </div>
                              ) : wordImages[word.word.trim().toLowerCase()] ? (
                                <div className="w-full flex flex-col items-center justify-center">
                                  {/* インラインHTMLとしてSVGを埋め込む */}
                                  <div 
                                    className="w-full max-w-[120px] aspect-square shadow-xs rounded-xl overflow-hidden border border-indigo-50 flex items-center justify-center bg-gray-50 hover:scale-105 transition duration-300 select-none cursor-pointer"
                                    dangerouslySetInnerHTML={{ __html: wordImages[word.word.trim().toLowerCase()] }}
                                    title="クリックして画像を再生成"
                                    onClick={() => {
                                      const key = word.word.trim().toLowerCase();
                                      setWordImages(prev => {
                                        const updated = { ...prev };
                                        delete updated[key];
                                        return updated;
                                      });
                                      handleFetchWordImage(word.word, word.translation);
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      const key = word.word.trim().toLowerCase();
                                      setWordImages(prev => {
                                        const updated = { ...prev };
                                        delete updated[key];
                                        return updated;
                                      });
                                      handleFetchWordImage(word.word, word.translation);
                                    }}
                                    className="mt-2 text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold hover:underline inline-flex items-center gap-1"
                                  >
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    <span>イメージを再生成</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="text-center py-6">
                                  <button
                                    onClick={() => handleFetchWordImage(word.word, word.translation)}
                                    className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-extrabold rounded-lg hover:bg-indigo-100 transition inline-flex items-center gap-1"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 fill-indigo-250" />
                                    <span>AIでイメージを自動生成</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* —————————— AI単語使用頻度分析セクション —————————— */}
                        <div className="border border-indigo-100 rounded-2xl overflow-hidden bg-white shadow-3xs">
                          {/* セクションヘッダー */}
                          <div className="bg-gradient-to-r from-indigo-50 to-indigo-50/30 p-3.5 px-4 border-b border-indigo-100 flex items-center justify-between">
                            <h4 className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600 fill-indigo-200" />
                              <span>AI 頻度・シチュエーション別使われ方分析</span>
                            </h4>
                            <span className="text-[9px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider font-mono">
                              Gemini Analytics
                            </span>
                          </div>

                          {/* コンテンツエリア */}
                          <div className="p-4 space-y-4">
                            {frequencyLoading[word.word.trim().toLowerCase()] ? (
                              <div className="flex flex-col items-center justify-center py-6 space-y-2">
                                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                                <p className="text-[11px] font-black text-indigo-600">AIが使われ方の統計情報を展開中...</p>
                              </div>
                            ) : frequencyError[word.word.trim().toLowerCase()] ? (
                              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5">
                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <p className="text-[11px] font-extrabold text-rose-800">
                                    頻度データの取得に失敗しました。
                                  </p>
                                  <p className="text-[10px] text-rose-600 font-semibold">{frequencyError[word.word.trim().toLowerCase()]}</p>
                                  <button
                                    onClick={() => handleFetchWordFrequency(word.word)}
                                    className="px-2.5 py-1 bg-white hover:bg-rose-100 border border-rose-250 text-rose-700 text-[10px] font-bold rounded-lg transition"
                                  >
                                    再接続・再試行
                                  </button>
                                </div>
                              </div>
                            ) : wordFrequencies[word.word.trim().toLowerCase()] ? (
                              (() => {
                                const freqData = wordFrequencies[word.word.trim().toLowerCase()];
                                const { frequencies, overallComment, usageExamples } = freqData;

                                return (
                                  <div className="space-y-4">
                                    {/* 簡易推定フォールバック時の明示的な警告 */}
                                    {freqData.isFallback && (
                                      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="text-[11px] leading-relaxed">
                                          <p className="font-black text-amber-900 dark:text-amber-300">これはAI分析ではありません（簡易推定）</p>
                                          <p className="text-amber-800 dark:text-amber-400 font-semibold mt-0.5">
                                            AIへの接続に失敗したため、綴りの語尾パターンによる大まかな推定値を表示しています。正確な分析は下の「再分析」からお試しください。
                                          </p>
                                          <button
                                            onClick={() => handleFetchWordFrequency(word.word)}
                                            className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
                                          >
                                            AIで再分析する
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* 3つのドメインの頻度比較メーター */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                      
                                      {/* 日常会話 (everyday) */}
                                      <div className="bg-blue-50/20 border border-blue-100 rounded-xl p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-blue-800 font-extrabold text-xs">
                                            <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                                            <span>日常会話での頻度</span>
                                          </div>
                                          <span className="text-[10px] font-black text-blue-700 font-mono">
                                            {frequencies?.everyday?.label || "普通"}
                                          </span>
                                        </div>
                                        
                                        {/* メーターバー */}
                                        <div className="h-2 bg-blue-100 rounded-full overflow-hidden relative">
                                          <div 
                                            className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all duration-700" 
                                            style={{ width: `${frequencies?.everyday?.percentage || 50}%` }}
                                          />
                                        </div>
                                        <p className="text-[11px] text-gray-500 leading-relaxed font-semibold pl-0.5">
                                          {frequencies?.everyday?.description}
                                        </p>
                                        
                                        {/* 日常の例文 */}
                                        {usageExamples?.everyday && (
                                          <div className="border-t border-blue-50 pt-2 mt-2 space-y-1">
                                            <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">日常例文</span>
                                            <p className="text-[11px] font-bold text-gray-800 font-sans italic">
                                              "{usageExamples.everyday.sentence}"
                                            </p>
                                            <p className="text-[10px] text-gray-500 font-medium font-sans">
                                              訳: {usageExamples.everyday.translation}
                                            </p>
                                          </div>
                                        )}
                                      </div>

                                      {/* ビジネス (business) */}
                                      <div className="bg-amber-50/20 border border-amber-100 rounded-xl p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-amber-800 font-extrabold text-xs">
                                            <Briefcase className="w-3.5 h-3.5 text-amber-500" />
                                            <span>ビジネスでの頻度</span>
                                          </div>
                                          <span className="text-[10px] font-black text-amber-700 font-mono">
                                            {frequencies?.business?.label || "普通"}
                                          </span>
                                        </div>
                                        
                                        {/* メーターバー */}
                                        <div className="h-2 bg-amber-100 rounded-full overflow-hidden relative">
                                          <div 
                                            className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-700" 
                                            style={{ width: `${frequencies?.business?.percentage || 50}%` }}
                                          />
                                        </div>
                                        <p className="text-[11px] text-gray-500 leading-relaxed font-semibold pl-0.5">
                                          {frequencies?.business?.description}
                                        </p>

                                        {/* ビジネスの例文 */}
                                        {usageExamples?.business && (
                                          <div className="border-t border-amber-50 pt-2 mt-2 space-y-1">
                                            <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">ビジネス例文</span>
                                            <p className="text-[11px] font-bold text-gray-800 font-sans italic">
                                              "{usageExamples.business.sentence}"
                                            </p>
                                            <p className="text-[10px] text-gray-500 font-medium font-sans">
                                              訳: {usageExamples.business.translation}
                                            </p>
                                          </div>
                                        )}
                                      </div>

                                      {/* 学術・講義 (academic) */}
                                      <div className="bg-purple-50/20 border border-purple-100 rounded-xl p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-purple-800 font-extrabold text-xs">
                                            <GraduationCap className="w-3.5 h-3.5 text-purple-500" />
                                            <span>学術（論文など）での頻度</span>
                                          </div>
                                          <span className="text-[10px] font-black text-purple-700 font-mono">
                                            {frequencies?.academic?.label || "普通"}
                                          </span>
                                        </div>
                                        
                                        {/* メーターバー */}
                                        <div className="h-2 bg-purple-100 rounded-full overflow-hidden relative">
                                          <div 
                                            className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all duration-700" 
                                            style={{ width: `${frequencies?.academic?.percentage || 50}%` }}
                                          />
                                        </div>
                                        <p className="text-[11px] text-gray-500 leading-relaxed font-semibold pl-0.5">
                                          {frequencies?.academic?.description}
                                        </p>

                                        {/* アカデミックの例文 */}
                                        {usageExamples?.academic && (
                                          <div className="border-t border-purple-50 pt-2 mt-2 space-y-1">
                                            <span className="text-[9px] font-black bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">学術例文</span>
                                            <p className="text-[11px] font-bold text-gray-800 font-sans italic">
                                              "{usageExamples.academic.sentence}"
                                            </p>
                                            <p className="text-[10px] text-gray-500 font-medium font-sans">
                                              訳: {usageExamples.academic.translation}
                                            </p>
                                          </div>
                                        )}
                                      </div>

                                    </div>

                                    {/* AI総合ニュアンスコメント */}
                                    {overallComment && (
                                      <div className="bg-indigo-50/30 border border-indigo-100/70 rounded-xl p-3 px-3.5 text-[11px] md:text-xs">
                                        <div className="font-extrabold text-indigo-950 mb-1 flex items-center gap-1 justify-between">
                                          <div className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                            <span>AIによる総合ニュアンス・アドバイス:</span>
                                          </div>
                                          {freqData.isFallback && (
                                            <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[9px] px-1.5 py-0.5 rounded-full font-black shrink-0">
                                              ローカルフォールバック
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-gray-600 dark:text-slate-350 leading-relaxed font-semibold pr-4">
                                          {overallComment}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="flex flex-col items-center justify-center py-4 space-y-2">
                                <p className="text-[11px] text-gray-400 font-semibold">使用頻度のデータが待機中です。</p>
                                <button
                                  onClick={() => handleFetchWordFrequency(word.word)}
                                  className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-extrabold rounded-lg hover:bg-indigo-100 transition"
                                >
                                  AI頻度分析を読み込む
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* —————————— 類義語・反意語・コロケーションセクション —————————— */}
                        <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden">
                          <div className="bg-teal-50/60 border-b border-teal-100/60 px-4 py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-teal-800 font-extrabold text-xs">
                              <Layers className="w-3.5 h-3.5 text-teal-600" />
                              <span>AI 類義語・反意語・コロケーション</span>
                            </div>
                          </div>
                          <div className="p-4">
                            {(() => {
                              const relKey = word.word.trim().toLowerCase();
                              const relData = wordRelations[relKey];
                              if (relationsLoading[relKey]) {
                                return (
                                  <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-xs font-bold">
                                    <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
                                    <span>AIが語彙のつながりを分析しています...</span>
                                  </div>
                                );
                              }
                              if (relationsError[relKey]) {
                                return (
                                  <div className="flex flex-col items-center gap-2 py-4">
                                    <p className="text-[10px] text-rose-600 font-semibold">{relationsError[relKey]}</p>
                                    <button
                                      onClick={() => {
                                        setRelationsError(prev => ({ ...prev, [relKey]: "" }));
                                        handleFetchWordRelations(word.word, word.translation);
                                      }}
                                      className="px-3 py-1 bg-teal-50 text-teal-700 border border-teal-100 text-[10px] font-extrabold rounded-lg hover:bg-teal-100 transition cursor-pointer"
                                    >
                                      再試行
                                    </button>
                                  </div>
                                );
                              }
                              if (relData) {
                                return (
                                  <div className="space-y-4 text-xs">
                                    {/* 類義語 */}
                                    {relData.synonyms && relData.synonyms.length > 0 && (
                                      <div>
                                        <span className="text-[10px] font-black text-teal-700 uppercase tracking-wide block mb-2">類義語 (Synonyms)</span>
                                        <div className="space-y-2">
                                          {relData.synonyms.map((s: any, i: number) => (
                                            <div key={i} className="bg-teal-50/40 border border-teal-100/60 rounded-xl p-2.5">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono font-extrabold text-sm text-gray-900">{s.word}</span>
                                                <span className="text-gray-500 font-semibold">{s.translation}</span>
                                              </div>
                                              {s.nuance && (
                                                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{s.nuance}</p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* 反意語 */}
                                    {relData.antonyms && relData.antonyms.length > 0 && (
                                      <div>
                                        <span className="text-[10px] font-black text-rose-700 uppercase tracking-wide block mb-2">反意語 (Antonyms)</span>
                                        <div className="flex flex-wrap gap-2">
                                          {relData.antonyms.map((a: any, i: number) => (
                                            <span key={i} className="bg-rose-50/60 border border-rose-100 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                                              <span className="font-mono font-extrabold text-gray-900">{a.word}</span>
                                              <span className="text-gray-500 font-semibold text-[11px]">{a.translation}</span>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* コロケーション */}
                                    {relData.collocations && relData.collocations.length > 0 && (
                                      <div>
                                        <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wide block mb-2">コロケーション (よく使われる組み合わせ)</span>
                                        <div className="space-y-1.5">
                                          {relData.collocations.map((c: any, i: number) => (
                                            <div key={i} className="flex items-baseline justify-between gap-3 bg-indigo-50/40 border border-indigo-100/60 rounded-lg px-3 py-2">
                                              <span className="font-mono font-bold text-gray-900">{c.phrase}</span>
                                              <span className="text-gray-500 font-semibold text-[11px] text-right shrink-0">{c.translation}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return (
                                <div className="flex flex-col items-center justify-center py-4 space-y-2">
                                  <p className="text-[11px] text-gray-400 font-semibold">
                                    類義語・反意語・よく使われる組み合わせをAIが解説します。
                                  </p>
                                  <button
                                    onClick={() => handleFetchWordRelations(word.word, word.translation)}
                                    className="px-3 py-1 bg-teal-50 text-teal-700 border border-teal-100 text-[10px] font-extrabold rounded-lg hover:bg-teal-100 transition cursor-pointer"
                                  >
                                    語彙のつながりを分析する
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* 四択時の選択肢などの学習参考情報 */}
                        {word.options && word.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-gray-50/50 border border-gray-150 p-3 rounded-xl">
                              <span className="text-[10px] font-bold text-gray-400 block uppercase mb-1">英単語クイズ 四択選択肢</span>
                              <div className="flex flex-wrap gap-1.5">
                                {word.options.map((opt, i) => (
                                  <span 
                                    key={i} 
                                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${
                                      opt === word.translation 
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-250 font-extrabold" 
                                        : "bg-white text-gray-600 border border-gray-200"
                                    }`}
                                  >
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {word.sentenceOptions && word.sentenceOptions.length > 0 && (
                              <div className="bg-gray-50/50 border border-gray-150 p-3 rounded-xl">
                                <span className="text-[10px] font-bold text-gray-400 block uppercase mb-1">例文クイズ 英語スペル選択肢</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {word.sentenceOptions.map((opt, i) => (
                                    <span 
                                      key={i} 
                                      className={`text-xs px-2.5 py-1 rounded-lg font-mono font-bold ${
                                        opt === word.word 
                                          ? "bg-indigo-100 text-indigo-800 border border-indigo-250 font-extrabold" 
                                          : "bg-white text-gray-600 border border-gray-200"
                                      }`}
                                    >
                                      {opt}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 学習履歴詳細 */}
                        {attemptCount > 0 && (
                          <p className="text-[10px] text-gray-400 text-right italic">
                            これまでにこの単語を合計 <span className="font-extrabold font-mono text-gray-600">{attemptCount} 回</span> 回答し、
                            そのうち正答数は <span className="font-extrabold font-mono text-emerald-600">{history ? history.correctCount : 0} 回</span> です。
                          </p>
                        )}

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        ) : (
          <div className="text-center py-16 bg-white border rounded-3xl" id="dictionary_empty_state">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-800 font-extrabold text-base">該当する単語は見つかりませんでした</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
              キーワードを変更するか、絞り込みフィルターを切り替えてみてください。自分で追加した単語を検索するのもおすすめです。
            </p>
          </div>
        )}
      </div>

      {/* ページネーションコントロール */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-gray-150 rounded-2xl p-4 shadow-2xs font-mono text-xs text-gray-600">
          <div>
            表示中：<span className="font-bold text-gray-800">{(currentPage - 1) * pageSize + 1}</span> - <span className="font-bold text-gray-800">{Math.min(currentPage * pageSize, totalItems)}</span> 件目 / 全 <span className="font-bold text-indigo-600">{totalItems}</span> 件
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-250 rounded-lg disabled:opacity-40 disabled:hover:bg-gray-50 font-black cursor-pointer transition"
            >
              &lt;&lt;
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-250 rounded-lg disabled:opacity-40 disabled:hover:bg-gray-50 font-bold cursor-pointer transition"
            >
              前へ
            </button>

            {/* 周辺ページ番号を表示（最大5ページ程度） */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              // currentPage を中心にした5ページを算出
              let pageNum = currentPage - 2 + idx;
              if (currentPage <= 2) {
                pageNum = idx + 1;
              } else if (currentPage >= totalPages - 1) {
                pageNum = totalPages - 4 + idx;
              }
              // ガード
              if (pageNum < 1 || pageNum > totalPages) return null;

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg font-bold border transition transition-all cursor-pointer ${
                    currentPage === pageNum
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                      : "bg-gray-50 hover:bg-gray-100 border-gray-250 text-gray-700"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-250 rounded-lg disabled:opacity-40 disabled:hover:bg-gray-50 font-bold cursor-pointer transition"
            >
              次へ
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-250 rounded-lg disabled:opacity-40 disabled:hover:bg-gray-50 font-black cursor-pointer transition"
            >
              &gt;&gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
