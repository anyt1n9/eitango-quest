import React from "react";
import { Award, Check, RotateCcw, Trophy, X } from "lucide-react";

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
  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6" id={id}>
      <div className="text-center space-y-2">
        <div className="w-14 h-14 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center mx-auto">
          <Award className="w-7 h-7" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-black text-gray-900">{title}</h2>
        <p className="text-xs text-gray-600 font-bold">{subtitle}</p>
      </div>

      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 flex justify-around text-center">
        <div>
          <span className="text-xs text-gray-600 font-bold">正解数</span>
          <p className="text-3xl font-black text-indigo-700 mt-1 tabular-nums" id="quiz_result_score">
            {score} <span className="text-xs text-gray-600 font-bold">/ {total}</span>
          </p>
        </div>
        <div className="border-r border-gray-200" />
        <div>
          <span className="text-xs text-gray-600 font-bold">獲得スコア</span>
          <p className="text-3xl font-black text-emerald-700 mt-1 tabular-nums">
            +{points} <span className="text-xs text-gray-600 font-bold">P</span>
          </p>
        </div>
      </div>

      {total > 0 && score === total && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center text-amber-900 font-bold text-sm flex items-center justify-center gap-2">
          <Trophy className="w-5 h-5 text-amber-700" aria-hidden="true" />
          <span>全問正解！ボーナス +{perfectBonus} P</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-8 py-3.5 min-h-12 rounded-2xl shadow transition text-sm flex items-center justify-center gap-2 cursor-pointer"
          id={retryId}
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          <span>もう一度挑戦する</span>
        </button>
        <button
          type="button"
          onClick={onBack}
          className="bg-white hover:bg-gray-50 text-gray-800 font-extrabold px-8 py-3.5 min-h-12 rounded-2xl border border-gray-200 transition text-sm cursor-pointer"
          id={backId}
        >
          戻る
        </button>
      </div>

      <section className="space-y-3" aria-labelledby={`${id}_review_heading`}>
        <h3 id={`${id}_review_heading`} className="text-sm font-extrabold text-gray-800">{reviewTitle}</h3>
        <ul className="space-y-2.5" id="quiz_mini_review_pool">
          {items.map(item => (
            <li
              key={item.key}
              className={`p-3.5 border rounded-xl flex items-start justify-between gap-3 ${
                item.isCorrect ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
              }`}
            >
              <div className="min-w-0 space-y-1">{item.content}</div>
              {item.isCorrect ? (
                <span className="shrink-0 text-emerald-900 font-bold text-xs bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" aria-hidden="true" />
                  <span>正解</span>
                </span>
              ) : (
                <span className="shrink-0 text-rose-900 font-bold text-xs bg-rose-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <X className="w-3 h-3" aria-hidden="true" />
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
