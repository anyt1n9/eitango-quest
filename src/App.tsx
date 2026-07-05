/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { Level, Word, UserStats, RankingUser } from "./types";
import { initialVocabulary } from "./data/vocabulary";
import Dashboard from "./components/Dashboard";
import Quiz from "./components/Quiz";
import SentenceQuiz from "./components/SentenceQuiz";
import ReviewList from "./components/ReviewList";
import Dictionary from "./components/Dictionary";
import Reading from "./components/Reading";
import MapAndPuzzle from "./components/MapAndPuzzle";
import AIDiary from "./components/AIDiary";
import DataBackup from "./components/DataBackup";
import { SrsState, nextSrsState, getDueWordIds, todayStr } from "./srs";
import { BrainCircuit, Compass, Award, ExternalLink, BookOpen, FileText, Network, Sun, Moon, Sparkles, RotateCcw, Database, Target, CheckCircle2 } from "lucide-react";

// デフォルトのランキング架空ユーザー
const DEFAULT_RANKING: RankingUser[] = [
  { id: "r1", name: "Takashi", score: 2800, avatar: "🧑‍💻" },
  { id: "r2", name: "Emily", score: 2150, avatar: "👩‍🎨" },
  { id: "r3", name: "Alex", score: 1800, avatar: "👨‍🚀" },
  { id: "r4", name: "Kenji", score: 1450, avatar: "🙋‍♂️" },
  { id: "r5", name: "Yuki", score: 1100, avatar: "👩‍⚕️" },
  { id: "me_id", name: "You (ログインプレイヤー)", score: 0, avatar: "🏆", isMe: true },
  { id: "r6", name: "Rui", score: 800, avatar: "🧑‍🎤" },
  { id: "r7", name: "Sara", score: 500, avatar: "👩‍🎓" },
  { id: "r8", name: "Takuya", score: 300, avatar: "🧑‍🍳" },
];

export default function App() {
  // 1. 各種永続化ステート
  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem("quest_stats");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      score: 0,
      currentStreak: 0,
      lastLoginDate: null,
      completedQuestions: 0,
      correctAnswers: 0,
      unlockedLevels: ["junior"]
    };
  });

  const [vocabulary, setVocabulary] = useState<Word[]>(() => {
    const saved = localStorage.getItem("quest_vocab_custom");
    let customList: Word[] = [];
    if (saved) {
      try {
        customList = JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [...initialVocabulary, ...customList];
  });

  const [wrongWords, setWrongWords] = useState<string[]>(() => {
    const saved = localStorage.getItem("quest_wrong_words");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  const [solvedHistory, setSolvedHistory] = useState<Record<string, { correctCount: number; attemptCount: number }>>(() => {
    const saved = localStorage.getItem("quest_solved_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {};
  });

  const [ranking, setRanking] = useState<RankingUser[]>(() => {
    const saved = localStorage.getItem("quest_ranking_score");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // localStorageに残されたデータがMeを含まない or 古い場合はマージ
        if (parsed.some((u: any) => u.isMe)) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    // 初期値に自分のスコアをマッピング
    const statsScore = (() => {
      const savedStatsStr = localStorage.getItem("quest_stats");
      if (savedStatsStr) {
        try {
          return JSON.parse(savedStatsStr).score || 0;
        } catch (e) {
          // ignore
        }
      }
      return 0;
    })();

    const withMe = DEFAULT_RANKING.map(u => u.isMe ? { ...u, score: statsScore } : u);
    return withMe.sort((a, b) => b.score - a.score);
  });

  // テーマ切り替え (ダークモード用)
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem("quest_theme") === "dark";
  });

  // 間隔反復(SRS)の単語ごとのスケジュール状態
  const [srsData, setSrsData] = useState<Record<string, SrsState>>(() => {
    const saved = localStorage.getItem("quest_srs");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {};
  });

  // デイリー学習目標の進捗（今日の解答数）
  const [dailyProgress, setDailyProgress] = useState<{ date: string; count: number }>(() => {
    const saved = localStorage.getItem("quest_daily_progress");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return { date: todayStr(), count: 0 };
  });

  // 1日の学習目標（問題数）
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    const v = Number(localStorage.getItem("quest_daily_goal"));
    return v > 0 ? v : 20;
  });

  // 学習カレンダー用の日別解答ログ（日付 -> 解答数・正解数）
  const [dailyLog, setDailyLog] = useState<Record<string, { count: number; correct: number }>>(() => {
    const saved = localStorage.getItem("quest_daily_log");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {};
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("quest_theme", isDark ? "dark" : "light");
  }, [isDark]);

  // ログインスタンプ起動時処理（1日のログイン連続日数の自動更新など）
  useEffect(() => {
    const todayS = todayStr();
    const yesterdayStr = getYesterdayString();

    if (stats.lastLoginDate !== todayS) {
      if (stats.lastLoginDate === yesterdayStr) {
        // 連続ログイン維持
        // スタンプラリー用：翌日になったら連続日数を繰り上げ（ただし、Dashboardのボタンを実際に踏んで報酬を受け取るまでスコアは上がらない仕組み）
        console.log("Welcome back today! Keep your streak:", stats.currentStreak);
      } else if (stats.lastLoginDate !== null) {
        // 1日空いてしまった場合はリセット
        console.log("Streak broken. Resetting to 0 day.");
        setStats(prev => ({
          ...prev,
          currentStreak: 0
        }));
      }
    }
  }, []);

  const getYesterdayString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return todayStr(d);
  };

  // 2. 変更時の各LocalStorageへ同期保存
  useEffect(() => {
    localStorage.setItem("quest_stats", JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem("quest_wrong_words", JSON.stringify(wrongWords));
  }, [wrongWords]);

  useEffect(() => {
    localStorage.setItem("quest_solved_history", JSON.stringify(solvedHistory));
  }, [solvedHistory]);

  useEffect(() => {
    localStorage.setItem("quest_ranking_score", JSON.stringify(ranking));
  }, [ranking]);

  useEffect(() => {
    // カスタムでAI追加した単語のみを抽出して保存
    const customOnly = vocabulary.filter(w => w.id.startsWith("ai_"));
    localStorage.setItem("quest_vocab_custom", JSON.stringify(customOnly));
  }, [vocabulary]);

  useEffect(() => {
    localStorage.setItem("quest_srs", JSON.stringify(srsData));
  }, [srsData]);

  useEffect(() => {
    localStorage.setItem("quest_daily_progress", JSON.stringify(dailyProgress));
  }, [dailyProgress]);

  useEffect(() => {
    localStorage.setItem("quest_daily_goal", String(dailyGoal));
  }, [dailyGoal]);

  useEffect(() => {
    localStorage.setItem("quest_daily_log", JSON.stringify(dailyLog));
  }, [dailyLog]);


  // 3. ルーティング
  const [currentScreen, setCurrentScreen] = useState<"dashboard" | "quiz" | "sentence_quiz" | "listening_quiz" | "review" | "dictionary" | "reading" | "map_puzzle" | "diary" | "srs_review" | "settings">("dashboard");
  const [selectedLevel, setSelectedLevel] = useState<Level>("junior");
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(10);

  const handleStartQuiz = (level: Level, type: "word" | "sentence" | "listening", count: number = 10) => {
    setSelectedLevel(level);
    setQuizQuestionCount(count);
    setCurrentScreen(type === "word" ? "quiz" : type === "listening" ? "listening_quiz" : "sentence_quiz");
  };

  const handleBackToDashboard = () => {
    setCurrentScreen("dashboard");
  };

  // 自分のランキングスコアのバーストアップデート
  const updateRankingScore = (points: number) => {
    setRanking(prev => {
      const updated = prev.map(u => {
        if (u.isMe) {
          return {
            ...u,
            score: u.score + points
          };
        }
        return u;
      });
      // 降順ソート
      return updated.sort((a, b) => b.score - a.score);
    });
  };

  // 解答1件ごとの中央処理: 間隔反復(SRS)スケジュール、今日の学習目標、学習カレンダーを更新する
  const recordAnswer = useCallback((wordId: string, isCorrect: boolean) => {
    const today = todayStr();
    setSrsData(prev => ({
      ...prev,
      [wordId]: nextSrsState(prev[wordId], isCorrect, today)
    }));
    setDailyProgress(prev => {
      const base = prev.date === today ? prev.count : 0;
      return { date: today, count: base + 1 };
    });
    setDailyLog(prev => {
      const entry = prev[today] || { count: 0, correct: 0 };
      return {
        ...prev,
        [today]: { count: entry.count + 1, correct: entry.correct + (isCorrect ? 1 : 0) }
      };
    });
  }, []);

  // 今日復習すべき単語（SRSの期日が今日以前のもの）
  const today = todayStr();
  const dueWordIds = getDueWordIds(srsData, today);
  const dueWords = vocabulary.filter(w => dueWordIds.includes(w.id));
  // 今日解いた問題数（日付が変わっていたら0）
  const todayCount = dailyProgress.date === today ? dailyProgress.count : 0;
  const goalReached = todayCount >= dailyGoal;
  // クイズなど集中して取り組む画面では、ヘッダーの機能ボタン群を隠して画面を広く使う
  const isFocusScreen =
    currentScreen === "quiz" ||
    currentScreen === "sentence_quiz" ||
    currentScreen === "listening_quiz" ||
    currentScreen === "review" ||
    currentScreen === "srs_review";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-300" id="app_root_container">
      {/* ナビゲーションヘッダー */}
      <nav className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 py-4 px-6 sticky top-0 z-40 shadow-xs transition-colors duration-300" id="navigation_bar">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div 
            onClick={handleBackToDashboard}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 select-none"
          >
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-150-10">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-lg tracking-tight bg-gradient-to-r from-gray-900 via-indigo-950 to-indigo-700 dark:from-slate-100 dark:via-indigo-200 dark:to-indigo-400 bg-clip-text text-transparent font-sans">
                英単語 Quest
              </span>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black font-mono tracking-widest uppercase mt-[-1px]">
                vocabulary quest app
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* クイズなど集中画面では機能ボタン群を隠す */}
            {!isFocusScreen && (
            <>
            {/* 長文読破 Quest ボタン */}
            <button
              onClick={() => setCurrentScreen(currentScreen === "reading" ? "dashboard" : "reading")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs select-none border cursor-pointer ${
                currentScreen === "reading"
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 shadow-indigo-100 dark:shadow-none"
                  : "bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-705"
              }`}
              id="nav_reading_toggle_btn"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>長文読破 Quest</span>
            </button>

            {/* 単語一覧辞書ボタン */}
            <button
              onClick={() => setCurrentScreen(currentScreen === "dictionary" ? "dashboard" : "dictionary")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs select-none border cursor-pointer ${
                currentScreen === "dictionary"
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 shadow-indigo-100 dark:shadow-none"
                  : "bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-705"
              }`}
              id="nav_dictionary_toggle_btn"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>単語一覧辞書</span>
            </button>

            {/* AIつながりマップ・パズルボタン */}
            <button
              onClick={() => setCurrentScreen(currentScreen === "map_puzzle" ? "dashboard" : "map_puzzle")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs select-none border cursor-pointer ${
                currentScreen === "map_puzzle"
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 shadow-indigo-100 dark:shadow-none"
                  : "bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-705"
              }`}
              id="nav_map_puzzle_toggle_btn"
            >
              <Network className="w-3.5 h-3.5" />
              <span>AIつながりマップ・パズル</span>
            </button>

            {/* AI英語日記ボタン */}
            <button
              onClick={() => setCurrentScreen(currentScreen === "diary" ? "dashboard" : "diary")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs select-none border cursor-pointer ${
                currentScreen === "diary"
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 shadow-indigo-100"
                  : "bg-gradient-to-r from-amber-50 to-amber-100 dark:from-slate-800 dark:to-slate-850 text-amber-950 dark:text-amber-300 hover:opacity-90 border-amber-200/55 dark:border-slate-700"
              }`}
              id="nav_diary_toggle_btn"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-300/30 animate-pulse" />
              <span className="flex items-center gap-1">
                <span>AI英語日記</span>
                <span className="bg-amber-500 text-slate-900 text-[8px] px-1 rounded font-black tracking-tight scale-90">VIP</span>
              </span>
            </button>

            {/* 今日の復習(SRS)ボタン */}
            <button
              onClick={() => setCurrentScreen(currentScreen === "srs_review" ? "dashboard" : "srs_review")}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs select-none border cursor-pointer ${
                currentScreen === "srs_review"
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500"
                  : "bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700"
              }`}
              id="nav_srs_review_btn"
              title="忘却曲線に沿って、今日復習すべき単語を出題します"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>今日の復習</span>
              {dueWords.length > 0 && (
                <span className="ml-0.5 bg-rose-500 text-white text-[9px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center font-black">
                  {dueWords.length}
                </span>
              )}
            </button>

            {/* データ設定・バックアップボタン */}
            <button
              onClick={() => setCurrentScreen(currentScreen === "settings" ? "dashboard" : "settings")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs select-none border cursor-pointer ${
                currentScreen === "settings"
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500"
                  : "bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700"
              }`}
              id="nav_settings_btn"
              title="学習データのバックアップとデイリー目標の設定"
            >
              <Database className="w-3.5 h-3.5" />
              <span>データ</span>
            </button>
            </>
            )}

            {/* 今日の学習目標チップ */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold font-mono shadow-inner ${
                goalReached
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300"
                  : "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400"
              }`}
              title="今日の学習目標の進捗"
            >
              {goalReached ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
              <span>{todayCount}/{dailyGoal}</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-400 font-mono shadow-inner border-gray-200 dark:border-slate-700">
              <Compass className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
              <span>Ver 1.6.0</span>
            </div>

            {/* テーマ切り替えボタン (Sun/Moon Toggle) */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-1.5 rounded-xl border border-gray-200 dark:border-slate-750 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-750 dark:text-slate-200 transition cursor-pointer select-none"
              title={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
              id="theme_toggle_btn"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 fill-amber-350" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-700 fill-indigo-100" />
              )}
            </button>
            
            <div className="px-3 py-1.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 font-mono">{stats.score} <span className="text-[10px] text-indigo-400 dark:text-indigo-500">P</span></span>
            </div>
          </div>
        </div>
      </nav>

      {/* メインステージ */}
      <main className="flex-1 py-8 px-4 max-w-4xl w-full mx-auto" id="main_payload">
        {currentScreen === "dashboard" && (
          <Dashboard
            stats={stats}
            setStats={setStats}
            vocabulary={vocabulary}
            setVocabulary={setVocabulary}
            solvedHistory={solvedHistory}
            wrongWords={wrongWords}
            onStartQuiz={handleStartQuiz}
            onStartReview={() => setCurrentScreen("review")}
            onOpenDictionary={() => setCurrentScreen("dictionary")}
            onStartReading={() => setCurrentScreen("reading")}
            ranking={ranking}
            setRanking={setRanking}
            dailyLog={dailyLog}
            dailyGoal={dailyGoal}
          />
        )}

        {currentScreen === "quiz" && (
          <Quiz
            level={selectedLevel}
            vocabulary={vocabulary}
            wrongWords={wrongWords}
            setWrongWords={setWrongWords}
            solvedHistory={solvedHistory}
            setSolvedHistory={setSolvedHistory}
            setStats={setStats}
            onBackToDashboard={handleBackToDashboard}
            updateRankingScore={updateRankingScore}
            questionCount={quizQuestionCount}
            recordAnswer={recordAnswer}
          />
        )}

        {currentScreen === "listening_quiz" && (
          <Quiz
            level={selectedLevel}
            vocabulary={vocabulary}
            wrongWords={wrongWords}
            setWrongWords={setWrongWords}
            solvedHistory={solvedHistory}
            setSolvedHistory={setSolvedHistory}
            setStats={setStats}
            onBackToDashboard={handleBackToDashboard}
            updateRankingScore={updateRankingScore}
            questionCount={quizQuestionCount}
            listeningMode={true}
            recordAnswer={recordAnswer}
          />
        )}

        {currentScreen === "sentence_quiz" && (
          <SentenceQuiz
            level={selectedLevel}
            vocabulary={vocabulary}
            wrongWords={wrongWords}
            setWrongWords={setWrongWords}
            solvedHistory={solvedHistory}
            setSolvedHistory={setSolvedHistory}
            setStats={setStats}
            onBackToDashboard={handleBackToDashboard}
            updateRankingScore={updateRankingScore}
            recordAnswer={recordAnswer}
          />
        )}

        {currentScreen === "review" && (
          <ReviewList
            vocabulary={vocabulary}
            wrongWords={wrongWords}
            setWrongWords={setWrongWords}
            solvedHistory={solvedHistory}
            setSolvedHistory={setSolvedHistory}
            setStats={setStats}
            onBackToDashboard={handleBackToDashboard}
            updateRankingScore={updateRankingScore}
            recordAnswer={recordAnswer}
          />
        )}

        {currentScreen === "dictionary" && (
          <Dictionary
            vocabulary={vocabulary}
            wrongWords={wrongWords}
            solvedHistory={solvedHistory}
            onBackToDashboard={handleBackToDashboard}
          />
        )}

        {currentScreen === "reading" && (
          <Reading
            stats={stats}
            setStats={setStats}
            onBackToDashboard={handleBackToDashboard}
            updateRankingScore={updateRankingScore}
          />
        )}

        {currentScreen === "map_puzzle" && (
          <MapAndPuzzle
            stats={stats}
            setStats={setStats}
            onBackToDashboard={handleBackToDashboard}
            updateRankingScore={updateRankingScore}
          />
        )}

        {currentScreen === "diary" && (
          <AIDiary
            vocabulary={vocabulary}
            solvedHistory={solvedHistory}
            setSolvedHistory={setSolvedHistory}
            onBackToDashboard={handleBackToDashboard}
          />
        )}

        {currentScreen === "srs_review" && (
          dueWords.length > 0 ? (
            <Quiz
              level={selectedLevel}
              vocabulary={vocabulary}
              wrongWords={wrongWords}
              setWrongWords={setWrongWords}
              solvedHistory={solvedHistory}
              setSolvedHistory={setSolvedHistory}
              setStats={setStats}
              onBackToDashboard={handleBackToDashboard}
              updateRankingScore={updateRankingScore}
              questionCount={Math.min(dueWords.length, 30)}
              customWords={dueWords}
              reviewMode={true}
              recordAnswer={recordAnswer}
            />
          ) : (
            <div className="max-w-xl mx-auto">
              <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl p-8 shadow-sm text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-gray-900 dark:text-slate-100">今日の復習は完了です！</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                  忘却曲線にもとづく今日の復習対象はありません。クイズで新しい単語に挑戦すると、最適なタイミングでここに復習が出題されます。
                </p>
                <button
                  onClick={handleBackToDashboard}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-8 py-3 rounded-2xl shadow transition cursor-pointer text-sm"
                >
                  ダッシュボードに戻る
                </button>
              </div>
            </div>
          )
        )}

        {currentScreen === "settings" && (
          <DataBackup
            dailyGoal={dailyGoal}
            setDailyGoal={setDailyGoal}
            onBackToDashboard={handleBackToDashboard}
          />
        )}
      </main>

      {/* 謙虚でスタイリッシュなフッター */}
      <footer className="bg-white dark:bg-slate-900 border-t border-gray-150 dark:border-slate-800 py-6 px-4 transition-colors duration-300" id="global_footer">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-gray-400 dark:text-slate-500 gap-4 font-semibold font-sans">
          <p>© 2026 英単語 Quest. Built on Google AI Studio.</p>
          <div className="flex items-center gap-4">
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); alert("英単語 Quest (English Vocabulary Studio)\n\n中学生〜社会人までのレベルに最適化された英単語学習スタジオ。Gemini AIを搭載し、あなたが入力した新しい単語を完全に分析してクイズとして出題。楽しい仮想ランキング機能、デイリーログインボーナスなどのモチベーション維持機能、苦手単語の自動バックアップ・復習テスト機能を完備した全包囲型の学習プラットフォームです。"); }}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            >
              アプリケーション説明
            </a>
            <span className="text-gray-200 dark:text-slate-800">|</span>
            <div className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              <span>Powered by Gemini 3.5 Flash</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
