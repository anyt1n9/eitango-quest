import React, { useState, useRef } from "react";
import { Check, Crown, Gift, Sparkles, RotateCcw, Loader2, ThumbsUp } from "lucide-react";
import { Word, UserStats, RankingUser } from "../types";
import SimpleMarkdown from "./SimpleMarkdown";
import { SrsState } from "../srs";
import { LOGIN_BONUS_DAYS, loginBonusState } from "../loginBonus";
import { playChime } from "../sound";
import { getWordPos } from "../pos";
import StudyCalendar from "./StudyCalendar";
import { AdviceIcon, WeaknessIcon } from "./AppIcons";
import { ACCENT_TONE, TONE_STYLE } from "../levelTheme";
import { levelCounts } from "../studySettings";
import { SolvedHistory } from "../mastery";
import { readJsonResponse } from "../apiClient";
import { notify } from "../notice";
import OceanDepthCard, { type OceanDepthInfo } from "./OceanDepthCard";

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
  /** 海の深さ（海の3D背景を使っていなければ null で、欄を出さない） */
  ocean?: OceanDepthInfo | null;
  onOpenBackground?: () => void;
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
  onOpenGachaShop,
  ocean = null,
  onOpenBackground = () => {}
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

  // デイリーログインボーナス（7日で1周。最終日はスペシャル）。
  // スタンプの表示と受け取りは、同じ「いまの連続日数」から決める（src/loginBonus.ts）
  const bonusDays = LOGIN_BONUS_DAYS;
  const bonusState = loginBonusState(stats);

  // 今日ログイン可能か判定
  const checkCanClaimToday = () => bonusState.canClaim;

  /**
   * 受け取りの二重実行よけ。
   *
   * checkCanClaimToday() は描画時点の stats を見るので、
   * 素早く2回押すと（React が再描画する前に）どちらも通ってしまう。
   * 実際、3連打すると受け取りの処理が3回走ってお知らせも3つ出ていた。
   * 加算が二重にならなかったのは newScore を絶対値で書いていたためで、
   * 関数形（prev.score + points）に直した瞬間に二重加算になる書き方だった。
   *
   * 印は「受け取りの処理中か」ではなく「どの日のぶんを受け取ったか」で持つ。
   * true / false の印を立てたままにしていたときは、画面を開いたまま日をまたぐと
   * 翌日のスタンプを押しても何も起きなかった（別の画面へ移るまで受け取れない。#131）。
   * 日付で持てば、日が変わったときに自然に外れる。
   */
  const claimedDayRef = useRef<string | null>(null);

  const handleClaimLoginBonus = () => {
    const { today, points, nextStreak } = bonusState;
    if (claimedDayRef.current === today || !checkCanClaimToday()) return;
    claimedDayRef.current = today;

    playChime("bonus");

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

    notify(`ログインボーナス ${nextStreak}日目：+${points} P を受け取りました。`, "success");
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

      const data = await readJsonResponse(response);
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

      const data = await readJsonResponse(response);
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

  const correctRate = stats.completedQuestions > 0
    ? Math.round((stats.correctAnswers / stats.completedQuestions) * 100)
    : 0;
  const canClaim = checkCanClaimToday();

  return (
    <div className="space-y-4" id="records_page">
      {/* カードの外の見出しは、背景の飾りに紛れないよう地の色を不透明で敷く */}
      <h1 className="text-2xl font-bold text-gray-900 px-4 py-3 rounded-2xl bg-slate-50">記録</h1>

      {/* 自分の記録。色の箱を4つ並べると、どれも同じ強さで目を引こうとして落ち着かないので、
          1枚のカードに細い線で区切って並べる */}
      <dl
        className="glass-panel bg-white border border-gray-200 rounded-2xl py-4 grid grid-cols-4 divide-x divide-gray-200 text-center"
        id="self_records_panel"
      >
        <div className="px-1 flex flex-col-reverse">
          <dt className="text-xs text-gray-500">総スコア</dt>
          <dd className="mb-0.5 text-xl font-bold text-gray-900 tabular-nums">{stats.score.toLocaleString()}<span className="text-xs font-medium text-gray-500 ml-0.5">P</span></dd>
        </div>
        <div className="px-1 flex flex-col-reverse">
          <dt className="text-xs text-gray-500">連続ログイン</dt>
          <dd className="mb-0.5 text-xl font-bold text-gray-900 tabular-nums">{bonusState.streak}<span className="text-xs font-medium text-gray-500 ml-0.5">日</span></dd>
        </div>
        <div className="px-1 flex flex-col-reverse">
          <dt className="text-xs text-gray-500">累計回答数</dt>
          <dd className="mb-0.5 text-xl font-bold text-gray-900 tabular-nums">{stats.completedQuestions.toLocaleString()}<span className="text-xs font-medium text-gray-500 ml-0.5">問</span></dd>
        </div>
        <div className="px-1 flex flex-col-reverse">
          <dt className="text-xs text-gray-500">累計正答率</dt>
          <dd className="mb-0.5 text-xl font-bold text-gray-900 tabular-nums">{correctRate}<span className="text-xs font-medium text-gray-500 ml-0.5">%</span></dd>
        </div>
      </dl>

        <section className="glass-panel bg-white border border-gray-200 rounded-2xl p-5" id="bonus_section" aria-labelledby="bonus_heading">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="bonus_heading" className="text-base font-bold text-gray-900">ログインボーナス</h2>
            <span className="text-sm text-gray-500 tabular-nums">7日で1周</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            1日に1回、今日の日を押すと受け取れます。7日続けると、最後の日は特別に多くもらえます。
          </p>

          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {bonusDays.map((bonus, idx) => {
              const claimedCount = bonusState.stampsClaimed;
              let status: "claimed" | "active" | "locked" = "locked";
              if (idx < claimedCount) {
                status = "claimed";
              } else if (idx === claimedCount && canClaim) {
                status = "active";
              }

              // 受け取りは今日ぶんの日付を押して行う。別に「受け取る」ボタンを
              // 置いていたが、押す先が2つあると同じ操作の入口が分かれるため外した。
              // 受け取り済みの日と、まだ先の日は押しても何も起きないので、
              // ボタンにせず枠のままにする。絵文字（💎👑🎁）は端末ごとに絵柄が違い、
              // ほかの線画と並ぶと浮くので使わない
              const isClaimable = status === "active";
              const Icon = status === "claimed" ? Check : idx === 6 ? Crown : Gift;
              const cardClass = `min-h-20 rounded-xl border px-0.5 py-2 flex flex-col items-center justify-center gap-1 text-center transition ${
                status === "claimed"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : status === "active"
                    ? "bg-indigo-50 border-indigo-600 border-2 text-indigo-800 hover:bg-indigo-100 cursor-pointer"
                    : "bg-white border-gray-200 text-gray-500"
              }`;
              const inner = (
                <>
                  <span className="text-xs font-medium">{bonus.day}日目</span>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  <span className="text-xs font-bold tabular-nums">
                    {status === "claimed" ? "済" : `+${bonus.points}`}
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
                  aria-label={`${bonus.day}日目のログインボーナス ${bonus.points} ポイントを受け取る`}
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

          {canClaim ? (
            /* 押す先は日付の枠だけなので、どれを押すのかをここで言葉にする。
               色が変わっているだけでは「押せる」ことが伝わらない */
            <p className="mt-3 text-sm text-indigo-800 font-medium flex items-center gap-1.5" id="claim_bonus_hint">
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>青い枠の日を押すと、今日のボーナスを受け取れます。</span>
            </p>
          ) : (
            <p className="mt-3 text-sm text-gray-600 flex items-center gap-1.5">
              <Check className="w-4 h-4 shrink-0 text-emerald-700" aria-hidden="true" />
              <span>本日のログインボーナスはすべて獲得済みです。明日また来てね！</span>
            </p>
          )}

          {/* 学習カレンダー（日別解答数のヒートマップ）。
              毎日開くログインボーナスと並べて、続けた日が見えるようにする。
              「習熟度 & クイズ」に常時置いていたときは縦に443pxあり、
              その下の出題の入口を押し下げていた */}
          <div className="mt-5 pt-5 border-t border-gray-200" data-testid="calendar_in_bonus">
            <StudyCalendar dailyLog={dailyLog} dailyGoal={dailyGoal} />
          </div>
        </section>

        {ocean && <OceanDepthCard info={ocean} onOpenBackground={onOpenBackground} />}

        <section className="glass-panel bg-white border border-gray-200 rounded-2xl p-5" id="ranking_section" aria-labelledby="ranking_heading">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 id="ranking_heading" className="text-base font-bold text-gray-900">ライバルとの比較</h2>
              <p className="text-sm text-gray-500 mt-1">
                実在の人ではなく、目標の目安として用意した練習用のライバルです。クイズに答えるとスコアが増えます。
              </p>
            </div>
            <button
              onClick={onOpenGachaShop}
              className="min-h-11 px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 font-bold text-sm transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              id="btn_open_gacha_from_ranking"
            >
              <Sparkles className="w-4 h-4 text-gray-500" aria-hidden="true" />
              <span>ポイントでガチャを引く</span>
            </button>
          </div>

          <ol className="mt-4 divide-y divide-gray-200 border-y border-gray-200">
            {ranking.map((user, idx) => {
              const place = idx + 1;
              const isMe = user.isMe;
              return (
                <li
                  key={user.id}
                  className={`flex items-center justify-between gap-3 py-3 px-1 ${isMe ? "bg-indigo-50/60" : ""}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 text-center text-sm font-bold tabular-nums text-gray-500 shrink-0">{place}</span>
                    <span className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-lg shrink-0" aria-hidden="true">
                      {isMe && equipped.avatar ? equipped.avatar : user.avatar}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {user.name}
                        <span className={`ml-1.5 text-xs font-medium ${isMe ? "text-indigo-800" : "text-gray-500"}`}>
                          {isMe ? "あなた" : "練習用"}
                        </span>
                      </p>
                      {isMe && equipped.title && (
                        <p className="text-xs text-gray-500 truncate">称号：{equipped.title}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-base font-bold tabular-nums text-gray-900 shrink-0">
                    {user.score.toLocaleString()}<span className="text-xs text-gray-500 font-medium ml-0.5">P</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="glass-panel bg-white border border-gray-200 rounded-2xl p-5" id="ai_advisor_section">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
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
                  <p className="text-xs text-gray-500" id="advice_source">
                    {adviceSource === "ai"
                      ? "Gemini AI が生成しました。"
                      : "AIキーが未設定のため、アプリが学習記録から組み立てました。"}
                  </p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleFetchAdvice}
                    disabled={isFetchingAdvice}
                    className="flex items-center gap-1.5 px-4 min-h-11 bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 font-bold text-sm rounded-xl transition cursor-pointer"
                  >
                    {isFetchingAdvice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>最新の回答進捗で再分析</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-gray-300">
                <AdviceIcon className={`w-10 h-10 mx-auto mb-3 ${ACCENT_TONE.advice} ${TONE_STYLE.text}`} />
                <p className="text-gray-600 font-bold mb-1">あなたの回答傾向をAIが分析します</p>
                <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">
                  スタッツ、弱点、学習履歴をもとに最適化された効率的コーチングアドバイスを受け取りましょう。
                </p>
                <button
                  onClick={handleFetchAdvice}
                  disabled={isFetchingAdvice}
                  className={`${ACCENT_TONE.advice} ${TONE_STYLE.soft} border font-bold px-5 min-h-12 rounded-xl transition inline-flex items-center gap-2 cursor-pointer text-sm`}
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
              <p className="text-sm text-rose-800 font-medium mt-3 bg-rose-50 border border-rose-200 rounded-xl p-3" role="alert">
                {adviceError}
              </p>
            )}
          </div>

          {/* 弱点分野の自動分析セクション */}
          <div className="mt-8 border-t border-gray-100 pt-6" id="weakness_analysis_section">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
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
                    <p className="text-sm text-gray-800 leading-relaxed font-medium">
                      {weaknessAnalysis.summary}
                    </p>
                  </div>
                  {/* 出どころを書く。AIキーが無いときは品詞を数えただけの集計なので、
                      AIの分析として読まれると内容を過大に受け取らせてしまう */}
                  <p className="text-xs text-gray-500" id="weakness_source">
                    {weaknessAnalysis.isFallback
                      ? "AIキーが未設定のため、アプリが間違えた単語の品詞を数えて組み立てました。"
                      : "Gemini AI が分析しました。"}
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-gray-200 rounded-xl p-4">
                      <h3 className="text-sm font-bold text-gray-700 mb-3">品詞別の傾向</h3>
                      <div className="space-y-2.5">
                        {weaknessAnalysis.partOfSpeechStats.map((stat, i) => (
                          <div key={i}>
                            <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                              <span>{stat.label}</span>
                              <span className="tabular-nums">{stat.count}語 ({stat.percentage}%)</span>
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

                    <div className="bg-slate-50 border border-gray-200 rounded-xl p-4">
                      <h3 className="text-sm font-bold text-gray-700 mb-3">分野・テーマ別の傾向</h3>
                      <div className="space-y-2.5">
                        {weaknessAnalysis.topicStats.map((stat, i) => (
                          <div key={i}>
                            <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                              <span>{stat.label}</span>
                              <span className="tabular-nums">{stat.count}語 ({stat.percentage}%)</span>
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

                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-gray-700 mb-3">克服のための学習アドバイス</h3>
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
                      className="flex items-center gap-1.5 px-4 min-h-11 bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 font-bold text-sm rounded-xl transition cursor-pointer"
                    >
                      {isFetchingWeakness ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      <span>最新の間違えた単語で再分析</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-gray-300">
                  <WeaknessIcon className={`w-10 h-10 mx-auto mb-3 ${ACCENT_TONE.weakness} ${TONE_STYLE.text}`} />
                  <p className="text-gray-600 font-bold mb-1">間違えた単語の傾向を分析します</p>
                  <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">
                    現在 <span className="tabular-nums font-bold">{wrongWords.length}語</span> の間違えた単語が記録されています。品詞や分野の傾向から、あなたの弱点分野を見つけます。
                  </p>
                  <button
                    onClick={handleFetchWeaknessAnalysis}
                    disabled={isFetchingWeakness}
                    className={`${ACCENT_TONE.weakness} ${TONE_STYLE.soft} border font-bold px-5 min-h-12 rounded-xl transition inline-flex items-center gap-2 cursor-pointer text-sm`}
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
                <p className="text-sm text-rose-800 font-medium mt-3 bg-rose-50 border border-rose-200 rounded-xl p-3" role="alert">
                  {weaknessError}
                </p>
              )}
            </div>
          </div>
        </section>
    </div>
  );
}
