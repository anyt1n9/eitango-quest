import React from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Level, Word } from "../types";
import { SrsState } from "../srs";
import { SolvedHistory } from "../mastery";
import { ListeningIcon, SpellingIcon } from "./AppIcons";
import { LEVEL_TONE, TONE_STYLE, ACCENT_TONE } from "../levelTheme";
import { LEVEL_LABELS, LEVEL_STAGES, LEVEL_ORDER } from "../levelLabels";
import { QUESTION_COUNTS, levelCounts } from "../studySettings";

type QuizType = "word" | "sentence" | "listening" | "spelling" | "reverse" | "synonym" | "sense";

/**
 * 「学習を始める」（一問一答）のほかに選べる形式。
 * 押すとそのまま始まる（以前のように片方だけモーダルを挟まない）。
 */
const OTHER_FORMS: { form: Exclude<QuizType, "word">; label: string; Icon?: (p: { className?: string }) => React.ReactElement }[] = [
  { form: "sentence", label: "例文穴埋め" },
  { form: "listening", label: "リスニング", Icon: ListeningIcon },
  { form: "reverse", label: "日本語→英語" },
  { form: "spelling", label: "綴り", Icon: SpellingIcon }
];

/** 訳を介さずに英語どうしをつなぐ・文の中で意味を決める、の2つ */
const APPLIED_FORMS: { form: "synonym" | "sense"; label: string }[] = [
  { form: "synonym", label: "類義語" },
  { form: "sense", label: "語義を見分ける" }
];

interface DashboardProps {
  vocabulary: Word[];
  solvedHistory: SolvedHistory;
  srsData: Record<string, SrsState>;
  wrongWords: string[];
  onStartQuiz: (level: Level, type: QuizType, count?: number) => void;
  /** 苦手な単語の一覧と復習 */
  onStartReview: () => void;
  /** 今日の復習（忘却曲線）の対象語数 */
  dueCount: number;
  /** 今日の復習を始める */
  onStartSrsReview: () => void;
  /** 1日の目標（問題数） */
  dailyGoal: number;
  /** 今日解いた問題数 */
  todayCount: number;
  /** ログインボーナスをまだ受け取っていないか（App がタブの印と同じ値を渡す） */
  bonusClaimable: boolean;
  /** ログインボーナスを受け取りに「記録」へ */
  onOpenRecords: () => void;
  /**
   * 学習のレベルと1回の問題数。「教材」の画面と共有するので App が持つ
   * （保存できない環境でも、両方の画面に同じものが効くように）
   */
  level: Level;
  onLevelChange: (level: Level) => void;
  questionCount: number;
  onQuestionCountChange: (count: number) => void;
}

/**
 * 「今日」の画面（起動して最初に見える画面）。
 *
 * 以前のダッシュボードは、5つのタブ・学習メニューの折りたたみ・レベルと問題数の選択・
 * 7つの形式のボタン・単語の取り込みを1枚に積んでいて、スマホの最初の1画面に
 * 「一問一答を解く」がほとんど見えなかった（844px中810px付近）。
 * ここには「今日やること」だけを置き、ほかは画面下のタブ（教材・記録など）へ移した。
 *
 *   - 復習が来ている日は、いちばん上に「復習を始める」を出す。塗りつぶしのボタンは
 *     1画面に1つにしたいので、そのあいだ「学習を始める」は枠だけのボタンに下げる
 *   - レベル・問題数・形式は「学習を始める」のすぐそばにまとめる
 */
export default function Dashboard({
  vocabulary,
  solvedHistory,
  srsData,
  wrongWords,
  onStartQuiz,
  onStartReview,
  dueCount,
  onStartSrsReview,
  dailyGoal,
  todayCount,
  bonusClaimable,
  onOpenRecords,
  level: selectedLevel,
  onLevelChange: setSelectedLevel,
  questionCount,
  onQuestionCountChange: setQuestionCount
}: DashboardProps) {
  const current = levelCounts(vocabulary, selectedLevel, solvedHistory, srsData);
  const minutes = QUESTION_COUNTS.find(c => c.count === questionCount)?.minutes ?? "";
  const hasDue = dueCount > 0;
  const goalReached = todayCount >= dailyGoal;
  const tone = LEVEL_TONE[selectedLevel];

  return (
    <div className="space-y-4" id="dashboard_page">
      {/* 見出しはカードの外に出しているので、背景の飾り（葉・波）や写真の上に重なる。
          地の色を敷いて、小さい文字が柄に紛れないようにする。
          半透明にすると、ガラスの検査（下に黒を敷く）で 4.20 まで落ちた */}
      <div className="flex items-start justify-between gap-3 px-3 py-2 rounded-2xl bg-slate-50">
        <div className="min-w-0">
          <p className="text-xs font-black text-indigo-700">今日の学習</p>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5 leading-snug" id="today_headline">
            {hasDue ? `復習のあとに${questionCount}問` : `今日の${questionCount}問を始めましょう`}
          </h1>
          <p className="text-xs text-gray-500 mt-1">短い学習でも、続けるほど定着します。</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-xl font-black ${tone} ${TONE_STYLE.text}`}>{current.masterRate}%</p>
          <p className="text-[11px] text-gray-500">{LEVEL_STAGES[selectedLevel]}・習熟度</p>
        </div>
      </div>

      {hasDue && (
        <section
          aria-labelledby="today_review_heading"
          className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3"
          id="today_review_card"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="today_review_heading" className="text-sm font-black text-gray-900">今日の復習</h2>
            <span className="text-sm font-black text-indigo-700">{dueCount}語</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            期日が来た単語があります。忘れかけたころに解き直すのがいちばん効きます（約{Math.max(1, Math.round(dueCount / 3))}分）。
          </p>
          <button
            type="button"
            onClick={onStartSrsReview}
            id="dashboard_open_srs_review_btn"
            className={`w-full min-h-12 rounded-xl font-black text-sm cursor-pointer transition ${ACCENT_TONE.advice} ${TONE_STYLE.solid}`}
          >
            復習を始める
          </button>
        </section>
      )}

      {/* 学習の設定と開始。ガラスの印（glass-panel / glass-chip）は src/index.css が見る */}
      <section
        aria-label="学習の設定"
        className="glass-panel bg-white border border-gray-100 dark:border-slate-800 rounded-2xl p-4 space-y-4"
        id="level_selection_section"
        data-testid="question_count_picker"
      >
        <div className="space-y-1.5" data-testid="level_picker">
          <label htmlFor="select_study_level" className="block text-xs font-black text-gray-600">学習レベル</label>
          <select
            id="select_study_level"
            value={selectedLevel}
            onChange={e => setSelectedLevel(e.target.value as Level)}
            className="w-full min-h-12 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white text-gray-900 text-sm font-black cursor-pointer"
          >
            {LEVEL_ORDER.map(level => (
              <option key={level} value={level}>
                {LEVEL_LABELS[level]}　習熟度 {levelCounts(vocabulary, level, solvedHistory, srsData).masterRate}%
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-500 px-0.5">
            覚えた {current.correct}語 ／ 全 {current.total}語
          </p>
        </div>

        <div className="space-y-1.5" data-testid="count_picker">
          <span id="count_picker_label" className="block text-xs font-black text-gray-600">1回の問題数</span>
          <div role="group" aria-labelledby="count_picker_label" className="grid grid-cols-3 gap-2">
            {QUESTION_COUNTS.map(item => (
              <button
                key={item.count}
                type="button"
                onClick={() => setQuestionCount(item.count)}
                id={`btn_question_count_${item.count}`}
                aria-pressed={questionCount === item.count}
                className={`min-h-11 rounded-xl text-sm font-black border transition cursor-pointer ${tone} ${
                  questionCount === item.count
                    ? `${TONE_STYLE.solid} glass-chip border-[var(--lv-solid)]`
                    : TONE_STYLE.soft
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onStartQuiz(selectedLevel, "word", questionCount)}
          id={`btn_${selectedLevel}_word`}
          className={`w-full min-h-16 px-5 rounded-2xl flex items-center justify-between gap-3 text-left border transition cursor-pointer ${tone} ${
            hasDue ? TONE_STYLE.soft : `${TONE_STYLE.solid} glass-chip border-[var(--lv-solid)]`
          }`}
        >
          <span className="min-w-0">
            <span className="block text-base font-black">{hasDue ? "新しい単語を学ぶ" : "学習を始める"}</span>
            <span className="block text-xs font-bold mt-0.5">
              {LEVEL_LABELS[selectedLevel]}から{questionCount}問・{minutes}
            </span>
          </span>
          <ArrowRight className="w-5 h-5 shrink-0" aria-hidden="true" />
        </button>

        <div className="space-y-2" data-testid="level_quiz_buttons">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-black text-gray-600" id="other_forms_heading">ほかの出題形式</h2>
            <span className="text-[11px] text-gray-500">選ぶとすぐ始まります</span>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="other_forms_heading">
            {OTHER_FORMS.map(f => (
              <button
                key={f.form}
                type="button"
                onClick={() => onStartQuiz(selectedLevel, f.form, questionCount)}
                id={`btn_${selectedLevel}_${f.form}`}
                className={`min-h-11 px-4 rounded-full border text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${tone} ${TONE_STYLE.soft}`}
              >
                {f.Icon && <f.Icon className="w-4 h-4 shrink-0" />}
                <span>{f.label}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="応用クイズ">
            <span className="text-xs font-black text-gray-600 mr-1">応用</span>
            {APPLIED_FORMS.map(f => (
              <button
                key={f.form}
                type="button"
                onClick={() => onStartQuiz(selectedLevel, f.form, questionCount)}
                id={`btn_${selectedLevel}_${f.form}`}
                className={`min-h-11 px-4 rounded-full border text-xs font-black transition cursor-pointer ${tone} ${TONE_STYLE.soft}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-label="今日の進み具合"
        className="bg-white border border-gray-100 dark:border-slate-800 rounded-2xl p-4 space-y-3"
        id="today_progress"
      >
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-black text-gray-900">今日の目標</span>
            <span className={`font-bold ${goalReached ? "text-emerald-700" : "text-gray-600"}`} id="today_goal_count">
              {goalReached ? "達成！ " : ""}{todayCount} / {dailyGoal}問
            </span>
          </div>
          <div
            className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden"
            role="progressbar"
            aria-label="今日の目標"
            aria-valuemin={0}
            aria-valuemax={dailyGoal}
            aria-valuenow={Math.min(todayCount, dailyGoal)}
          >
            <div
              className={`h-full rounded-full ${goalReached ? "bg-emerald-600" : "bg-indigo-600"}`}
              style={{ width: `${Math.min(100, Math.round((todayCount / Math.max(1, dailyGoal)) * 100))}%` }}
            />
          </div>
        </div>

        {!hasDue && (
          <div className="flex items-baseline justify-between gap-3 pt-3 border-t border-gray-100 dark:border-slate-800 text-sm" data-testid="today_review_status">
            <span className="font-black text-gray-900">今日の復習</span>
            <span className="text-xs text-gray-500">復習する単語はありません</span>
          </div>
        )}

        {wrongWords.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-slate-800" id="review_banner">
            <span className="text-sm">
              <span className="font-black text-gray-900">苦手な単語</span>
              <span className="ml-2 text-xs text-gray-600">{wrongWords.length}語</span>
            </span>
            <button
              type="button"
              onClick={onStartReview}
              id="btn_start_review"
              className="min-h-11 px-3 text-xs font-black text-indigo-700 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              復習する
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {bonusClaimable && (
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-slate-800" id="today_bonus_hint">
            <span className="text-sm min-w-0">
              <span className="font-black text-gray-900">ログインボーナス</span>
              <span className="ml-2 text-xs text-gray-600">受け取れます</span>
            </span>
            <button
              type="button"
              onClick={onOpenRecords}
              id="btn_go_bonus"
              className="min-h-11 px-3 text-xs font-black text-indigo-700 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              受け取る
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
