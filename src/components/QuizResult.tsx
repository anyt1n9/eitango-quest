import React from "react";
import { Check, RotateCcw, Trophy, X } from "lucide-react";

export interface QuizResultItem {
  key: string;
  isCorrect: boolean;
  /** 1行ぶんの中身（語・訳・自分の答えなど） */
  content: React.ReactNode;
}

/**
 * クイズの結果画面（四択・例文穴埋め・綴り・類義語・語義分別で共通）。
 *
 * 以前は形式ごとに書き写していて、振り返りの一覧を高さ240pxの枠の中で
 * スクロールさせていた（スマホでは2件ほどしか見えず、ページと枠の二重スクロールになる）。
 * 一覧はページの流れにそのまま並べ、「もう一度」「戻る」は一覧の前に置く
 * （50問のときに、押すまで一覧の終わりまで送らなくて済むように）。
 */
export default function QuizResult({
  id,
  title,
  subtitle,
  score,
  total,
  points,
  perfectBonus,
  reviewTitle = "振り返り",
  items,
  onRetry,
  onBack,
  retryId,
  backId
}: {
  id: string;
  title: string;
  subtitle: string;
  score: number;
  total: number;
  points: number;
  /** 全問正解のときに上乗せしたポイント（points に含まれている） */
  perfectBonus: number;
  reviewTitle?: string;
  items: QuizResultItem[];
  onRetry: () => void;
  onBack: () => void;
  retryId: string;
  backId: string;
}) {
  const rate = total > 0 ? Math.round((score / total) * 100) : 0;
  return (
    <div className="space-y-4" id={id}>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
        <div className="text-center space-y-1">
          <p className="text-sm text-gray-500">{subtitle}</p>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        </div>

        {/* 3つの数を細い線で区切って並べる（色の付いた箱を並べると、どれも同じ強さに見える） */}
        <dl className="grid grid-cols-3 divide-x divide-gray-200 text-center">
          <div className="px-2">
            <dt className="text-xs text-gray-500">正解数</dt>
            <dd className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums break-all" id="quiz_result_score">
              {score} <span className="text-sm text-gray-500 font-medium">/ {total}</span>
            </dd>
          </div>
          <div className="px-2">
            <dt className="text-xs text-gray-500">正答率</dt>
            <dd className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums break-all">
              {rate}<span className="text-sm text-gray-500 font-medium">%</span>
            </dd>
          </div>
          <div className="px-2">
            <dt className="text-xs text-gray-500">獲得スコア</dt>
            <dd className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums break-all">
              +{points} <span className="text-sm text-gray-500 font-medium">P</span>
            </dd>
          </div>
        </dl>

        {total > 0 && score === total && (
          <p className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center text-amber-900 font-bold text-sm flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5 text-amber-700" aria-hidden="true" />
            <span>全問正解！ボーナス +{perfectBonus} P</span>
          </p>
        )}

        <div className="flex flex-col sm:flex-row justify-center gap-2.5">
          <button
            type="button"
            onClick={onRetry}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 min-h-13 rounded-xl transition text-base flex items-center justify-center gap-2 cursor-pointer"
            id={retryId}
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>もう一度挑戦する</span>
          </button>
          <button
            type="button"
            onClick={onBack}
            className="bg-white hover:bg-gray-50 text-gray-900 font-bold px-8 min-h-13 rounded-xl border border-gray-300 transition text-base cursor-pointer"
            id={backId}
          >
            戻る
          </button>
        </div>
      </div>

      <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2" aria-labelledby={`${id}_review_heading`}>
        <h3 id={`${id}_review_heading`} className="text-base font-bold text-gray-900">{reviewTitle}</h3>
        <ul className="divide-y divide-gray-200" id="quiz_mini_review_pool">
          {items.map(item => (
            <li key={item.key} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">{item.content}</div>
              {item.isCorrect ? (
                <span className="shrink-0 text-emerald-800 font-bold text-xs bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>正解</span>
                </span>
              ) : (
                <span className="shrink-0 text-rose-800 font-bold text-xs bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>誤答</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
