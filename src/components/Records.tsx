import React, { useState, useRef } from "react";
import { Trophy, Calendar, Sparkles, RotateCcw, Loader2, ThumbsUp } from "lucide-react";
import { Word, UserStats, RankingUser } from "../types";
import SimpleMarkdown from "./SimpleMarkdown";
import { todayStr, SrsState } from "../srs";
import { playChime } from "../sound";
import { getWordPos } from "../pos";
import StudyCalendar from "./StudyCalendar";
import { AdviceIcon, WeaknessIcon } from "./AppIcons";
import { ACCENT_TONE, TONE_STYLE } from "../levelTheme";
import { levelCounts } from "../studySettings";
import { SolvedHistory } from "../mastery";

interface WeaknessStat {
  label: string;
  count: number;
  percentage: number;
}

interface WeaknessAnalysis {
  summary: string;
  partOfSpeechStats: WeaknessStat[];
  topicStats: WeaknessStat[];
  recommendations: string[];
  isFallback?: boolean;
}

interface RecordsProps {
  stats: UserStats;
  setStats: React.Dispatch<React.SetStateAction<UserStats>>;
  vocabulary: Word[];
  solvedHistory: SolvedHistory;
  srsData: Record<string, SrsState>;
  wrongWords: string[];
  ranking: RankingUser[];
  setRanking: React.Dispatch<React.SetStateAction<RankingUser[]>>;
  dailyLog: Record<string, { count: number; correct: number }>;
  dailyGoal: number;
  equipped: { avatar?: string; title?: string };
  onOpenGachaShop: () => void;
}

/**
 * 記録の画面（画面下のタブの「記録」）。
 *
 * ダッシュボードの「記録」「ログインボーナス」「AIアドバイス」の3つのタブに
 * 分かれていたものを1枚にまとめた。毎日押すログインボーナスを先頭に置く。
 */
export default function Records({
  stats,
  setStats,
  vocabulary,
  solvedHistory,
  srsData,
  wrongWords,
  ranking,
  setRanking,
  dailyLog,
  dailyGoal,
  equipped,
  onOpenGachaShop
}: RecordsProps) {
  const [advice, setAdvice] = useState<string>("");
  // AIが書いたのか、アプリが学習記録から組み立てたのか。
  // 出どころを伏せると、固定文をAIの分析だと誤解させることになる
  const [adviceSource, setAdviceSource] = useState<"ai" | "local" | null>(null);
  const [isFetchingAdvice, setIsFetchingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState("");

  const [weaknessAnalysis, setWeaknessAnalysis] = useState<WeaknessAnalysis | null>(null);
  const [isFetchingWeakness, setIsFetchingWeakness] = useState(false);
  const [weaknessError, setWeaknessError] = useState("");

  const juniorStats = levelCounts(vocabulary, "junior", solvedHistory, srsData);
  const seniorStats = levelCounts(vocabulary, "senior", solvedHistory, srsData);
  const senior2Stats = levelCounts(vocabulary, "senior2", solvedHistory, srsData);
  const senior3Stats = levelCounts(vocabulary, "senior3", solvedHistory, srsData);
  const advancedStats = levelCounts(vocabulary, "advanced", solvedHistory, srsData);

  // デイリーログインボーナスの定義
  const bonusDays = Array.from({ length: 7 }, (_, i) => ({
    day: i + 1,
    points: (i + 1) * 100 + (i === 6 ? 500 : 0) // 最終日はスペシャル
  }));

  // 今日ログイン可能か判定
  const checkCanClaimToday = () => {
    return stats.lastLoginDate !== todayStr();
  };

  /**
   * 受け取りの二重実行よけ。
   *
   * checkCanClaimToday() は描画時点の stats を見るので、
   * 素早く2回押すと（React が再描画する前に）どちらも通ってしまう。
   * 実際、3連打すると受け取りの処理が3回走ってお知らせも3つ出ていた。
   * 加算が二重にならなかったのは newScore を絶対値で書いていたためで、
   * 関数形（prev.score + points）に直した瞬間に二重加算になる書き方だった。
   */
  const claimingRef = useRef(false);

  const handleClaimLoginBonus = () => {
    if (claimingRef.current || !checkCanClaimToday()) return;
    claimingRef.current = true;

    playChime("bonus");
    const today = todayStr();

    // スコア追加
    const rawIndex = stats.currentStreak % 7;
    const points = bonusDays[rawIndex].points;
    const nextStreak = (stats.lastLoginDate === getYesterdayString()) ? stats.currentStreak + 1 : 1;

    // 加算は関数形で行い、すでに今日受け取っていれば何もしない。
    // 別の経路（別タブなど）から更新されていても二重に足さない
    setStats(prev => (
      prev.lastLoginDate === today
        ? prev
        : { ...prev, score: prev.score + points, currentStreak: nextStreak, lastLoginDate: today }
    ));

    // ランキングの更新
    setRanking(prev => {
      const updated = prev.map(u => u.isMe ? { ...u, score: u.score + points } : u);
      return updated.sort((a, b) => b.score - a.score);
    });

    alert(`ログインボーナス獲得！\n【+${points} P】を獲得しました！連続ログイン ${nextStreak}日目！ 🎉`);
  };

  const getYesterdayString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return todayStr(d);
  };

  // AIアドバイスの取得
  const handleFetchAdvice = async () => {
    setIsFetchingAdvice(true);
    setAdviceError("");
    try {
       const response = await fetch("/api/gemini/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          juniorStats: { correct: juniorStats.correct, total: juniorStats.total, rate: juniorStats.masterRate },
          seniorStats: { correct: seniorStats.correct, total: seniorStats.total, rate: seniorStats.masterRate },
          senior2Stats: { correct: senior2Stats.correct, total: senior2Stats.total, rate: senior2Stats.masterRate },
          senior3Stats: { correct: senior3Stats.correct, total: senior3Stats.total, rate: senior3Stats.masterRate },
          advancedStats: { correct: advancedStats.correct, total: advancedStats.total, rate: advancedStats.masterRate },
          wrongWordsCount: wrongWords.length
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "アドバイスの取得に失敗しました。");
      }
      // SimpleMarkdown は text.split() を呼ぶため、文字列でないと描画時に例外になる
      if (typeof data.advice !== "string") {
        throw new Error("AIの応答を解釈できませんでした。もう一度お試しください。");
      }
      setAdvice(data.advice);
      setAdviceSource(data.source === "ai" ? "ai" : "local");
      playChime("bonus");
    } catch (err: any) {
      console.error(err);
      // 再分析に失敗したときに前回の結果を残すと、更新されていない古い文章に
      // 「Gemini AI が生成しました」の札が付いたまま見えてしまう
      setAdvice("");
      setAdviceSource(null);
      setAdviceError(err.message || "AIアドバイスの作成に失敗しました。");
    } finally {
      setIsFetchingAdvice(false);
    }
  };

  // 弱点分野の自動分析（間違えた単語の傾向をAIが分析）
  const handleFetchWeaknessAnalysis = async () => {
    setIsFetchingWeakness(true);
    setWeaknessError("");
    try {
      const targetWords = wrongWords
        .map(id => vocabulary.find(w => w.id === id))
        .filter((w): w is Word => !!w)
        .map(w => ({ word: w.word, translation: w.translation, level: w.level, pos: getWordPos(w) }));

      if (targetWords.length === 0) {
        throw new Error("まだ間違えた単語が記録されていません。クイズに挑戦して苦手単語を集めましょう。");
      }

      const response = await fetch("/api/gemini/weakness-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wrongWords: targetWords })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "弱点分析の取得に失敗しました。");
      }
      // 描画側は partOfSpeechStats / topicStats / recommendations を無条件に map するため、
      // AIの応答がスキーマ通りでないと描画中に例外が投げられ、画面が失われる。
      // 足りない配列は空配列で補い、描画が壊れないようにする。
      const toStats = (v: any): WeaknessStat[] =>
        Array.isArray(v) ? v.filter(s => s && typeof s === "object") : [];
      setWeaknessAnalysis({
        summary: typeof data?.summary === "string" ? data.summary : "",
        partOfSpeechStats: toStats(data?.partOfSpeechStats),
        topicStats: toStats(data?.topicStats),
        // 文字列以外が混ざると React が「Objects are not valid as a React child」で落ちる
        recommendations: Array.isArray(data?.recommendations)
          ? data.recommendations.filter((r: any) => typeof r === "string")
          : [],
        isFallback: !!data?.isFallback
      });
      playChime("bonus");
    } catch (err: any) {
      console.error(err);
      // 前回の結果を残さない。残すと、更新されていない分析に
      // 出どころの札（AIが分析／アプリが組み立て）が付いたまま見える
      setWeaknessAnalysis(null);
      setWeaknessError(err.message || "弱点分析の作成に失敗しました。");
    } finally {
      setIsFetchingWeakness(false);
    }
  };

  return (
    <div className="space-y-5" id="records_page">
      <h1 className="text-xl font-black text-gray-900 dark:text-slate-100 px-1">記録</h1>

        <div className="bg-white border border-gray-100 dark:border-slate-800 rounded-2xl p-5" id="bonus_section">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <span className="p-1.5 bg-emerald-100 rounded-xl text-emerald-700">
              <Calendar className="w-4 h-4" />
            </span>
            ログインボーナス
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            1日に1回、光っているスタンプを押すと受け取れます。7日続けると、最後の日は特別に多くもらえます。
          </p>

          <div className="mt-5 grid grid-cols-4 sm:grid-cols-7 gap-2">
            {bonusDays.map((bonus, idx) => {
              // 過去に受け取った日、もしくは本日の進捗
              const isClaimedToday = !checkCanClaimToday();
              const claimedCount = isClaimedToday 
                ? ((stats.currentStreak - 1) % 7) + 1 
                : stats.currentStreak % 7;
              
              // どのスタンプが現在マークされているか
              let status: "claimed" | "active" | "locked" = "locked";
              if (idx < claimedCount) {
                status = "claimed";
              } else if (idx === claimedCount && !isClaimedToday) {
                status = "active";
              }

              // 受け取りは今日ぶんの日付を押して行う。別に「受け取る」ボタンを
              // 置いていたが、押す先が2つあると同じ操作の入口が分かれるため外した。
              // 受け取り済みの日と、まだ先の日は押しても何も起きないので、
              // ボタンにせず今までどおりの枠のままにする
              const isClaimable = status === "active";
              const cardClass = `border rounded-2xl px-1 py-3 flex flex-col items-center text-center transition-all ${
                status === "claimed"
                  ? "bg-emerald-50 border-emerald-200"
                  : status === "active"
                    ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-md scale-102 hover:bg-indigo-100 cursor-pointer"
                    : "bg-gray-50 border-gray-100 opacity-60"
              }`;
              const inner = (
                <>
                  <span className="text-xs text-gray-600 font-bold">DAY {bonus.day}</span>
                  <div className="my-2 text-2xl">
                    {status === "claimed" ? "🎁" : idx === 6 ? "👑" : "💎"}
                  </div>
                  <span className={`text-[11px] font-black font-mono tracking-tight ${status === "claimed" ? "text-emerald-700" : "text-gray-700"}`}>
                    {status === "claimed" ? "受取済" : `+${bonus.points} P`}
                  </span>
                </>
              );

              return isClaimable ? (
                <button
                  key={bonus.day}
                  type="button"
                  onClick={handleClaimLoginBonus}
                  className={cardClass}
                  id={`btn_claim_bonus_day_${bonus.day}`}
                  aria-label={`DAY ${bonus.day} のログインボーナス ${bonus.points} ポイントを受け取る`}
                >
                  {inner}
                </button>
              ) : (
                <div key={bonus.day} className={cardClass}>
                  {inner}
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-center">
            {checkCanClaimToday() ? (
              /* 押す先はスタンプだけなので、どれを押すのかをここで言葉にする。
                 光っているだけでは「押せる」ことが伝わらない */
              <div
                className="bg-indigo-50 rounded-2xl p-4 text-center border font-semibold border-indigo-200 text-indigo-700 inline-flex items-center gap-2 text-sm"
                id="claim_bonus_hint"
              >
                <Sparkles className="w-5 h-5 animate-pulse" />
                <span>光っているスタンプを押すと、本日のボーナスを受け取れます。</span>
              </div>
            ) : (
              <div className="bg-gray-100 rounded-2xl p-4 text-center border font-semibold border-gray-200 text-gray-500 inline-flex items-center gap-2 text-sm">
                <ThumbsUp className="w-5 h-5 text-emerald-500" />
                <span>本日のログインボーナスはすべて獲得済みです。明日また来てね！</span>
              </div>
            )}
          </div>

          {/* 学習カレンダー（日別解答数のヒートマップ）。
              毎日開くログインボーナスと並べて、続けた日が見えるようにする。
              「習熟度 & クイズ」に常時置いていたときは縦に443pxあり、
              その下の出題の入口を押し下げていた */}
          <div className="mt-8 pt-6 border-t border-gray-100" data-testid="calendar_in_bonus">
            <StudyCalendar dailyLog={dailyLog} dailyGoal={dailyGoal} />
          </div>
        </div>

        <div className="bg-white border border-gray-100 dark:border-slate-800 rounded-2xl p-5" id="ranking_section">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <span className="p-1.5 bg-amber-100 rounded-xl text-amber-700">
                <Trophy className="w-4 h-4 fill-amber-200" />
                </span>
                自分の記録
              </h2>
              <p className="text-sm text-gray-500 mt-1 max-w-md">
                クイズの回答やAI単語の追加でスコアが増えます。過去の自分を超え続けることが一番の上達への近道です。
              </p>
            </div>
            <button
              onClick={onOpenGachaShop}
              className="bg-gradient-to-r from-violet-600 to-indigo-700 hover:opacity-90 text-white font-bold text-xs px-4 py-3 rounded-xl shadow transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              id="btn_open_gacha_from_ranking"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>貯めたポイントでガチャを引く</span>
            </button>
          </div>

          {/* 自己ベスト・累計スタッツパネル */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3" id="self_records_panel">
            <div className="bg-amber-50/70 border border-amber-150 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-amber-700 font-black tracking-wider uppercase block">総スコア</span>
              <p className="text-2xl font-black text-amber-800 font-mono mt-1">{stats.score}<span className="text-xs text-amber-700 ml-0.5">P</span></p>
            </div>
            <div className="bg-emerald-50/70 border border-emerald-150 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-emerald-700 font-black tracking-wider uppercase block">連続ログイン</span>
              <p className="text-2xl font-black text-emerald-800 font-mono mt-1">{stats.currentStreak}<span className="text-xs text-emerald-700 ml-0.5">日</span></p>
            </div>
            <div className="bg-indigo-50/70 border border-indigo-150 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-indigo-600 font-black tracking-wider uppercase block">累計回答数</span>
              <p className="text-2xl font-black text-indigo-800 font-mono mt-1">{stats.completedQuestions}<span className="text-xs text-indigo-700 ml-0.5">問</span></p>
            </div>
            <div className="bg-rose-50/70 border border-rose-150 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-rose-700 font-black tracking-wider uppercase block">累計正答率</span>
              <p className="text-2xl font-black text-rose-800 font-mono mt-1">
                {stats.completedQuestions > 0 ? Math.round((stats.correctAnswers / stats.completedQuestions) * 100) : 0}<span className="text-xs text-rose-700 ml-0.5">%</span>
              </p>
            </div>
          </div>

          {/* 仮想ライバル（CPU）との比較 */}
          <div className="mt-8">
            <h3 className="text-sm font-extrabold text-gray-700">仮想ライバル（CPU）とのスコア比較</h3>
            <p className="text-xs text-gray-400 mt-1">
              ※ 以下は実在のユーザーではなく、練習用に用意された架空のCPUライバルです。目標スコアの目安としてご活用ください。
            </p>
          </div>

          <div className="mt-4 border border-gray-150 rounded-2xl divide-y divide-gray-100 overflow-hidden shadow-inner">
            {ranking.map((user, idx) => {
              const place = idx + 1;
              const isMe = user.isMe;
              
              // 順位に応じたメダル
              let badge = null;
              if (place === 1) badge = <span className="text-lg">🥇</span>;
              else if (place === 2) badge = <span className="text-lg">🥈</span>;
              else if (place === 3) badge = <span className="text-lg">🥉</span>;
              else badge = <span className="text-sm font-semibold font-mono text-gray-400">{place}</span>;

              return (
                <div 
                  key={user.id} 
                  className={`flex items-center justify-between p-4 transition-all ${
                    isMe ? "bg-amber-50/70 py-5 border-y border-amber-200/50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 flex justify-center items-center">
                      {badge}
                    </div>
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 bg-white flex items-center justify-center text-xl shadow-sm">
                      {isMe && equipped.avatar ? equipped.avatar : user.avatar}
                    </div>
                    <div>
                      <h4 className={`text-sm tracking-tight ${isMe ? "font-black text-amber-900" : "font-bold text-gray-800"}`}>
                        {user.name} {isMe ? <span className="bg-amber-100 text-amber-700 text-[10px] py-0.5 px-2 rounded-full font-bold ml-1 font-sans">YOU</span> : <span className="bg-gray-100 text-gray-600 text-[10px] py-0.5 px-2 rounded-full font-bold ml-1 font-sans">CPU</span>}
                      </h4>
                      <p className="text-xs text-gray-400 font-medium">
                        {isMe && equipped.title ? (
                          <span className="text-indigo-600 font-bold">🏷️ {equipped.title}</span>
                        ) : isMe ? "あなたの現在位置" : "仮想ライバル"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-mono text-gray-800 tracking-tight">{user.score}</span>
                    <span className="text-[10px] text-gray-400 font-bold ml-0.5">P</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-gray-100 dark:border-slate-800 rounded-2xl p-5" id="ai_advisor_section">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <span className={`p-1.5 rounded-xl ${ACCENT_TONE.advice} ${TONE_STYLE.badge}`}>
            <AdviceIcon className="w-4 h-4" />
            </span>
            AIの学習アドバイス
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            あなたの回答履歴（レベル別の習得率、まだ手を付けていないレベル、間違えた単語の数）を分析して、
            次に取り組むレベルと具体的な進め方を示します。押すたびに最新の記録で分析し直します。
          </p>

          <div className="mt-6 border-t border-gray-100 pt-6">
            {advice ? (
              <div className="space-y-4">
                <div className={`${ACCENT_TONE.advice} bg-[var(--lv-bg)] border border-[var(--lv-border)] rounded-2xl p-5 text-gray-800 text-sm leading-relaxed max-w-none`}>
                  <SimpleMarkdown text={advice} />
                </div>
                {adviceSource && (
                  <p className="text-[11px] font-bold text-gray-400" id="advice_source">
                    {adviceSource === "ai"
                      ? "Gemini AI が生成しました。"
                      : "AIキーが未設定のため、アプリが学習記録から組み立てました。"}
                  </p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleFetchAdvice}
                    disabled={isFetchingAdvice}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    {isFetchingAdvice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>最新の回答進捗で再分析</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <AdviceIcon className={`w-12 h-12 mx-auto mb-3 ${ACCENT_TONE.advice} ${TONE_STYLE.text}`} />
                <p className="text-gray-600 font-extrabold mb-1">あなたの回答傾向をAIが分析します</p>
                <p className="text-xs text-gray-400 mb-5 max-w-xs mx-auto">
                  スタッツ、弱点、学習履歴をもとに最適化された効率的コーチングアドバイスを受け取りましょう。
                </p>
                <button
                  onClick={handleFetchAdvice}
                  disabled={isFetchingAdvice}
                  className={`${ACCENT_TONE.advice} ${TONE_STYLE.solid} font-bold px-6 py-3 rounded-xl transition shadow hover:shadow-md inline-flex items-center gap-2 cursor-pointer text-sm`}
                  id="btn_get_advice"
                >
                  {isFetchingAdvice ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>進捗データを分析中...</span>
                    </>
                  ) : (
                    <>
                      <AdviceIcon className="w-4 h-4" />
                      <span>AIアドバイスを受け取る</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {adviceError && (
              <p className="text-sm text-rose-500 font-medium mt-3 bg-rose-50 border border-rose-100 rounded-lg p-3">
                {adviceError}
              </p>
            )}
          </div>

          {/* 弱点分野の自動分析セクション */}
          <div className="mt-8 border-t border-gray-100 pt-6" id="weakness_analysis_section">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <span className={`p-1.5 rounded-xl ${ACCENT_TONE.weakness} ${TONE_STYLE.badge}`}>
              <WeaknessIcon className="w-4 h-4" />
              </span>
              弱点分野の分析
            </h2>
            <p className="text-sm text-gray-500 mt-1 max-w-xl">
              「間違えた単語の復習」に溜まった単語から、あなたが苦手とする領域とその克服アドバイスを出します。
              Gemini APIキーがあるときは AI が分析し、無いときはアプリが品詞を数えて組み立てます（結果に出どころを書きます）。
            </p>

            <div className="mt-6">
              {weaknessAnalysis ? (
                <div className="space-y-5">
                  <div className={`${ACCENT_TONE.weakness} bg-[var(--lv-bg)] border border-[var(--lv-border)] rounded-2xl p-5`}>
                    <p className="text-sm text-gray-800 leading-relaxed font-semibold">
                      {weaknessAnalysis.summary}
                    </p>
                  </div>
                  {/* 出どころを書く。AIキーが無いときは品詞を数えただけの集計なので、
                      AIの分析として読まれると内容を過大に受け取らせてしまう */}
                  <p className="text-[11px] font-bold text-gray-400" id="weakness_source">
                    {weaknessAnalysis.isFallback
                      ? "AIキーが未設定のため、アプリが間違えた単語の品詞を数えて組み立てました。"
                      : "Gemini AI が分析しました。"}
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                      <h3 className="text-xs font-black text-gray-500 uppercase tracking-wide mb-3">品詞別の傾向</h3>
                      <div className="space-y-2.5">
                        {weaknessAnalysis.partOfSpeechStats.map((stat, i) => (
                          <div key={i}>
                            <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                              <span>{stat.label}</span>
                              <span className="font-mono">{stat.count}語 ({stat.percentage}%)</span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${ACCENT_TONE.weakness} ${TONE_STYLE.bar}`}
                                style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                      <h3 className="text-xs font-black text-gray-500 uppercase tracking-wide mb-3">分野・テーマ別の傾向</h3>
                      <div className="space-y-2.5">
                        {weaknessAnalysis.topicStats.map((stat, i) => (
                          <div key={i}>
                            <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                              <span>{stat.label}</span>
                              <span className="font-mono">{stat.count}語 ({stat.percentage}%)</span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${ACCENT_TONE.advice} ${TONE_STYLE.bar}`}
                                style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-2xl p-4">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-wide mb-3">克服のための学習アドバイス</h3>
                    <ul className="space-y-1.5">
                      {weaknessAnalysis.recommendations.map((rec, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <ThumbsUp className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${ACCENT_TONE.weakness} ${TONE_STYLE.text}`} />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleFetchWeaknessAnalysis}
                      disabled={isFetchingWeakness}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      {isFetchingWeakness ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      <span>最新の間違えた単語で再分析</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <WeaknessIcon className={`w-12 h-12 mx-auto mb-3 ${ACCENT_TONE.weakness} ${TONE_STYLE.text}`} />
                  <p className="text-gray-600 font-extrabold mb-1">間違えた単語の傾向を分析します</p>
                  <p className="text-xs text-gray-400 mb-5 max-w-xs mx-auto">
                    現在 <span className="font-mono font-bold">{wrongWords.length}語</span> の間違えた単語が記録されています。品詞や分野の傾向から、あなたの弱点分野を見つけます。
                  </p>
                  <button
                    onClick={handleFetchWeaknessAnalysis}
                    disabled={isFetchingWeakness}
                    className={`${ACCENT_TONE.weakness} ${TONE_STYLE.solid} font-bold px-6 py-3 rounded-xl transition shadow hover:shadow-md inline-flex items-center gap-2 cursor-pointer text-sm`}
                    id="btn_get_weakness_analysis"
                  >
                    {isFetchingWeakness ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>間違えた単語を分析中...</span>
                      </>
                    ) : (
                      <>
                        <WeaknessIcon className="w-4 h-4" />
                        <span>弱点分野を分析する</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {weaknessError && (
                <p className="text-sm text-rose-500 font-medium mt-3 bg-rose-50 border border-rose-100 rounded-lg p-3">
                  {weaknessError}
                </p>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
