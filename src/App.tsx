/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { Level, Word, UserStats, RankingUser } from "./types";
import { loadVocabulary } from "./vocabulary";
import Dashboard from "./components/Dashboard";
import Quiz from "./components/Quiz";
import QuizFormatPicker from "./components/QuizFormatPicker";
import { QuizFormat, QUIZ_FORMAT_LABELS, wordsForFormat } from "./quizFormats";
import { Screen, Route, pathToRoute, routeToPath, resolveOnEntry } from "./routes";
import AdBanner from "./components/AdBanner";

/*
 * 起動時に要らない画面は、開いたときに読み込む。
 *
 * 以前はすべての画面を静的に import していたため、
 * 最初の JS が 862KB（gzip 258KB）あった。
 * 起動して最初に見えるのはダッシュボードだけなので、
 * 辞書・長文・文法・日記といった大きな画面はそのぶん後回しにできる。
 *
 * ダッシュボードと四択クイズ（一問一答・リスニング・日→英が共有する）は
 * 最初の操作でそのまま使うので、待ち時間を挟まないよう静的に持つ。
 */
const SentenceQuiz = lazy(() => import("./components/SentenceQuiz"));
const SpellingQuiz = lazy(() => import("./components/SpellingQuiz"));
const ReviewList = lazy(() => import("./components/ReviewList"));
const Dictionary = lazy(() => import("./components/Dictionary"));
const Reading = lazy(() => import("./components/Reading"));
const MapAndPuzzle = lazy(() => import("./components/MapAndPuzzle"));
const AIDiary = lazy(() => import("./components/AIDiary"));
const VerbFormsScreen = lazy(() => import("./components/VerbForms"));
const Grammar = lazy(() => import("./components/Grammar"));
const DataBackup = lazy(() => import("./components/DataBackup"));
const GachaShop = lazy(() => import("./components/GachaShop"));
const PrivacyPolicy = lazy(() =>
  import("./components/LegalPages").then(m => ({ default: m.PrivacyPolicy }))
);
const TermsOfService = lazy(() =>
  import("./components/LegalPages").then(m => ({ default: m.TermsOfService }))
);
const AboutApp = lazy(() =>
  import("./components/LegalPages").then(m => ({ default: m.AboutApp }))
);
import { SrsState, nextSrsState, getDueWordIds, todayStr } from "./srs";
import { readStoredArray, readStoredObject, writeStored, prefersDarkTheme } from "./storage";
import { growRivals } from "./rivalGrowth";
import { BrainCircuit, Compass, Award, ExternalLink, BookOpen, FileText, Network, Sun, Moon, Sparkles, RotateCcw, Database, Target, CheckCircle2, Gift, Repeat, ArrowLeft, BookMarked } from "lucide-react";
import { RayIcon, GorillaIcon } from "./components/BrandIcons";

/** 遅延読み込みの画面を待つあいだの表示 */
function ScreenLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3" id="screen_loading">
      <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-xs font-bold text-gray-500 dark:text-slate-400">画面を読み込んでいます…</p>
    </div>
  );
}

// 苦手単語を1語卒業したときのボーナス点
const GRADUATION_BONUS = 50;


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
    const defaults: UserStats = {
      score: 0,
      currentStreak: 0,
      lastLoginDate: null,
      completedQuestions: 0,
      correctAnswers: 0,
      unlockedLevels: ["junior"]
    };
    // 保存済みデータに欠けている項目はデフォルト値で補う
    return { ...defaults, ...readStoredObject<Partial<UserStats>>("quest_stats", {}) };
  });

  // 単語データは3.1MBあるので、起動時ではなく読み込めてから入れる。
  // 読み込みが終わるまでは空なので、保存の副作用を動かしてはいけない
  const [vocabulary, setVocabulary] = useState<Word[]>([]);
  const [vocabularyReady, setVocabularyReady] = useState(false);
  // 初期収録単語のID（ユーザー追加分＝AI/CSV/PDF由来の単語の判定に使う）
  const initialVocabIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    loadVocabulary().then(words => {
      if (!alive) return;
      initialVocabIdsRef.current = new Set(words.map(w => w.id));
      setVocabulary([...words, ...readStoredArray<Word>("quest_vocab_custom")]);
      setVocabularyReady(true);
    });
    return () => { alive = false; };
  }, []);

  const [wrongWords, setWrongWords] = useState<string[]>(() =>
    readStoredArray<string>("quest_wrong_words")
  );

  const [solvedHistory, setSolvedHistory] = useState<Record<string, { correctCount: number; attemptCount: number }>>(() =>
    readStoredObject<Record<string, { correctCount: number; attemptCount: number }>>("quest_solved_history", {})
  );

  const [ranking, setRanking] = useState<RankingUser[]>(() => {
    const saved = readStoredArray<RankingUser>("quest_ranking_score");
    // localStorageに残されたデータがMeを含まない or 古い場合はマージ
    if (saved.some(u => u && u.isMe)) {
      return saved;
    }
    // 初期値に自分のスコアをマッピング
    const statsScore = readStoredObject<{ score?: number }>("quest_stats", {}).score || 0;
    const withMe = DEFAULT_RANKING.map(u => u.isMe ? { ...u, score: statsScore } : u);
    return withMe.sort((a, b) => b.score - a.score);
  });

  // ランキングのCPUを最後に成長させた日（YYYY-MM-DD）
  const [rivalGrowthDate, setRivalGrowthDate] = useState<string>(
    () => localStorage.getItem("quest_rival_growth_date") || todayStr()
  );

  // 起動時に、前回からの経過日数ぶんCPUのスコアを伸ばす。
  // 固定値のままだと、一度追い抜いた後は順位が永久に動かなくなるため。
  useEffect(() => {
    const today = todayStr();
    if (rivalGrowthDate === today) return;
    setRanking(prev => {
      const { ranking: grown, updated } = growRivals(prev, rivalGrowthDate, today);
      return updated ? grown : prev;
    });
    setRivalGrowthDate(today);
  }, []);

  useEffect(() => {
    writeStored("quest_rival_growth_date", rivalGrowthDate);
  }, [rivalGrowthDate]);

  // テーマ切り替え (ダークモード用)。
  // 一度も切り替えていない利用者には端末の設定に合わせる。
  // 以前は保存値が "dark" かどうかだけを見ていたため、OSをダークにしている人でも
  // 初回は必ずライトで開いていた。
  const [isDark, setIsDark] = useState<boolean>(() => prefersDarkTheme());

  // 間隔反復(SRS)の単語ごとのスケジュール状態
  const [srsData, setSrsData] = useState<Record<string, SrsState>>(() =>
    readStoredObject<Record<string, SrsState>>("quest_srs", {})
  );

  // デイリー学習目標の進捗（今日の解答数）
  const [dailyProgress, setDailyProgress] = useState<{ date: string; count: number }>(() =>
    readStoredObject<{ date: string; count: number }>("quest_daily_progress", { date: todayStr(), count: 0 })
  );

  // 1日の学習目標（問題数）
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    const v = Number(localStorage.getItem("quest_daily_goal"));
    return v > 0 ? v : 20;
  });

  // 学習カレンダー用の日別解答ログ（日付 -> 解答数・正解数）
  const [dailyLog, setDailyLog] = useState<Record<string, { count: number; correct: number }>>(() =>
    readStoredObject<Record<string, { count: number; correct: number }>>("quest_daily_log", {})
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    writeStored("quest_theme", isDark ? "dark" : "light");
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
    writeStored("quest_stats", stats);
  }, [stats]);

  useEffect(() => {
    writeStored("quest_wrong_words", wrongWords);
  }, [wrongWords]);

  useEffect(() => {
    writeStored("quest_solved_history", solvedHistory);
  }, [solvedHistory]);

  useEffect(() => {
    writeStored("quest_ranking_score", ranking);
  }, [ranking]);

  useEffect(() => {
    // ユーザーが追加した単語（AI追加・CSVインポート・PDF抽出など、初期収録以外すべて）を保存
    // ※以前は "ai_" で始まるIDのみ保存していたため、CSV/PDF由来の単語がリロードで消える不具合があった
    // 読み込み前の空の状態で走らせると、保存済みの追加単語を空で上書きしてしまう
    if (!vocabularyReady) return;
    const customOnly = vocabulary.filter(w => !initialVocabIdsRef.current.has(w.id));
    writeStored("quest_vocab_custom", customOnly);
  }, [vocabulary, vocabularyReady]);

  useEffect(() => {
    writeStored("quest_srs", srsData);
  }, [srsData]);

  useEffect(() => {
    writeStored("quest_daily_progress", dailyProgress);
  }, [dailyProgress]);

  useEffect(() => {
    writeStored("quest_daily_goal", String(dailyGoal));
  }, [dailyGoal]);

  useEffect(() => {
    writeStored("quest_daily_log", dailyLog);
  }, [dailyLog]);

  // ごほうびガチャ関連の永続化ステート
  const [ownedRewardIds, setOwnedRewardIds] = useState<string[]>(() =>
    readStoredArray<string>("quest_owned_rewards")
  );

  // これまでにガチャで消費したポイントの累計（stats.score自体は減算しない）
  const [gachaSpent, setGachaSpent] = useState<number>(() => {
    const v = Number(localStorage.getItem("quest_gacha_spent"));
    return v > 0 ? v : 0;
  });

  const [equipped, setEquipped] = useState<{ avatar?: string; title?: string }>(() =>
    readStoredObject<{ avatar?: string; title?: string }>("quest_equipped", {})
  );

  /**
   * いま使えるポイント。
   *
   * `stats.score` は「これまでに稼いだ合計」で、ガチャを引いても減らない。
   * ヘッダーはその合計を「P」として出していたため、ガチャ画面の
   * 「使えるポイント」と数字が食い違い、同じ画面に2つのPが並んでいた。
   * 使い切りかけている人には、ヘッダーが 3,000P と出ているのに
   * 「ポイントが足りません」と断られることになる。
   * ヘッダーは使える額を出し、合計はダッシュボードの
   * 「合計スコア」「総スコア」が受け持つ。
   */
  const availablePoints = Math.max(0, stats.score - gachaSpent);

  useEffect(() => {
    writeStored("quest_owned_rewards", ownedRewardIds);
  }, [ownedRewardIds]);

  useEffect(() => {
    writeStored("quest_gacha_spent", String(gachaSpent));
  }, [gachaSpent]);

  useEffect(() => {
    writeStored("quest_equipped", equipped);
  }, [equipped]);


  // 3. ルーティング
  //
  // 画面ごとにURLを持つ。持たせていなかったときは、ホーム画面に追加して使うと
  // 端末の戻るボタンで前の画面に戻らずアプリごと閉じ、再読み込みでも
  // 必ずダッシュボードに戻されていた。
  const initialRoute = resolveOnEntry(pathToRoute(window.location.pathname));
  const [currentScreen, setCurrentScreen] = useState<Screen>(initialRoute.screen);
  const [selectedLevel, setSelectedLevel] = useState<Level>("junior");
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(10);

  // SRS復習セッション用の出題スナップショット。
  // dueWords（毎レンダーで再計算される配列）を直接 Quiz に渡すと、1問解答するごとに
  // SRSデータが更新されて配列の中身・参照が変わり、セッション途中で問題が再生成されて
  // 崩壊する不具合があったため、復習開始時点のリストを固定して渡す。
  const [srsSessionWords, setSrsSessionWords] = useState<Word[]>([]);

  /**
   * 復習セッションの出題形式。
   *
   * 復習はどちらの入口も四択に固定されていたため、文穴埋めや綴りで覚えた語も
   * 四択でしか出し直せなかった。形式を選んでから始める形にする。
   * null のあいだは形式の選択画面を出す。
   */
  const [reviewFormat, setReviewFormat] = useState<QuizFormat | null>(null);
  // 長文や辞書から文法ガイドへ移ったとき、開くべき項目（URLからも入る）
  const [grammarTopicId, setGrammarTopicId] = useState<string | null>(
    initialRoute.screen === "grammar" ? initialRoute.param ?? null : null
  );
  // 開いている長文（URLに持たせて、読み返せるようにする）
  const [openPassageId, setOpenPassageId] = useState<string | null>(
    initialRoute.screen === "reading" ? initialRoute.param ?? null : null
  );
  /** 苦手単語の復習を「一覧」ではなくクイズとして解いているときの出題対象 */
  const [wrongSessionWords, setWrongSessionWords] = useState<Word[]>([]);

  // 画面切り替え時にスクロールを先頭に戻す。
  // ダッシュボード下部のボタンから遷移した際、前画面のスクロール位置が
  // 引き継がれて次の画面が途中位置で表示されるのを防ぐ。
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentScreen]);

  /** 画面を切り替え、URLも進める */
  const navigate = useCallback((screen: Screen, param?: string | null) => {
    const path = routeToPath({ screen, param: param ?? undefined });
    if (path !== window.location.pathname) {
      window.history.pushState({ screen, param: param ?? null }, "", path);
    }
    setCurrentScreen(screen);
    setGrammarTopicId(screen === "grammar" ? param ?? null : null);
    setOpenPassageId(screen === "reading" ? param ?? null : null);
  }, []);

  /**
   * 同じ画面の中で開いているもの（文法項目・長文）が変わったときにURLだけ差し替える。
   * 履歴を積まないので、戻るを押すと画面ごと前へ戻る
   * （長文を1本ずつ遡らされることにならない）。
   */
  const replaceParam = useCallback((screen: Screen, param: string | null) => {
    const path = routeToPath({ screen, param: param ?? undefined });
    if (path !== window.location.pathname) {
      window.history.replaceState({ screen, param }, "", path);
    }
  }, []);

  // 戻る・進むでURLが変わったら、その画面へ移る
  useEffect(() => {
    const onPop = () => {
      const next = resolveOnEntry(pathToRoute(window.location.pathname));
      setSrsSessionWords([]);
      setWrongSessionWords([]);
      setReviewFormat(null);
      setCurrentScreen(next.screen);
      setGrammarTopicId(next.screen === "grammar" ? next.param ?? null : null);
      setOpenPassageId(next.screen === "reading" ? next.param ?? null : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // 知らないパスや、URLからは復元できない画面で開かれたときにURLを整える
  useEffect(() => {
    const path = routeToPath(initialRoute);
    if (path !== window.location.pathname) {
      window.history.replaceState({ screen: initialRoute.screen }, "", path);
    }
  }, []);

  const handleStartQuiz = (
    level: Level,
    type: "word" | "sentence" | "listening" | "spelling" | "reverse",
    count: number = 10
  ) => {
    setSelectedLevel(level);
    setQuizQuestionCount(count);
    navigate(
      type === "word" ? "quiz"
        : type === "listening" ? "listening_quiz"
        : type === "spelling" ? "spelling_quiz"
        : type === "reverse" ? "reverse_quiz"
        : "sentence_quiz"
    );
  };

  const handleBackToDashboard = () => {
    setSrsSessionWords([]);
    setWrongSessionWords([]);
    setReviewFormat(null);
    navigate("dashboard");
  };

  /**
   * 文法ガイドの特定の項目を開く。
   * 長文で詰まった文法や、辞書で見た文型の説明へ、その場から移れるようにする。
   */
  const openGrammarTopic = (topicId: string) => {
    navigate("grammar", topicId);
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

  /**
   * 復習セッションの1問ぶんの後始末。
   *
   * 苦手単語の復習で正解したら、その語を苦手リストから外す（卒業）。
   * 四択の復習テスト（ReviewList）だけが持っていた振る舞いだが、
   * 形式を選べるようにした以上、どの形式で解いても同じでなければならない。
   */
  const recordReviewAnswer = useCallback((wordId: string, isCorrect: boolean) => {
    recordAnswer(wordId, isCorrect);
    if (!isCorrect || !wrongWords.includes(wordId)) return;
    setWrongWords(prev => prev.filter(id => id !== wordId));
    // 卒業ボーナス（1語につき50ポイント）。四択の復習テストが持っていた報酬を引き継ぐ
    updateRankingScore(GRADUATION_BONUS);
    setStats(prev => ({ ...prev, score: prev.score + GRADUATION_BONUS }));
  }, [recordAnswer, wrongWords]);

  /**
   * 復習セッションを、選ばれた形式のクイズとして描画する。
   *
   * 形式ごとにコンポーネントが違うだけで、渡すものは同じ。
   * 出題対象はその形式で出せる語に絞る（綴りはイディオムを出せない、
   * 文穴埋めは例文が要る）。
   */
  const renderReviewQuiz = (picked: Word[], onAnswer: (wordId: string, isCorrect: boolean) => void) => {
    if (!reviewFormat) return null;
    // 形式選択の画面では0語の形式を選べなくしてあるが、
    // 直接この画面に来たときに読み込み中のまま止まらないようにする
    if (picked.length === 0) {
      return (
        <div className="max-w-xl mx-auto">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl p-8 shadow-sm text-center space-y-4">
            <h2 className="text-lg font-black text-gray-900 dark:text-slate-100">
              {QUIZ_FORMAT_LABELS[reviewFormat]}で出せる単語がありません
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
              綴りはイディオムを、文穴埋めは例文の無い単語を出題できません。別の形式を選んでください。
            </p>
            <button
              onClick={() => setReviewFormat(null)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-8 py-3 rounded-2xl shadow transition cursor-pointer text-sm"
            >
              形式を選び直す
            </button>
          </div>
        </div>
      );
    }
    const common = {
      level: selectedLevel,
      vocabulary,
      wrongWords,
      setWrongWords,
      solvedHistory,
      setSolvedHistory,
      setStats,
      onBackToDashboard: handleBackToDashboard,
      updateRankingScore,
      questionCount: Math.min(picked.length, 30),
      customWords: picked,
      reviewMode: true,
      recordAnswer: onAnswer
    };
    if (reviewFormat === "sentence") return <SentenceQuiz {...common} />;
    if (reviewFormat === "spelling") return <SpellingQuiz {...common} />;
    return (
      <Quiz
        {...common}
        listeningMode={reviewFormat === "listening"}
        reverseMode={reviewFormat === "reverse"}
      />
    );
  };

  /**
   * 選んだ形式で出題できる語。
   *
   * 毎レンダーで作り直すと配列の同一性が変わり、
   * クイズ側が出題をやり直して解答の途中で問題が入れ替わる。
   */
  const srsReviewWords = useMemo(
    () => (reviewFormat ? wordsForFormat(srsSessionWords, reviewFormat) : []),
    [srsSessionWords, reviewFormat]
  );
  const wrongReviewWords = useMemo(
    () => (reviewFormat ? wordsForFormat(wrongSessionWords, reviewFormat) : []),
    [wrongSessionWords, reviewFormat]
  );

  /** 復習の形式を選ぶ画面。出題対象と説明を添える */
  const renderReviewFormatPicker = (words: Word[], title: string, note: string) => (
    <div className="max-w-xl mx-auto">
      <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <button
          onClick={handleBackToDashboard}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ダッシュボードに戻る</span>
        </button>
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-slate-100">{title}</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed mt-1">{note}</p>
        </div>
        <QuizFormatPicker words={words} onSelect={setReviewFormat} />
      </div>
    </div>
  );

  // 今日復習すべき単語（SRSの期日が今日以前のもの）
  // 収録単語は約7,800語あるため、ID一覧を配列のまま includes で引くと
  // 毎レンダーで O(単語数 × 復習対象数) の走査になる。Set で定数時間の判定にする。
  const today = todayStr();
  const dueWords: Word[] = useMemo(() => {
    const dueWordIdSet = new Set(getDueWordIds(srsData, today));
    return vocabulary.filter(w => dueWordIdSet.has(w.id));
  }, [srsData, vocabulary, today]);
  // 今日解いた問題数（日付が変わっていたら0）
  const todayCount = dailyProgress.date === today ? dailyProgress.count : 0;
  const goalReached = todayCount >= dailyGoal;
  // クイズなど集中して取り組む画面では、ヘッダーの機能ボタン群を隠して画面を広く使う
  const isFocusScreen =
    currentScreen === "quiz" ||
    currentScreen === "sentence_quiz" ||
    currentScreen === "listening_quiz" ||
    currentScreen === "reverse_quiz" ||
    currentScreen === "spelling_quiz" ||
    currentScreen === "review" ||
    currentScreen === "review_quiz" ||
    currentScreen === "srs_review";

  // 単語データが届くまでは、どの画面も0語で描くことになるので待つ。
  // 待つといっても外枠と文字は先に出るので、以前のように
  // 3.1MBの解析が終わるまで真っ白、ということにはならない
  if (!vocabularyReady) {
    return (
      <div
        className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 flex flex-col items-center justify-center gap-4"
        id="vocabulary_loading_screen"
      >
        <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-md">
          <BrainCircuit className="w-7 h-7" />
        </div>
        <p className="text-sm font-black text-gray-700 dark:text-slate-200">Eigorira</p>
        <p className="text-xs font-bold text-gray-400 dark:text-slate-500">単語データを読み込んでいます…</p>
      </div>
    );
  }

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
              <span className="flex items-center gap-1.5">
                {/* しるしを足したぶん幅が要る。折り返しを許すと
                    「エイゴ / リラ」と切れて名前として読めなくなる */}
                <span className="font-black text-lg tracking-tight whitespace-nowrap bg-gradient-to-r from-gray-900 via-indigo-950 to-indigo-700 dark:from-slate-100 dark:via-indigo-200 dark:to-indigo-400 bg-clip-text text-transparent font-sans">
                  Eigorira
                </span>
                {/* 名前の由来（エイとゴリラ）。読み上げには要らないので隠す。
                    グラデーションの span の中には置かない（文字色を透明にしているため） */}
                <span className="flex items-center gap-1 text-indigo-700 dark:text-indigo-300 shrink-0" aria-hidden="true" data-testid="brand_icons_header">
                  <RayIcon className="w-4.5 h-4.5" />
                  <GorillaIcon className="w-4.5 h-4.5" />
                </span>
              </span>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black font-mono tracking-widest uppercase mt-[-1px]">
                english study app
              </p>
            </div>
          </div>

          {/* 機能への入口。スマホでは折り返さず横スクロールにする。
              折り返すと10個で約300px を占め、本文に着くまで指1本ぶん送る必要があった。
              高さは指針どおり44px以上にする（以前は30px） */}
          <div className="flex flex-nowrap sm:flex-wrap items-center gap-2.5 overflow-x-auto sm:overflow-visible -mx-6 px-6 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
            {/* クイズなど集中画面では機能ボタン群を隠す */}
            {!isFocusScreen && (
            <>
            {/* AIつながりマップ・パズルボタン */}
            <button
              onClick={() => navigate(currentScreen === "map_puzzle" ? "dashboard" : "map_puzzle")}
              className={`flex shrink-0 items-center gap-1.5 px-3.5 min-h-11 rounded-xl text-xs font-bold transition shadow-2xs select-none border cursor-pointer whitespace-nowrap ${
                currentScreen === "map_puzzle"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-100 dark:shadow-none"
                  : "bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-705"
              }`}
              id="nav_map_puzzle_toggle_btn"
            >
              <Network className="w-3.5 h-3.5" />
              <span>AIつながりマップ・パズル</span>
            </button>

            {/* 今日の復習(SRS)ボタン */}
            <button
              onClick={() => {
                if (currentScreen === "srs_review") {
                  handleBackToDashboard();
                } else {
                  // 復習セッション開始時点の対象単語を固定する
                  setSrsSessionWords(dueWords);
                  navigate("srs_review");
                }
              }}
              className={`relative flex shrink-0 items-center gap-1.5 px-3.5 min-h-11 rounded-xl text-xs font-bold transition shadow-2xs select-none border cursor-pointer whitespace-nowrap ${
                currentScreen === "srs_review"
                  ? "bg-indigo-600 text-white border-indigo-600"
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

            {/* ごほうびガチャボタン */}
            <button
              onClick={() => navigate(currentScreen === "gacha" ? "dashboard" : "gacha")}
              className={`flex shrink-0 items-center gap-1.5 px-3.5 min-h-11 rounded-xl text-xs font-bold transition shadow-2xs select-none border cursor-pointer whitespace-nowrap ${
                currentScreen === "gacha"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-slate-800 dark:to-slate-850 text-violet-800 dark:text-violet-300 hover:opacity-90 border-violet-200/55 dark:border-slate-700"
              }`}
              id="nav_gacha_btn"
              title="貯めたポイントでアバターや称号を手に入れよう"
            >
              <Gift className="w-3.5 h-3.5" />
              <span>ごほうびガチャ</span>
            </button>

            {/* データ設定・バックアップボタン */}
            <button
              onClick={() => navigate(currentScreen === "settings" ? "dashboard" : "settings")}
              className={`flex shrink-0 items-center gap-1.5 px-3.5 min-h-11 rounded-xl text-xs font-bold transition shadow-2xs select-none border cursor-pointer whitespace-nowrap ${
                currentScreen === "settings"
                  ? "bg-indigo-600 text-white border-indigo-600"
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
              className={`flex shrink-0 items-center gap-1.5 px-3.5 min-h-11 border rounded-xl text-xs font-bold font-mono shadow-inner whitespace-nowrap ${
                goalReached
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300"
                  : "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400"
              }`}
              title="今日の学習目標の進捗"
            >
              {goalReached ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
              <span>{todayCount}/{dailyGoal}</span>
            </div>

            <div className="hidden sm:flex shrink-0 items-center gap-1.5 px-3.5 min-h-11 bg-gray-50 dark:bg-slate-800 border rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-400 font-mono shadow-inner border-gray-200 dark:border-slate-700">
              <Compass className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
              <span>Ver 1.6.0</span>
            </div>

            {/* テーマ切り替えボタン (Sun/Moon Toggle) */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border border-gray-200 dark:border-slate-750 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-750 dark:text-slate-200 transition cursor-pointer select-none"
              title={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
              id="theme_toggle_btn"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 fill-amber-350" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-700 fill-indigo-100" />
              )}
            </button>
            
            {/* 暗いテーマでは indigo の変数そのものを反転させている（index.css）。
                dark: を重ねると二重に反転して、暗い地に暗い文字が載る
                （「P」の実測 1.58）。ここでは変数の反転に任せる。 */}
            <div
              className="shrink-0 px-3.5 min-h-11 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center gap-1.5"
              title="ごほうびガチャで使えるポイント"
              data-testid="header_points"
            >
              <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-indigo-950 font-mono" aria-label={`使えるポイント ${availablePoints}`}>
                {availablePoints} <span className="text-[10px] text-indigo-600 dark:text-indigo-400">P</span>
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* メインステージ */}
      <main className="flex-1 py-8 px-4 max-w-4xl w-full mx-auto" id="main_payload">
        {/* 遅延読み込みの画面を開いている間の待ち。
            画面が入れ替わるだけで、ヘッダーとフッターは出たまま */}
        <Suspense fallback={<ScreenLoading />}>
        {currentScreen === "dashboard" && (
          <Dashboard
            stats={stats}
            setStats={setStats}
            vocabulary={vocabulary}
            setVocabulary={setVocabulary}
            solvedHistory={solvedHistory}
            srsData={srsData}
            wrongWords={wrongWords}
            onStartQuiz={handleStartQuiz}
            onStartReview={() => navigate("review")}
            onOpenDictionary={() => navigate("dictionary")}
            onStartReading={() => navigate("reading")}
            onOpenDiary={() => navigate("diary")}
            dueCount={dueWords.length}
            onStartSrsReview={() => {
              // 復習セッション開始時点の対象単語を固定する（ヘッダーのボタンと同じ）
              setSrsSessionWords(dueWords);
              navigate("srs_review");
            }}
            onOpenVerbForms={() => navigate("verb_forms")}
            onOpenGrammar={() => navigate("grammar")}
            ranking={ranking}
            setRanking={setRanking}
            dailyLog={dailyLog}
            dailyGoal={dailyGoal}
            equipped={equipped}
            onOpenGachaShop={() => navigate("gacha")}
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
            srsData={srsData}
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
            srsData={srsData}
            recordAnswer={recordAnswer}
          />
        )}

        {currentScreen === "reverse_quiz" && (
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
            reverseMode={true}
            srsData={srsData}
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
            srsData={srsData}
            recordAnswer={recordAnswer}
          />
        )}

        {currentScreen === "spelling_quiz" && (
          <SpellingQuiz
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
            srsData={srsData}
            recordAnswer={recordAnswer}
          />
        )}

        {currentScreen === "review" && (
          <ReviewList
            vocabulary={vocabulary}
            wrongWords={wrongWords}
            setWrongWords={setWrongWords}
            onBackToDashboard={handleBackToDashboard}
            onStartReviewQuiz={(format) => {
              // セッション開始時点の苦手単語を固定する。
              // 正解のたびに wrongWords が変わるため、途中で出題対象が入れ替わってしまう
              const wrongSet = new Set(wrongWords);
              setWrongSessionWords(vocabulary.filter(w => wrongSet.has(w.id)));
              setReviewFormat(format);
              navigate("review_quiz");
            }}
          />
        )}

        {currentScreen === "dictionary" && (
          <Dictionary
            vocabulary={vocabulary}
            wrongWords={wrongWords}
            setWrongWords={setWrongWords}
            solvedHistory={solvedHistory}
            srsData={srsData}
            onBackToDashboard={handleBackToDashboard}
            onOpenGrammar={openGrammarTopic}
          />
        )}

        {currentScreen === "reading" && (
          <Reading
            stats={stats}
            setStats={setStats}
            onBackToDashboard={handleBackToDashboard}
            updateRankingScore={updateRankingScore}
            vocabulary={vocabulary}
            wrongWords={wrongWords}
            setWrongWords={setWrongWords}
            onOpenGrammar={openGrammarTopic}
            initialPassageId={openPassageId}
            onOpenPassageChange={id => replaceParam("reading", id)}
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

        {currentScreen === "grammar" && (
          <Grammar
            vocabulary={vocabulary}
            onBackToDashboard={handleBackToDashboard}
            initialTopicId={grammarTopicId}
            onOpenTopicChange={id => replaceParam("grammar", id)}
          />
        )}

        {currentScreen === "verb_forms" && (
          <VerbFormsScreen
            vocabulary={vocabulary}
            onBackToDashboard={handleBackToDashboard}
          />
        )}

        {currentScreen === "diary" && (
          <AIDiary
            vocabulary={vocabulary}
            solvedHistory={solvedHistory}
            srsData={srsData}
            setSolvedHistory={setSolvedHistory}
            onBackToDashboard={handleBackToDashboard}
          />
        )}

        {/* 苦手単語の復習を、選んだ形式のクイズとして解く */}
        {currentScreen === "review_quiz" && (
          reviewFormat === null
            ? renderReviewFormatPicker(
                wrongSessionWords,
                `苦手克服テスト — ${wrongSessionWords.length}語`,
                "正解した単語は苦手リストから卒業します。どの形式で確かめるか選んでください。"
              )
            : renderReviewQuiz(wrongReviewWords, recordReviewAnswer)
        )}

        {currentScreen === "srs_review" && (
          srsSessionWords.length > 0 ? (
            reviewFormat === null
              ? renderReviewFormatPicker(
                  srsSessionWords,
                  `今日の復習 — ${srsSessionWords.length}語`,
                  "忘却曲線にもとづく今日の対象です。どの形式で解き直すか選んでください。覚えたときと同じ形式で確かめると、身についているかがはっきりします。"
                )
              : renderReviewQuiz(srsReviewWords, recordAnswer)
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

        {currentScreen === "gacha" && (
          <GachaShop
            availablePoints={availablePoints}
            totalScore={stats.score}
            ownedRewardIds={ownedRewardIds}
            setOwnedRewardIds={setOwnedRewardIds}
            gachaSpent={gachaSpent}
            setGachaSpent={setGachaSpent}
            equipped={equipped}
            setEquipped={setEquipped}
            onBackToDashboard={handleBackToDashboard}
          />
        )}

        {currentScreen === "privacy" && (
          <PrivacyPolicy onBack={handleBackToDashboard} />
        )}

        {currentScreen === "about" && (
          <AboutApp onBack={handleBackToDashboard} />
        )}

        {currentScreen === "terms" && (
          <TermsOfService onBack={handleBackToDashboard} />
        )}
        </Suspense>
      </main>

      {/* 広告枠（全コンテンツの下・控えめに1枠。未設定時は非表示） */}
      <AdBanner />

      {/* 謙虚でスタイリッシュなフッター */}
      <footer className="bg-white dark:bg-slate-900 border-t border-gray-150 dark:border-slate-800 py-6 px-4 transition-colors duration-300" id="global_footer">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-gray-400 dark:text-slate-500 gap-4 font-semibold font-sans">
          <p>© 2026 Eigorira. Built with Google AI Studio &amp; Claude.</p>
          {/* 狭い画面では折り返す。タップ領域を広げたときに whitespace-nowrap を
              付けたため、360〜390px で横にはみ出していた */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {/* 規約・ポリシーと同じく1枚の画面にする。
                以前はフッターの中で開く小さなパネルで、
                長い説明を読むには向いていなかった（URLも持てない） */}
            <button
              onClick={() => navigate("about")}
              className="min-h-11 px-2 whitespace-nowrap hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              id="btn_about_app"
            >
              アプリケーション説明
            </button>
            <span aria-hidden="true" className="text-gray-300 dark:text-slate-600">|</span>
            <button
              onClick={() => navigate("privacy")}
              className="min-h-11 px-2 whitespace-nowrap hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            >
              プライバシーポリシー
            </button>
            <span aria-hidden="true" className="text-gray-300 dark:text-slate-600">|</span>
            <button
              onClick={() => navigate("terms")}
              className="min-h-11 px-2 whitespace-nowrap hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            >
              利用規約
            </button>
            <span aria-hidden="true" className="text-gray-300 dark:text-slate-600">|</span>
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
