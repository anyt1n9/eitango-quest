/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { Level, Word, UserStats, RankingUser } from "./types";
import { splitStoredWords } from "./storedWords";
import { loadVocabulary } from "./vocabulary";
import Dashboard from "./components/Dashboard";
import Quiz from "./components/Quiz";
import QuizFormatPicker from "./components/QuizFormatPicker";
import { QuizFormat, QUIZ_FORMAT_LABELS, wordsForFormat } from "./quizFormats";
import { Screen, Route, TAB_SCREENS, pathToRoute, routeToPath, resolveOnEntry, isTransient, tabForScreen, isTabRoot } from "./routes";
import AdBanner from "./components/AdBanner";
import TabBar from "./components/TabBar";

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
const SynonymQuiz = lazy(() => import("./components/SynonymQuiz"));
const SenseQuiz = lazy(() => import("./components/SenseQuiz"));
const ReviewList = lazy(() => import("./components/ReviewList"));
const Dictionary = lazy(() => import("./components/Dictionary"));
const Reading = lazy(() => import("./components/Reading"));
const MapAndPuzzle = lazy(() => import("./components/MapAndPuzzle"));
const AIDiary = lazy(() => import("./components/AIDiary"));
const VerbFormsScreen = lazy(() => import("./components/VerbForms"));
const Grammar = lazy(() => import("./components/Grammar"));
const DataBackup = lazy(() => import("./components/DataBackup"));
const GachaShop = lazy(() => import("./components/GachaShop"));
const BackgroundSettings = lazy(() => import("./components/BackgroundSettings"));
const PrivacyPolicy = lazy(() =>
  import("./components/LegalPages").then(m => ({ default: m.PrivacyPolicy }))
);
const TermsOfService = lazy(() =>
  import("./components/LegalPages").then(m => ({ default: m.TermsOfService }))
);
const AboutApp = lazy(() =>
  import("./components/LegalPages").then(m => ({ default: m.AboutApp }))
);
// 画面下のタブの「教材」「記録」「メニュー」
const LearnHub = lazy(() => import("./components/LearnHub"));
const Records = lazy(() => import("./components/Records"));
const MenuScreen = lazy(() => import("./components/MenuScreen"));
import { SrsState, nextSrsState, getDueWordIds, todayStr, sanitizeSrs } from "./srs";
import { currentLoginStreak } from "./loginBonus";
import { readStoredArray, readStoredObject, readStoredString, writeStored, prefersDarkTheme } from "./storage";
import { growRivals } from "./rivalGrowth";
import { BrainCircuit, Sun, Moon, CheckCircle2, ArrowLeft, Trophy, Calendar } from "lucide-react";
import { RayIcon, GorillaIcon } from "./components/BrandIcons";
import BackgroundScene from "./components/BackgroundScene";
import { readBackgroundImage, readVeilLevel, saveVeilLevel, VeilLevel } from "./backgroundImage";
import { GlassLevel, readGlassLevel, saveGlassLevel } from "./glass";
import { readStudyLevel, saveStudyLevel, readQuestionCount, saveQuestionCount } from "./studySettings";

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

/**
 * 履歴の state に残した「開いたタブ」。下の階層の画面でだけ意味を持つ。
 * 他のアプリやブラウザが書いた state もありうるので、タブの画面名のときだけ信じる。
 */
function parentFromHistory(screen: Screen): Screen | null {
  if (isTabRoot(screen) || isTransient(screen)) return null;
  const parent = (window.history.state as { parent?: unknown } | null)?.parent;
  return typeof parent === "string" && isTabRoot(parent as Screen) ? (parent as Screen) : null;
}

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

  // 読み込みに失敗したときの表示
  const [vocabularyFailed, setVocabularyFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadVocabulary().then(words => {
      if (!alive) return;
      initialVocabIdsRef.current = new Set(words.map(w => w.id));
      // 追加した単語は形を確かめてから入れる（壊れた要素1件で画面ごと落ちないように）。
      // 捨てた要素は次の保存で消えるので、別のキーに控えて黙って失わないようにする
      const custom = splitStoredWords(readStoredArray<unknown>("quest_vocab_custom"), initialVocabIdsRef.current);
      if (custom.rejected.length > 0) {
        writeStored("quest_vocab_custom_rejected", [
          ...readStoredArray<unknown>("quest_vocab_custom_rejected"),
          ...custom.rejected
        ]);
      }
      setVocabulary([...words, ...custom.words]);
      setVocabularyReady(true);
    }).catch(() => {
      // 単語データは別のチャンクなので、通信断やサービスワーカー更新の直後は
      // 取りに行けないことがある。黙って待ち続けると待機画面から出られないので、
      // 失敗したことを伝えて押し直せるようにする
      if (!alive) return;
      setVocabularyFailed(true);
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
    () => readStoredString("quest_rival_growth_date") || todayStr()
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

  /** 利用者が選んだ背景画像（無ければ、はじめからの飾りを出す） */
  const [bgImage, setBgImage] = useState<string | null>(() => readBackgroundImage());

  /** 背景画像の上にかける幕の濃さ */
  const [bgVeil, setBgVeil] = useState<VeilLevel>(() => readVeilLevel());
  const changeBgVeil = useCallback((v: VeilLevel) => {
    setBgVeil(v);
    saveVeilLevel(v);
  }, []);

  /** カードとボタンの透明感（ガラス）。
      背景を見せるために面を薄くするほど文字は読みにくくなるので、
      既定は「オフ」（不透明）にして、選んだ人にだけ効かせる */
  const [glass, setGlass] = useState<GlassLevel>(() => readGlassLevel());
  const changeGlass = useCallback((g: GlassLevel) => {
    setGlass(g);
    saveGlassLevel(g);
  }, []);
  useEffect(() => {
    // 濃さは CSS 側（:root[data-glass]）が持つ。
    // 起動直後のちらつきを避けるため、初期値は index.html の先頭でも当てている
    document.documentElement.dataset.glass = glass;
  }, [glass]);

  /** 背景の飾りを動かすか。
      動くものが視界にあると落ち着かない人もいるので、切り替えを持たせる
      （端末の「視差効果を減らす」設定は CSS 側で常に効く） */
  const [bgMotion, setBgMotion] = useState<boolean>(
    () => readStoredString("quest_bg_motion") !== "off"
  );
  useEffect(() => {
    writeStored("quest_bg_motion", bgMotion ? "on" : "off");
  }, [bgMotion]);

  // 間隔反復(SRS)の単語ごとのスケジュール状態
  // 壊れた要素（null・数値でない box など）は読み込みの時点で捨てる（src/srs.ts の sanitizeSrs）
  const [srsData, setSrsData] = useState<Record<string, SrsState>>(() =>
    sanitizeSrs(readStoredObject<Record<string, unknown>>("quest_srs", {}))
  );

  // デイリー学習目標の進捗（今日の解答数）
  const [dailyProgress, setDailyProgress] = useState<{ date: string; count: number }>(() =>
    readStoredObject<{ date: string; count: number }>("quest_daily_progress", { date: todayStr(), count: 0 })
  );

  // 1日の学習目標（問題数）
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    const v = Number(readStoredString("quest_daily_goal"));
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

    // 昨日受け取っていれば連続のまま（日数は「記録」でスタンプを押したときに進む）。
    // 1日以上空いていたら連続を0に戻す
    if (stats.lastLoginDate !== todayS && stats.lastLoginDate !== yesterdayStr && stats.lastLoginDate !== null) {
      setStats(prev => ({
        ...prev,
        currentStreak: 0
      }));
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
    const v = Number(readStoredString("quest_gacha_spent"));
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
  /**
   * 学習のレベルと1回の問題数。「今日」と「教材」の両方から使う。
   *
   * 保存（localStorage）を介して受け渡すと、保存できない環境
   * （Cookie を塞いだブラウザ・埋め込み表示）では片方で選んだものがもう片方に効かず、
   * 「中級1を選んだのに教材から始めたら初級だった」ことになる。
   * ここで1つの state として持ち、保存は覚えておくためだけに使う。
   */
  const [selectedLevel, setSelectedLevel] = useState<Level>(() => readStudyLevel());
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(() => readQuestionCount());
  useEffect(() => saveStudyLevel(selectedLevel), [selectedLevel]);
  useEffect(() => saveQuestionCount(quizQuestionCount), [quizQuestionCount]);

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
  /**
   * 下の階層の画面（文法・ガチャ・データなど）を、どのタブから開いたか。
   * 「戻る」の行き先と、画面下のタブのどれを光らせるかに使う。
   * ガチャは「記録」からも「メニュー」からも開けるので、決め打ちにすると
   * メニューから開いたのに戻ると記録へ出る、ということになる。
   */
  //
  // 開いたタブは履歴の state（`parent`）にも持たせる。state だけに持っていたときは、
  // 戻る・進む・再読み込みで下の階層の画面に着くと親が分からず、
  // 「メニューから開いたガチャ」で記録のタブが光り、戻ると記録へ出ていた。
  const [parentScreen, setParentScreen] = useState<Screen | null>(
    () => parentFromHistory(initialRoute.screen)
  );
  const parentScreenRef = useRef<Screen | null>(parentScreen);
  const currentScreenRef = useRef<Screen>(initialRoute.screen);
  /**
   * 出題（一時的な画面）を始めた画面。終わったら・中断したらそこへ戻す。
   * 以前はどこから始めても「今日」へ戻していたので、教材や苦手単語の一覧から
   * 始めた人は、終わるたびに元の画面を開き直すことになっていた。
   */
  const quizOriginRef = useRef<Screen | null>(null);

  const navigate = useCallback((screen: Screen, param?: string | null) => {
    const from = currentScreenRef.current;
    const parent =
      isTabRoot(screen) ? null
        : isTransient(screen) ? parentScreenRef.current
          : isTabRoot(from) ? from
            : parentScreenRef.current;
    if (isTransient(screen) && !isTransient(from)) quizOriginRef.current = from;
    const path = routeToPath({ screen, param: param ?? undefined });
    if (path !== window.location.pathname) {
      window.history.pushState({ screen, param: param ?? null, parent }, "", path);
    }
    parentScreenRef.current = parent;
    setParentScreen(parent);
    currentScreenRef.current = screen;
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
      window.history.replaceState({ screen, param, parent: parentScreenRef.current }, "", path);
    }
  }, []);

  // 戻る・進むでURLが変わったら、その画面へ移る
  useEffect(() => {
    const onPop = () => {
      const next = resolveOnEntry(pathToRoute(window.location.pathname));
      setSrsSessionWords([]);
      setWrongSessionWords([]);
      setReviewFormat(null);
      const parent = parentFromHistory(next.screen);
      parentScreenRef.current = parent;
      setParentScreen(parent);
      currentScreenRef.current = next.screen;
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
      window.history.replaceState({ screen: initialRoute.screen, parent: parentScreenRef.current }, "", path);
    }
  }, []);

  const handleStartQuiz = (
    level: Level,
    type: "word" | "sentence" | "listening" | "spelling" | "reverse" | "synonym" | "sense",
    count: number = 10
  ) => {
    setSelectedLevel(level);
    setQuizQuestionCount(count);
    navigate(
      type === "word" ? "quiz"
        : type === "listening" ? "listening_quiz"
        : type === "spelling" ? "spelling_quiz"
        : type === "reverse" ? "reverse_quiz"
        : type === "synonym" ? "synonym_quiz"
        : type === "sense" ? "sense_quiz"
        : "sentence_quiz"
    );
  };

  /** 出題を終える・中断する。始めた画面（今日・教材・苦手単語の一覧）へ戻る */
  const handleLeaveQuiz = () => {
    setSrsSessionWords([]);
    setWrongSessionWords([]);
    setReviewFormat(null);
    navigate(quizOriginRef.current ?? "dashboard");
  };

  /** アプリ名を押したとき。どの画面からでも「今日」へ */
  const handleGoHome = () => {
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
  /**
   * その日の学習量だけを数える（今日の目標・学習カレンダー）。
   * 語義分別クイズで、教材が教えていない語義（book の「予約する」）を解いたときに使う。
   * 間隔反復は「教材の訳を覚えたか」を追っているので、そちらには入れない。
   */
  const recordPractice = useCallback((isCorrect: boolean) => {
    const today = todayStr();
    // 累計の回答数・正答数（「記録」）も1問ごとに数える。以前はクイズを最後まで解いたときに
    // まとめて足していたので、途中でやめた問題は学習カレンダーにだけ入り、
    // 同じ画面に「累計解答 11問」と「累計回答数 10問」が並んでいた
    setStats(prev => ({
      ...prev,
      completedQuestions: prev.completedQuestions + 1,
      correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0)
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

  const recordAnswer = useCallback((wordId: string, isCorrect: boolean) => {
    const today = todayStr();
    setSrsData(prev => ({
      ...prev,
      [wordId]: nextSrsState(prev[wordId], isCorrect, today)
    }));
    recordPractice(isCorrect);
  }, [recordPractice]);

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
      onBackToDashboard: handleLeaveQuiz,
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
          onClick={handleLeaveQuiz}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>戻る</span>
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
  // 収録単語は約7,700語あるため、ID一覧を配列のまま includes で引くと
  // 毎レンダーで O(単語数 × 復習対象数) の走査になる。Set で定数時間の判定にする。
  const today = todayStr();
  const dueWords: Word[] = useMemo(() => {
    const dueWordIdSet = new Set(getDueWordIds(srsData, today));
    return vocabulary.filter(w => dueWordIdSet.has(w.id));
  }, [srsData, vocabulary, today]);
  // 今日解いた問題数（日付が変わっていたら0）
  const todayCount = dailyProgress.date === today ? dailyProgress.count : 0;
  // ログインボーナスをまだ受け取っていない（「記録」のタブに印を付ける）
  const bonusClaimable = stats.lastLoginDate !== today;
  // いまの連続ログイン日数（1日以上空いていれば、保存している日数によらず0）
  const loginStreak = currentLoginStreak(stats);
  // 画面下のタブ。出題中（一時的な画面）は出さない
  const activeTab = isTransient(currentScreen) || isTabRoot(currentScreen) || !parentScreen
    ? tabForScreen(currentScreen)
    : tabForScreen(parentScreen);
  /** 下の階層の画面の「戻る」。開いたタブへ戻る（分からなければ、その画面が属するタブへ） */
  const goBack = () => navigate(parentScreen ?? TAB_SCREENS[tabForScreen(currentScreen) ?? "today"]);

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
        {vocabularyFailed ? (
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            {/* 森の地（生成り）の上では rose-600 が 4.28 でAAに届かない。
                濃い rose-700（実測 5.73／海では 7.04）にする */}
            <p className="text-xs font-bold text-rose-700" id="vocabulary_load_error" role="alert">
              単語データを読み込めませんでした。<br />通信の状態を確かめて、もう一度お試しください。
            </p>
            {/*
              読み直しは画面ごと開き直す。
              取得に失敗した動的 import はブラウザの module map に
              「失敗」として残り、同じ画面のまま import() を呼び直しても
              再取得されない（実測: 押し直しでは通信が1回も出ず、
              開き直すと2回目の取得が走って読み込めた）。
            */}
            <button
              type="button"
              id="btn_retry_vocabulary"
              onClick={() => window.location.reload()}
              className="min-h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black cursor-pointer transition"
            >
              もう一度読み込む
            </button>
          </div>
        ) : (
          <p className="text-xs font-bold text-gray-400 dark:text-slate-500">単語データを読み込んでいます…</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-300" id="app_root_container">
      {/* 背景の飾り（明るいテーマ＝ジャングル／暗いテーマ＝海）。
          出題中は出さない。視界のすみで何かが動くと、単語より先にそちらへ目が行く */}
      {!isTransient(currentScreen) && <BackgroundScene motion={bgMotion} image={bgImage} veil={bgVeil} />}
      {/*
        ナビゲーションヘッダー。

        以前は機能ボタンを7つ横に並べており、スマホでは2段に折り返して
        高さが 150px 近くあった（本文に着くまでその分スクロールが要る）。
        いまはアプリ名・テーマ・合計スコア・連続日数だけを出す。
        行き先は画面下のタブ（TabBar）にまとめた。
      */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 py-2.5 px-4 sticky top-0 z-40 shadow-xs transition-colors duration-300" id="navigation_bar">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3">
          <div
            onClick={handleGoHome}
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer hover:opacity-85 select-none min-w-0"
          >
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-150-10 shrink-0">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="flex items-center gap-1.5">
                {/* しるしを足したぶん幅が要る。折り返しを許すと
                    「エイゴ / リラ」と切れて名前として読めなくなる */}
                <span className="hidden min-[390px]:inline font-black text-base sm:text-lg tracking-tight whitespace-nowrap bg-gradient-to-r from-gray-900 via-indigo-950 to-indigo-700 dark:from-slate-100 dark:via-indigo-200 dark:to-indigo-400 bg-clip-text text-transparent font-sans">
                  Eigorira
                </span>
                {/* 名前の由来（エイとゴリラ）。読み上げには要らないので隠す。
                    グラデーションの span の中には置かない（文字色を透明にしているため） */}
                <span className="hidden sm:flex items-center gap-1 text-indigo-700 dark:text-indigo-300 shrink-0" aria-hidden="true" data-testid="brand_icons_header">
                  <RayIcon className="w-4.5 h-4.5" />
                  <GorillaIcon className="w-4.5 h-4.5" />
                </span>
              </span>
            </div>
          </div>

          {/* 合計スコアと連続日数。ダッシュボードの帯に置いていたが、
              ヘッダーは貼り付いているので、どの画面でも・スクロールしても見える。
              狭い画面では名前の横のしるしを引っ込めて、こちらに幅を回す */}
          {/* テーマの切り替え。メニューの中に入れていたが、
              明るさは学習中でも切りたいので、開かずに押せる場所に出す */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="ml-auto mr-1 shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition cursor-pointer"
            title={isDark ? "明るいテーマに切り替え" : "暗いテーマに切り替え"}
            aria-label={isDark ? "明るいテーマに切り替え" : "暗いテーマに切り替え"}
            id="theme_toggle_btn"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400 fill-amber-350" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-700 fill-indigo-100" />
            )}
          </button>

          <div className="flex items-center gap-1 sm:gap-1.5 mr-0.5 sm:mr-1 shrink-0" data-testid="header_stats">
            <div
              className="flex items-center gap-1 px-1.5 sm:px-2.5 min-h-9 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl"
              title="これまでに稼いだ合計スコア"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-200 shrink-0" />
              <span
                className="text-xs font-black tabular-nums text-gray-700 dark:text-slate-200"
                aria-label={`合計スコア ${stats.score}`}
              >
                {stats.score}
              </span>
            </div>
            <div
              className="flex items-center gap-1 px-1.5 sm:px-2.5 min-h-9 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl"
              title="連続ログイン日数"
            >
              <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span
                className="text-xs font-black tabular-nums text-gray-700 dark:text-slate-200"
                aria-label={`ログイン連続 ${loginStreak}日`}
              >
                {loginStreak}日
              </span>
            </div>
          </div>

        </div>
      </header>

      {/* メインステージ。画面下のタブを出している間は、その高さぶん下を空ける */}
      <main
        className="relative z-10 flex-1 pt-6 pb-8 px-4 max-w-4xl w-full mx-auto"
        id="main_payload"
      >
        {/* 遅延読み込みの画面を開いている間の待ち。
            画面が入れ替わるだけで、ヘッダーとタブは出たまま */}
        <Suspense fallback={<ScreenLoading />}>
        {currentScreen === "dashboard" && (
          <Dashboard
            vocabulary={vocabulary}
            solvedHistory={solvedHistory}
            srsData={srsData}
            wrongWords={wrongWords}
            onStartQuiz={handleStartQuiz}
            onStartReview={() => navigate("review")}
            dueCount={dueWords.length}
            onStartSrsReview={() => {
              // 復習セッション開始時点の対象単語を固定する
              setSrsSessionWords(dueWords);
              navigate("srs_review");
            }}
            dailyGoal={dailyGoal}
            todayCount={todayCount}
            bonusClaimable={bonusClaimable}
            onOpenRecords={() => navigate("records")}
            level={selectedLevel}
            onLevelChange={setSelectedLevel}
            questionCount={quizQuestionCount}
            onQuestionCountChange={setQuizQuestionCount}
          />
        )}

        {currentScreen === "learn" && (
          <LearnHub
            vocabulary={vocabulary}
            setVocabulary={setVocabulary}
            setStats={setStats}
            setRanking={setRanking}
            solvedHistory={solvedHistory}
            srsData={srsData}
            wrongWords={wrongWords}
            onStartQuiz={handleStartQuiz}
            level={selectedLevel}
            questionCount={quizQuestionCount}
            onStartReview={() => navigate("review")}
            onOpenReading={() => navigate("reading")}
            onOpenGrammar={() => navigate("grammar")}
            onOpenVerbForms={() => navigate("verb_forms")}
            onOpenMapPuzzle={() => navigate("map_puzzle")}
            onOpenDiary={() => navigate("diary")}
            onChangeLevel={() => navigate("dashboard")}
          />
        )}

        {currentScreen === "records" && (
          <Records
            stats={stats}
            setStats={setStats}
            vocabulary={vocabulary}
            solvedHistory={solvedHistory}
            srsData={srsData}
            wrongWords={wrongWords}
            ranking={ranking}
            setRanking={setRanking}
            dailyLog={dailyLog}
            dailyGoal={dailyGoal}
            equipped={equipped}
            onOpenGachaShop={() => navigate("gacha")}
          />
        )}

        {currentScreen === "menu" && (
          <MenuScreen
            isDark={isDark}
            onToggleTheme={() => setIsDark(v => !v)}
            bgMotion={bgMotion}
            onToggleBgMotion={() => setBgMotion(v => !v)}
            availablePoints={availablePoints}
            onNavigate={screen => navigate(screen)}
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
            onBackToDashboard={handleLeaveQuiz}
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
            onBackToDashboard={handleLeaveQuiz}
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
            onBackToDashboard={handleLeaveQuiz}
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
            onBackToDashboard={handleLeaveQuiz}
            updateRankingScore={updateRankingScore}
            questionCount={quizQuestionCount}
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
            onBackToDashboard={handleLeaveQuiz}
            updateRankingScore={updateRankingScore}
            questionCount={quizQuestionCount}
            srsData={srsData}
            recordAnswer={recordAnswer}
          />
        )}

        {currentScreen === "synonym_quiz" && (
          <SynonymQuiz
            level={selectedLevel}
            vocabulary={vocabulary}
            setWrongWords={setWrongWords}
            solvedHistory={solvedHistory}
            setSolvedHistory={setSolvedHistory}
            setStats={setStats}
            onBackToDashboard={handleLeaveQuiz}
            updateRankingScore={updateRankingScore}
            questionCount={quizQuestionCount}
            srsData={srsData}
            recordAnswer={recordAnswer}
          />
        )}

        {currentScreen === "sense_quiz" && (
          <SenseQuiz
            level={selectedLevel}
            vocabulary={vocabulary}
            setWrongWords={setWrongWords}
            solvedHistory={solvedHistory}
            setSolvedHistory={setSolvedHistory}
            setStats={setStats}
            onBackToDashboard={handleLeaveQuiz}
            updateRankingScore={updateRankingScore}
            questionCount={quizQuestionCount}
            srsData={srsData}
            recordAnswer={recordAnswer}
            recordPractice={recordPractice}
          />
        )}

        {currentScreen === "review" && (
          <ReviewList
            vocabulary={vocabulary}
            wrongWords={wrongWords}
            setWrongWords={setWrongWords}
            onBackToDashboard={goBack}
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
            onBackToDashboard={goBack}
            onOpenGrammar={openGrammarTopic}
          />
        )}

        {currentScreen === "reading" && (
          <Reading
            stats={stats}
            setStats={setStats}
            onBackToDashboard={goBack}
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
            onBackToDashboard={goBack}
            updateRankingScore={updateRankingScore}
          />
        )}

        {currentScreen === "grammar" && (
          <Grammar
            vocabulary={vocabulary}
            onBackToDashboard={goBack}
            initialTopicId={grammarTopicId}
            onOpenTopicChange={id => replaceParam("grammar", id)}
          />
        )}

        {currentScreen === "verb_forms" && (
          <VerbFormsScreen
            vocabulary={vocabulary}
            onBackToDashboard={goBack}
          />
        )}

        {currentScreen === "diary" && (
          <AIDiary
            vocabulary={vocabulary}
            solvedHistory={solvedHistory}
            srsData={srsData}
            setSolvedHistory={setSolvedHistory}
            onBackToDashboard={goBack}
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
                  onClick={handleLeaveQuiz}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-8 py-3 rounded-2xl shadow transition cursor-pointer text-sm"
                >
                  戻る
                </button>
              </div>
            </div>
          )
        )}

        {currentScreen === "settings" && (
          <DataBackup
            dailyGoal={dailyGoal}
            setDailyGoal={setDailyGoal}
            onBackToDashboard={goBack}
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
            onBackToDashboard={goBack}
          />
        )}

        {currentScreen === "privacy" && (
          <PrivacyPolicy onBack={goBack} />
        )}

        {currentScreen === "background" && (
          <BackgroundSettings
            image={bgImage}
            onChange={setBgImage}
            veil={bgVeil}
            onVeilChange={changeBgVeil}
            glass={glass}
            onGlassChange={changeGlass}
            onBack={goBack}
          />
        )}

        {currentScreen === "about" && (
          <AboutApp onBack={goBack} />
        )}

        {currentScreen === "terms" && (
          <TermsOfService onBack={goBack} />
        )}
        </Suspense>
      </main>

      {/* 広告枠（全コンテンツの下・控えめに1枠。未設定時は非表示） */}
      <AdBanner />

      {/* 画面下のタブの高さぶんの空き。main の下に広告があるので、main の余白だけでは
          広告がタブの下に隠れる（広告の上にタブが重なると、誤タップも招く） */}
      {activeTab && <div aria-hidden="true" className="shrink-0 h-[calc(4.5rem+env(safe-area-inset-bottom))]" />}

      {/* 画面下のタブ。フッターにあったアプリの説明・規約は「メニュー」に移した */}
      {activeTab && (
        <TabBar
          active={activeTab}
          onSelect={tab => {
            setSrsSessionWords([]);
            setWrongSessionWords([]);
            setReviewFormat(null);
            navigate(TAB_SCREENS[tab]);
          }}
          dueCount={dueWords.length}
          bonusClaimable={bonusClaimable}
        />
      )}
    </div>
  );
}
