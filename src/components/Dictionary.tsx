import React, { useState, useMemo } from "react";
import { pageWindow } from "../pagination";
import { motion, AnimatePresence } from "motion/react";
import { 
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
  RefreshCw,
  Flame
} from "lucide-react";
import { Word, Level, PartOfSpeech } from "../types";
import Phonetic from "./Phonetic";
import { getWordPos, getWordPosLabel, POS_LABELS } from "../pos";
import { LEVEL_LABELS, LEVEL_STAGES } from "../levelLabels";
import WordSenses from "./WordSenses";
import WordUsageInfo from "./WordUsage";
import { SrsState } from "../srs";
import { isMastered } from "../mastery";
import { LEVEL_TONE, TONE_STYLE, CUSTOM_TONE } from "../levelTheme";
import { readJsonResponse } from "../apiClient";

interface DictionaryProps {
  vocabulary: Word[];
  wrongWords: string[];
  /**
   * 苦手リストの出し入れ。
   *
   * これまで苦手リストに語が入る道は「クイズで間違える」だけだった。
   * 辞書は苦手で絞り込めるのに追加はできず、
   * 「この語は苦手だ」と自分で分かっている語をその場で復習に回せなかった。
   */
  setWrongWords: React.Dispatch<React.SetStateAction<string[]>>;
  solvedHistory: Record<string, { correctCount: number; attemptCount: number }>;
  srsData: Record<string, SrsState>;
  /** 以前は「ダッシュボードに戻る」に使っていた。いまはタブで移るので使わない */
  onBackToDashboard?: () => void;
  /** 文型の説明にあたる文法項目を開く */
  onOpenGrammar?: (topicId: string) => void;
}

type FilterLevel = "all" | Level | "custom" | "weak";
type SortOption = "alphabetical-asc" | "alphabetical-desc" | "level-asc" | "level-desc";
/** 品詞の絞り込み。"all" は絞らない */
type FilterPos = "all" | PartOfSpeech;

/**
 * 品詞の絞り込みに並べる順。
 * 「その他」は前置詞・接続詞・イディオムなどが入る受け皿で、
 * 出さないとどの品詞でも辿り着けない語ができてしまうので最後に置く。
 */
const POS_FILTERS: PartOfSpeech[] = ["noun", "verb", "adjective", "adverb", "other"];

// ユーザーが追加した単語（AI追加・CSVインポート・PDF抽出）の判定
const isCustomWordId = (id: string) => /^(ai_|csv_|pdf_)/.test(id);

// AI分析結果のキャッシュ用キー。
// 単語をそのままオブジェクトのキーにすると、"constructor" や "valueOf" のような
// Object.prototype のプロパティ名と一致する実在の英単語（ユーザーがAI追加・CSV・PDFで
// 登録しうる）で `cache[word]` が常に真を返してしまう。
// その結果、取得処理が早期リターンして走らず、画面は「AIが展開中...」のまま
// 永久に止まる。接頭辞を付けて衝突を避ける。
const cacheKey = (word: string) => "w:" + word.trim().toLowerCase();


export default function Dictionary({
  vocabulary,
  wrongWords,
  setWrongWords,
  solvedHistory,
  srsData,
  onOpenGrammar
}: DictionaryProps) {
  // AI単語使用頻度の情報キャッシュ
  const [wordFrequencies, setWordFrequencies] = useState<Record<string, any>>({});
  const [frequencyLoading, setFrequencyLoading] = useState<Record<string, boolean>>({});
  const [frequencyError, setFrequencyError] = useState<Record<string, string>>({});

  // 類義語・反意語・コロケーションの情報キャッシュ
  const [wordRelations, setWordRelations] = useState<Record<string, any>>({});
  const [relationsLoading, setRelationsLoading] = useState<Record<string, boolean>>({});
  const [relationsError, setRelationsError] = useState<Record<string, string>>({});

  const handleFetchWordRelations = async (wordText: string, translationText?: string) => {
    const trimmed = wordText.trim();
    const key = cacheKey(wordText);
    if (wordRelations[key] || relationsLoading[key]) return;

    setRelationsLoading(prev => ({ ...prev, [key]: true }));
    setRelationsError(prev => ({ ...prev, [key]: "" }));

    try {
      const response = await fetch("/api/gemini/word-relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: trimmed, translation: translationText })
      });

      const payload = await readJsonResponse(response);
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "類義語・反意語を取得できませんでした。");
      }

      // 描画側は synonyms などを `xxx && xxx.length > 0` で確認してから map する。
      // 文字列が入っていると length は通るが map で例外になり、画面が失われる。
      const toList = (v: any) => (Array.isArray(v) ? v.filter(x => x != null) : []);
      setWordRelations(prev => ({
        ...prev,
        [key]: {
          ...payload,
          synonyms: toList(payload?.synonyms),
          antonyms: toList(payload?.antonyms),
          collocations: toList(payload?.collocations)
        }
      }));
    } catch (err: any) {
      console.error(err);
      setRelationsError(prev => ({ ...prev, [key]: err.message || "通信または解析エラーが発生しました。" }));
    } finally {
      setRelationsLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleFetchWordFrequency = async (wordText: string) => {
    const trimmed = wordText.trim();
    const key = cacheKey(wordText);
    if (wordFrequencies[key] || frequencyLoading[key]) return;

    setFrequencyLoading(prev => ({ ...prev, [key]: true }));
    setFrequencyError(prev => ({ ...prev, [key]: "" }));

    try {
      const response = await fetch("/api/gemini/word-frequency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: trimmed })
      });

      const payload = await readJsonResponse(response);
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

  // 1. 検索・フィルター・ソートのステート
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<FilterLevel>("all");
  const [filterPos, setFilterPos] = useState<FilterPos>("all");
  const [sortBy, setSortBy] = useState<SortOption>("level-asc");
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);

  // アコーディオンを開いたときに、その単語の使用頻度の分析を取りに行く
  React.useEffect(() => {
    if (expandedWordId) {
      const found = vocabulary.find(w => w.id === expandedWordId);
      if (found) handleFetchWordFrequency(found.word);
    }
  }, [expandedWordId, vocabulary]);

  // 2. ページネーション用
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  /**
   * 並び順と絞り込みの欄を開いているか。既定は畳む。
   * 開いたままだと、スマホでは検索・並び順・件数・レベル8つ・品詞6つで
   * 最初の1画面が埋まり、単語の一覧が画面の外から始まっていた。
   */
  const [showFilters, setShowFilters] = useState(false);
  const filterLevelLabel = (v: FilterLevel) =>
    v === "custom" ? "追加した単語" : v === "weak" ? "苦手な単語" : v === "all" ? "すべて" : LEVEL_LABELS[v];

  // ページ送り用。切替後にリスト最下部へ留まったままにならないよう、単語リストの先頭へスクロールする
  // （behavior: "smooth" はタブ非表示中にアニメーションが走らず不発になるため即時スクロールにする）
  const goToPage = (page: number) => {
    setCurrentPage(page);
    document.getElementById("dictionary_words_container")?.scrollIntoView({ block: "start" });
  };

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

  // 苦手単語の判定用セット。配列のまま includes で引くと、収録約7,700語に対して
  // O(単語数 × 苦手単語数) の走査が毎レンダー発生するため Set にする。
  const wrongWordSet = useMemo(() => new Set(wrongWords), [wrongWords]);

  // 習得済み語数（間隔反復のボックス2以上）
  const masteredCount = useMemo(
    () => vocabulary.filter(w => isMastered(w.id, solvedHistory, srsData)).length,
    [vocabulary, solvedHistory, srsData]
  );

  // 4. データ処理（絞り込み・検索・並べ替え）
  const processedVocabulary = useMemo(() => {
    let result = [...vocabulary];

    // レベル・条件フィルター
    if (filterLevel !== "all") {
      if (filterLevel === "custom") {
        result = result.filter(w => isCustomWordId(w.id));
      } else if (filterLevel === "weak") {
        result = result.filter(w => wrongWordSet.has(w.id));
      } else {
        result = result.filter(w => w.level === filterLevel);
      }
    }

    // 品詞での絞り込み。明示が無い語は綴りと訳から推定した品詞で扱う
    // （クイズの誤選択肢を選ぶときと同じ判定なので、画面ごとに違う品詞にならない）
    if (filterPos !== "all") {
      result = result.filter(w => getWordPos(w) === filterPos);
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
  }, [vocabulary, filterLevel, filterPos, searchQuery, sortBy, wrongWordSet]);

  // 各絞り込みタブの件数。以前はタブごとに vocabulary 全体を filter していたため、
  // 検索欄に1文字入力するたびに全単語の走査が7回発生していた。1パスで集計する。
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: vocabulary.length,
      junior: 0,
      senior: 0,
      senior2: 0,
      senior3: 0,
      advanced: 0,
      custom: 0,
      weak: 0
    };
    for (const w of vocabulary) {
      if (w.level in counts) counts[w.level]++;
      if (isCustomWordId(w.id)) counts.custom++;
      if (wrongWordSet.has(w.id)) counts.weak++;
    }
    return counts;
  }, [vocabulary, wrongWordSet]);

  // 品詞ごとの件数。レベルの絞り込みと同じ1パスの数え方にする
  const posCounts = useMemo(() => {
    const counts: Record<string, number> = { all: vocabulary.length };
    for (const p of POS_FILTERS) counts[p] = 0;
    for (const w of vocabulary) counts[getWordPos(w)]++;
    return counts;
  }, [vocabulary]);

  // 5. フィルターや検索が変更されたらページを1に戻す
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterLevel, filterPos, sortBy, pageSize]);

  // 6. ページ分割されたデータ取得
  const totalItems = processedVocabulary.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedVocabulary = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedVocabulary.slice(start, start + pageSize);
  }, [processedVocabulary, currentPage, pageSize]);

  // 各種のバッジ表示用の文言とクラス関数
  const getLevelBadgeProps = (level: Level, isCustom: boolean) => {
    // 色はレベルの色に合わせる（src/levelTheme.ts）。
    // 追加単語はレベルを持たないので、5段階のどれとも重ならない色にする
    const badge = `${TONE_STYLE.badge} border-[var(--lv-border)]`;
    if (isCustom) {
      return { text: "追加単語", className: `${CUSTOM_TONE} ${badge}` };
    }
    return { text: LEVEL_LABELS[level], className: `${LEVEL_TONE[level]} ${badge}` };
  };

  return (
    <div className="space-y-4" id="dictionary_section_root">
      {/* 見出し。辞書は画面下のタブ（調べる）から開く画面なので、戻るは置かない。
          カードの外に出しているので、背景の飾りや写真に紛れないよう地の色を不透明で敷く */}
      <div className="flex items-end justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-50">
        <h1 className="text-2xl font-bold text-gray-900">調べる</h1>
        <p className="text-sm text-gray-500 tabular-nums" id="dictionary_counts">
          収録 {vocabulary.length.toLocaleString()}語・覚えた {masteredCount.toLocaleString()}語
        </p>
      </div>

      {/* 検索・ソート・フィルターコントロールパネル */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          {/* 検索フォーム */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-500">
              <Search className="w-5 h-5" aria-hidden="true" />
            </span>
            <input
              type="search"
              placeholder="英単語・日本語・例文で検索"
              aria-label="単語を検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-12 pl-11 pr-11 bg-white border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              id="search_input_vocabulary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="検索語を消す"
                className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-gray-500 hover:text-gray-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              aria-expanded={showFilters}
              aria-controls="dictionary_filters"
              id="btn_toggle_dictionary_filters"
              className="min-h-10 px-3.5 rounded-full border border-gray-200 bg-white text-gray-900 text-sm font-medium flex items-center gap-1.5 cursor-pointer hover:border-gray-400"
            >
              <ArrowUpDown className="w-4 h-4 text-gray-500" aria-hidden="true" />
              並び順・絞り込み
              {(filterLevel !== "all" ? 1 : 0) + (filterPos !== "all" ? 1 : 0) > 0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-rose-700 text-white text-xs flex items-center justify-center">
                  {(filterLevel !== "all" ? 1 : 0) + (filterPos !== "all" ? 1 : 0)}
                </span>
              )}
            </button>
            {/* 畳んでいても、効いている絞り込みは見えるようにする */}
            {filterLevel !== "all" && (
              <button
                type="button"
                onClick={() => setFilterLevel("all")}
                className="min-h-10 px-3 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium cursor-pointer"
                aria-label={`${filterLevelLabel(filterLevel)}の絞り込みを外す`}
              >
                {filterLevelLabel(filterLevel)} ×
              </button>
            )}
            {filterPos !== "all" && (
              <button
                type="button"
                onClick={() => setFilterPos("all")}
                className="min-h-10 px-3 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium cursor-pointer"
                aria-label={`${POS_LABELS[filterPos]}の絞り込みを外す`}
              >
                {POS_LABELS[filterPos]} ×
              </button>
            )}
          </div>

        {showFilters && (
        <div className="space-y-4 pt-1" id="dictionary_filters">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* ソートセレクタ */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-500">
              <ArrowUpDown className="w-4 h-4" aria-hidden="true" />
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full min-h-12 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition appearance-none cursor-pointer"
              id="sort_select_vocabulary"
              aria-label="並び順"
            >
              <option value="level-asc">レベル順 (昇順)</option>
              <option value="level-desc">レベル順 (降順)</option>
              <option value="alphabetical-asc">A - Z (アルファベット順)</option>
              <option value="alphabetical-desc">Z - A (アルファベット逆順)</option>
            </select>
          </div>

          {/* 表示件数 */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-500">
              <Layers className="w-4 h-4" aria-hidden="true" />
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="w-full min-h-12 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition appearance-none cursor-pointer"
              id="pagesize_select_vocabulary"
              aria-label="1ページの件数"
            >
              <option value={20}>1ページに 20件 表示</option>
              <option value={50}>1ページに 50件 表示</option>
              <option value={100}>1ページに 100件 表示</option>
            </select>
          </div>

        </div>

        {/* フィルター用横スクロールタブ */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1" id="filter_tabs_container">
          <span className="text-sm text-gray-600 mr-1">レベル</span>
          {(
            [
              { value: "all", label: "すべて" },
              { value: "junior", label: LEVEL_LABELS.junior },
              { value: "senior", label: LEVEL_LABELS.senior },
              { value: "senior2", label: LEVEL_LABELS.senior2 },
              { value: "senior3", label: LEVEL_LABELS.senior3 },
              { value: "advanced", label: LEVEL_LABELS.advanced },
              { value: "custom", label: "追加した単語 (AI/CSV/PDF)" },
              { value: "weak", label: "苦手な単語のみ" }
            ] as const
          ).map((tab) => {
            const isActive = filterLevel === tab.value;
            const count = tabCounts[tab.value] || 0;

            return (
              <button
                key={tab.value}
                onClick={() => setFilterLevel(tab.value)}
                className={`text-sm px-3 min-h-10 rounded-full border transition cursor-pointer ${
                  isActive
                    ? "bg-indigo-50 border-indigo-600 text-indigo-800 font-bold"
                    : "bg-white hover:border-gray-400 border-gray-200 text-gray-700 font-medium"
                }`}
              >
                <span>{tab.label}</span>
                <span className="ml-1.5 text-xs tabular-nums text-gray-500">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 品詞での絞り込み。名詞だけ・動詞だけをまとめて見たいときに使う。
            明示が無い語は綴りと訳から推定した品詞で数える */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1" id="pos_filter_container" data-testid="pos_filter">
          <span className="text-sm text-gray-600 mr-1">品詞</span>
          {([{ value: "all" as const, label: "すべて" },
             ...POS_FILTERS.map(p => ({ value: p, label: POS_LABELS[p] }))]
          ).map(tab => {
            const isActive = filterPos === tab.value;
            const count = posCounts[tab.value] || 0;
            return (
              <button
                key={tab.value}
                onClick={() => setFilterPos(tab.value)}
                id={`pos_filter_${tab.value}`}
                aria-pressed={isActive}
                className={`text-sm px-3 min-h-10 rounded-full border transition cursor-pointer ${
                  isActive
                    ? "bg-indigo-50 border-indigo-600 text-indigo-800 font-bold"
                    : "bg-white hover:border-gray-400 border-gray-200 text-gray-700 font-medium"
                }`}
              >
                <span>{tab.label}</span>
                <span className="ml-1.5 text-xs tabular-nums text-gray-500">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        </div>
        )}
      </div>

      {/* メイン単語の一覧。1語を1枚のカードにすると1語あたり約115pxあり、スマホの1画面に
          5語ほどしか入らなかった。1枚の表を細い線で区切り、1行を約60pxにする */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* 検索・絞り込みの結果。カードの中に置く（背景の飾りの上に小さな文字を出さない） */}
      <div className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-500 tabular-nums border-b border-gray-200 bg-slate-50">
        <div>
          該当 <span className="text-gray-900 font-bold">{totalItems.toLocaleString()}語</span>
          {searchQuery && `（「${searchQuery}」）`}
        </div>
        <div>
          ページ：{currentPage} / {totalPages}
        </div>
      </div>

      <div className="divide-y divide-gray-200" id="dictionary_words_container">
        {paginatedVocabulary.length > 0 ? (
          paginatedVocabulary.map((word) => {
            const isExpanded = expandedWordId === word.id;
            const isCustom = isCustomWordId(word.id);
            const badge = getLevelBadgeProps(word.level, isCustom);
            
            // クイズ習熟度状況判定
            const history = solvedHistory[word.id];
            const isWrong = wrongWordSet.has(word.id);
            const isCompleted = isMastered(word.id, solvedHistory, srsData);
            const attemptCount = history ? history.attemptCount : 0;

            // 状態は色の箱ではなく、短い文字で示す（行が詰まっているので、箱を並べると読みにくい）
            let statusBadge = null;
            if (isWrong) {
              statusBadge = <span className="text-xs font-bold text-rose-800 shrink-0">苦手</span>;
            } else if (isCompleted) {
              statusBadge = (
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-0.5 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  習得済
                </span>
              );
            } else if (attemptCount > 0) {
              statusBadge = (
                <span className="text-xs text-gray-500 shrink-0">
                  未定着（{attemptCount}回挑戦）
                </span>
              );
            }

            return (
              <div 
                key={word.id} 
                onClick={() => setExpandedWordId(isExpanded ? null : word.id)}
                // div のままではキーボードで辿り着けず、詳細を開けない
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  setExpandedWordId(isExpanded ? null : word.id);
                }}
                className={`px-4 py-2 cursor-pointer transition ${
                  isExpanded ? "bg-indigo-50/40" : "hover:bg-gray-50"
                }`}
                id={`dictionary_word_item_${word.id}`}
              >
                <div className="flex items-center gap-3 min-h-12">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="font-headword text-lg text-gray-900 select-all truncate">
                        {word.word}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0">{getWordPosLabel(word)}</span>
                      {statusBadge}
                    </div>
                    <p className={`text-sm text-gray-700 ${isExpanded ? "" : "truncate"}`}>
                      {word.translation}
                    </p>
                  </div>

                  {/* レベルは短い呼び方（初級・中級1…）で、レベルの色の文字にする */}
                  <span
                    className={`text-xs font-bold shrink-0 ${isCustom ? CUSTOM_TONE : LEVEL_TONE[word.level]} ${TONE_STYLE.text}`}
                    title={badge.text}
                  >
                    {isCustom ? "追加" : LEVEL_STAGES[word.level]}
                  </span>

                  {/* 苦手リストの出し入れ。行を開く操作と混ざらないよう伝播を止める */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setWrongWords(prev =>
                        prev.includes(word.id)
                          ? prev.filter(id => id !== word.id)
                          : [...prev, word.id]
                      );
                    }}
                    title={isWrong ? "苦手リストから外す" : "苦手リストに入れて復習に回す"}
                    aria-label={`${word.word} を苦手リストに${isWrong ? "入れている（外す）" : "入れる"}`}
                    aria-pressed={isWrong}
                    id={`btn_toggle_weak_${word.id}`}
                    className={`shrink-0 w-11 h-11 -mr-1 rounded-xl flex items-center justify-center transition cursor-pointer ${
                      isWrong
                        ? "text-rose-700 hover:bg-rose-50"
                        : "text-gray-400 hover:text-rose-700 hover:bg-gray-100"
                    }`}
                  >
                    <Flame className={`w-5 h-5 ${isWrong ? "fill-rose-300" : ""}`} aria-hidden="true" />
                  </button>
                  <ChevronRight className={`w-4 h-4 text-gray-500 shrink-0 -ml-1 transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`} aria-hidden="true" />
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
                      <div className="mt-2 pb-2 space-y-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        {/* 発音。一覧の行には置かない（1ページ50語ぶんの発音記号を一度に取りに行かないためにも） */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={(e) => handleSpeakWord(word.word, e)}
                            className="w-11 h-11 flex items-center justify-center bg-white hover:bg-gray-50 border border-gray-200 rounded-full text-gray-700 transition shrink-0 cursor-pointer"
                            title="発音を再生"
                            aria-label={`${word.word} の発音を聴く`}
                          >
                            <Volume2 className="w-5 h-5" aria-hidden="true" />
                          </button>
                          <Phonetic word={word.word} className="text-sm" />
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge.className}`}>
                            {badge.text}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* 左側: 和訳詳細と例文 */}
                          <div className="md:col-span-8 space-y-4">
                            {/* 和訳詳細 */}
                            <div className="grid grid-cols-12 bg-indigo-50/30 border border-indigo-100 p-3.5 rounded-xl gap-2 items-center">
                              <div className="col-span-3 font-bold text-indigo-700/80 flex items-center gap-1">
                                <GraduationCap className="w-4 h-4" />
                                <span>正しい日本語訳:</span>
                              </div>
                              <div className="col-span-9 font-bold text-indigo-900 text-sm md:text-base">
                                {word.translation}
                              </div>
                            </div>

                            {/* 複数の意味を持つ語では、他の意味と品詞ごとの使用割合も見せる */}
                            <WordSenses wordId={word.id} ownTranslation={word.translation} ownPos={word.pos} />

                            {/* 訳語だけでは英文が組み立てられないので、文型・組んで使う語・語族を補う */}
                            <WordUsageInfo wordId={word.id} onOpenGrammar={onOpenGrammar} />

                            {/* 例文セクション */}
                            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-2">
                              <p className="font-bold text-gray-400 text-xs">例文 (穴埋めテスト用文脈):</p>
                              
                              {/* 例文を表示。穴埋めの場所もわかりやすく。 */}
                              <div className="pl-1 space-y-2">
                                <p className="font-sans font-bold text-gray-800 italic text-sm md:text-base leading-relaxed tracking-wide">
                                  {/* [_____] を 補完済みの英単語に置換して太字＆アンダーライン表示 */}
                                  {word.sentence.includes("[_____]") ? (
                                    <>
                                      {word.sentence.split("[_____]")[0]}
                                      <span className="bg-indigo-100 border-b-2 border-indigo-600 px-1 tabular-nums text-indigo-800 rounded mx-0.5 italic not-italic font-bold">
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

                        </div>

                        {/* —————————— AI単語使用頻度分析セクション —————————— */}
                        <div className="border border-indigo-100 rounded-2xl overflow-hidden bg-white shadow-3xs">
                          {/* セクションヘッダー */}
                          <div className="bg-gradient-to-r from-indigo-50 to-indigo-50/30 p-3.5 px-4 border-b border-indigo-100 flex items-center justify-between">
                            <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600 fill-indigo-200" />
                              <span>AI 頻度・シチュエーション別使われ方分析</span>
                            </h4>
                            <span className="text-xs bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-lg shrink-0">
                              AI
                            </span>
                          </div>

                          {/* コンテンツエリア */}
                          <div className="p-4 space-y-4">
                            {frequencyLoading[cacheKey(word.word)] ? (
                              <div className="flex flex-col items-center justify-center py-6 space-y-2">
                                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                                <p className="text-xs font-bold text-indigo-600">AIが使われ方の統計情報を展開中...</p>
                              </div>
                            ) : frequencyError[cacheKey(word.word)] ? (
                              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5">
                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <p className="text-xs font-bold text-rose-800">
                                    頻度データの取得に失敗しました。
                                  </p>
                                  <p className="text-xs text-rose-600 font-medium">{frequencyError[cacheKey(word.word)]}</p>
                                  <button
                                    onClick={() => handleFetchWordFrequency(word.word)}
                                    className="px-2.5 py-1 bg-white hover:bg-rose-100 border border-rose-250 text-rose-700 text-xs font-bold rounded-lg transition"
                                  >
                                    再接続・再試行
                                  </button>
                                </div>
                              </div>
                            ) : wordFrequencies[cacheKey(word.word)] ? (
                              (() => {
                                const freqData = wordFrequencies[cacheKey(word.word)];
                                const { frequencies, overallComment, usageExamples } = freqData;

                                return (
                                  <div className="space-y-4">
                                    {/* 3つのドメインの頻度比較メーター */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                      
                                      {/* 日常会話 (everyday) */}
                                      <div className="bg-blue-50/20 border border-blue-100 rounded-xl p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-blue-800 font-bold text-xs">
                                            <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                                            <span>日常会話での頻度</span>
                                          </div>
                                          <span className="text-xs font-bold text-blue-700 tabular-nums">
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
                                        <p className="text-xs text-gray-500 leading-relaxed font-medium pl-0.5">
                                          {frequencies?.everyday?.description}
                                        </p>
                                        
                                        {/* 日常の例文 */}
                                        {usageExamples?.everyday && (
                                          <div className="border-t border-blue-50 pt-2 mt-2 space-y-1">
                                            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">日常例文</span>
                                            <p className="text-xs font-bold text-gray-800 font-sans italic">
                                              "{usageExamples.everyday.sentence}"
                                            </p>
                                            <p className="text-xs text-gray-500 font-medium font-sans">
                                              訳: {usageExamples.everyday.translation}
                                            </p>
                                          </div>
                                        )}
                                      </div>

                                      {/* ビジネス (business) */}
                                      <div className="bg-amber-50/20 border border-amber-100 rounded-xl p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                                            <Briefcase className="w-3.5 h-3.5 text-amber-500" />
                                            <span>ビジネスでの頻度</span>
                                          </div>
                                          <span className="text-xs font-bold text-amber-700 tabular-nums">
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
                                        <p className="text-xs text-gray-500 leading-relaxed font-medium pl-0.5">
                                          {frequencies?.business?.description}
                                        </p>

                                        {/* ビジネスの例文 */}
                                        {usageExamples?.business && (
                                          <div className="border-t border-amber-50 pt-2 mt-2 space-y-1">
                                            <span className="text-xs font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">ビジネス例文</span>
                                            <p className="text-xs font-bold text-gray-800 font-sans italic">
                                              "{usageExamples.business.sentence}"
                                            </p>
                                            <p className="text-xs text-gray-500 font-medium font-sans">
                                              訳: {usageExamples.business.translation}
                                            </p>
                                          </div>
                                        )}
                                      </div>

                                      {/* 学術・講義 (academic) */}
                                      <div className="bg-purple-50/20 border border-purple-100 rounded-xl p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-purple-800 font-bold text-xs">
                                            <GraduationCap className="w-3.5 h-3.5 text-purple-500" />
                                            <span>学術（論文など）での頻度</span>
                                          </div>
                                          <span className="text-xs font-bold text-purple-700 tabular-nums">
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
                                        <p className="text-xs text-gray-500 leading-relaxed font-medium pl-0.5">
                                          {frequencies?.academic?.description}
                                        </p>

                                        {/* アカデミックの例文 */}
                                        {usageExamples?.academic && (
                                          <div className="border-t border-purple-50 pt-2 mt-2 space-y-1">
                                            <span className="text-xs font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">学術例文</span>
                                            <p className="text-xs font-bold text-gray-800 font-sans italic">
                                              "{usageExamples.academic.sentence}"
                                            </p>
                                            <p className="text-xs text-gray-500 font-medium font-sans">
                                              訳: {usageExamples.academic.translation}
                                            </p>
                                          </div>
                                        )}
                                      </div>

                                    </div>

                                    {/* AI総合ニュアンスコメント */}
                                    {overallComment && (
                                      <div className="bg-indigo-50/30 border border-indigo-100/70 rounded-xl p-3 px-3.5 text-xs md:text-xs">
                                        <div className="font-bold text-indigo-950 mb-1 flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                          <span>AIによる総合ニュアンス・アドバイス:</span>
                                        </div>
                                        <p className="text-gray-600 dark:text-slate-350 leading-relaxed font-medium pr-4">
                                          {overallComment}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="flex flex-col items-center justify-center py-4 space-y-2">
                                <p className="text-xs text-gray-400 font-medium">使用頻度のデータが待機中です。</p>
                                <button
                                  onClick={() => handleFetchWordFrequency(word.word)}
                                  className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold rounded-lg hover:bg-indigo-100 transition"
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
                            <div className="flex items-center gap-1.5 text-teal-800 font-bold text-xs">
                              <Layers className="w-3.5 h-3.5 text-teal-600" />
                              <span>AI 類義語・反意語・コロケーション</span>
                            </div>
                          </div>
                          <div className="p-4">
                            {(() => {
                              const relKey = cacheKey(word.word);
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
                                    <p className="text-xs text-rose-600 font-medium">{relationsError[relKey]}</p>
                                    <button
                                      onClick={() => {
                                        setRelationsError(prev => ({ ...prev, [relKey]: "" }));
                                        handleFetchWordRelations(word.word, word.translation);
                                      }}
                                      className="px-3 py-1 bg-teal-50 text-teal-700 border border-teal-100 text-xs font-bold rounded-lg hover:bg-teal-100 transition cursor-pointer"
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
                                        <span className="text-xs font-bold text-teal-700 uppercase tracking-wide block mb-2">類義語 (Synonyms)</span>
                                        <div className="space-y-2">
                                          {relData.synonyms.map((s: any, i: number) => (
                                            <div key={i} className="bg-teal-50/40 border border-teal-100/60 rounded-xl p-2.5">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="tabular-nums font-bold text-sm text-gray-900">{s.word}</span>
                                                <span className="text-gray-500 font-medium">{s.translation}</span>
                                              </div>
                                              {s.nuance && (
                                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{s.nuance}</p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* 反意語 */}
                                    {relData.antonyms && relData.antonyms.length > 0 && (
                                      <div>
                                        <span className="text-xs font-bold text-rose-700 uppercase tracking-wide block mb-2">反意語 (Antonyms)</span>
                                        <div className="flex flex-wrap gap-2">
                                          {relData.antonyms.map((a: any, i: number) => (
                                            <span key={i} className="bg-rose-50/60 border border-rose-100 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                                              <span className="tabular-nums font-bold text-gray-900">{a.word}</span>
                                              <span className="text-gray-500 font-medium text-xs">{a.translation}</span>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* コロケーション */}
                                    {relData.collocations && relData.collocations.length > 0 && (
                                      <div>
                                        <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide block mb-2">コロケーション (よく使われる組み合わせ)</span>
                                        <div className="space-y-1.5">
                                          {relData.collocations.map((c: any, i: number) => (
                                            <div key={i} className="flex items-baseline justify-between gap-3 bg-indigo-50/40 border border-indigo-100/60 rounded-lg px-3 py-2">
                                              <span className="tabular-nums font-bold text-gray-900">{c.phrase}</span>
                                              <span className="text-gray-500 font-medium text-xs text-right shrink-0">{c.translation}</span>
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
                                  <p className="text-xs text-gray-400 font-medium">
                                    類義語・反意語・よく使われる組み合わせをAIが解説します。
                                  </p>
                                  <button
                                    onClick={() => handleFetchWordRelations(word.word, word.translation)}
                                    className="px-3 py-1 bg-teal-50 text-teal-700 border border-teal-100 text-xs font-bold rounded-lg hover:bg-teal-100 transition cursor-pointer"
                                  >
                                    語彙のつながりを分析する
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* 四択の選択肢はここには出さない。
                            誤答は出題のための材料であって単語の情報ではないうえ、
                            辞書で先に見てしまうと出題時の手がかりになる */}

                        {/* 学習履歴詳細 */}
                        {attemptCount > 0 && (
                          <p className="text-xs text-gray-400 text-right italic">
                            これまでにこの単語を合計 <span className="font-bold tabular-nums text-gray-600">{attemptCount} 回</span> 回答し、
                            そのうち正答数は <span className="font-bold tabular-nums text-emerald-600">{history ? history.correctCount : 0} 回</span> です。
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
          <div className="text-center py-14 px-4" id="dictionary_empty_state">
            <BookOpen className="w-10 h-10 text-gray-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-900 font-bold text-base">該当する単語は見つかりませんでした</p>
            <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto leading-relaxed">
              キーワードを変更するか、絞り込みフィルターを切り替えてみてください。自分で追加した単語を検索するのもおすすめです。
            </p>
          </div>
        )}
      </div>
      </div>

      {/* ページネーションコントロール */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-gray-200 rounded-2xl p-4 tabular-nums text-sm text-gray-600">
          <div>
            表示中：<span className="font-bold text-gray-800">{(currentPage - 1) * pageSize + 1}</span> - <span className="font-bold text-gray-800">{Math.min(currentPage * pageSize, totalItems)}</span> 件目 / 全 <span className="font-bold text-indigo-600">{totalItems}</span> 件
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="min-w-11 min-h-11 px-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl disabled:opacity-40 font-medium cursor-pointer transition"
            >
              &lt;&lt;
            </button>
            <button
              onClick={() => goToPage(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="min-h-11 px-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl disabled:opacity-40 font-medium cursor-pointer transition"
            >
              前へ
            </button>

            {/* 周辺ページ番号を表示（いまのページを中心に最大5ページ。src/pagination.ts） */}
            {pageWindow(currentPage, totalPages).map(pageNum => {
              return (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  aria-current={currentPage === pageNum ? "page" : undefined}
                  className={`min-w-11 min-h-11 rounded-xl border transition cursor-pointer ${
                    currentPage === pageNum
                      ? "bg-indigo-50 border-indigo-600 text-indigo-800 font-bold"
                      : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700 font-medium"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => goToPage(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="min-h-11 px-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl disabled:opacity-40 font-medium cursor-pointer transition"
            >
              次へ
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="min-w-11 min-h-11 px-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl disabled:opacity-40 font-medium cursor-pointer transition"
            >
              &gt;&gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
