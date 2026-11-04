import React from "react";
import { Check, X } from "lucide-react";

/**
 * 出題画面の共通部品（四択・例文穴埋め・綴り・類義語・語義分別）。
 *
 * 形式ごとに書き写していたときは、上の帯が「中断して戻る」「Q: 1 / 10」で
 * 形式ごとに色だけ違い（例文穴埋めだけ緑）、選択肢の角の丸みや地の色もばらばらだった。
 */

/**
 * 出題中の上の帯。左上の「×」で中断し、進み具合と「3 / 10」を出す。
 * 出題中はヘッダーもタブも出さないので、ここが唯一の操作になる。
 */
export function QuizTopBar({
  index,
  total,
  onQuit,
  quitId
}: {
  /** いまの問題（0 から） */
  index: number;
  /** 問題数。0 のとき（準備中・出せる問題が無い）は進み具合を出さない */
  total: number;
  onQuit: () => void;
  quitId: string;
}) {
  const shown = total > 0;
  const current = Math.min(index + 1, total);
  return (
    <div className="flex items-center gap-3 mb-6" data-testid="quiz_top_bar">
      <button
        type="button"
        onClick={onQuit}
        id={quitId}
        aria-label="中断して戻る"
        title="中断して戻る"
        className="shrink-0 w-11 h-11 -ml-2 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition cursor-pointer"
      >
        <X className="w-5 h-5" aria-hidden="true" />
      </button>
      {shown && (
        <>
          <div
            className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden"
            role="progressbar"
            aria-label="進み具合"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={current}
          >
            <div
              className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
              style={{ width: `${(current / total) * 100}%` }}
            />
          </div>
          <span className="shrink-0 min-w-12 text-right text-sm text-gray-500 tabular-nums" data-testid="quiz_progress_text">
            {current} / {total}
          </span>
        </>
      )}
    </div>
  );
}

export type OptionState = "idle" | "correct" | "chosen-wrong" | "other";

/** 選択肢の状態。答えたあとも選択肢は見せたまま、正解と自分の答えに印を付ける */
export function optionState(answered: boolean, isCorrect: boolean, isChosen: boolean): OptionState {
  if (!answered) return "idle";
  if (isCorrect) return "correct";
  if (isChosen) return "chosen-wrong";
  return "other";
}

/** 選択肢のボタンの見た目。白いカードに細い枠、答えたら正解を緑・自分の答えを赤にする */
export function optionClass(state: OptionState): string {
  const base =
    "w-full min-h-14 px-4 py-3 rounded-xl border text-base transition flex items-center gap-3 cursor-pointer disabled:cursor-default";
  switch (state) {
    case "correct":
      return `${base} bg-emerald-50 border-emerald-600 text-emerald-900 font-bold`;
    case "chosen-wrong":
      return `${base} bg-rose-50 border-rose-600 text-rose-900 font-medium`;
    case "other":
      return `${base} bg-white border-gray-200 text-gray-500`;
    default:
      return `${base} bg-white border-gray-200 text-gray-900 hover:border-gray-400 hover:bg-gray-50`;
  }
}

/** 選択肢の番号の札（数字キーでも選べることを示す）。読み上げには要らないので隠す */
export function OptionKey({ n, state }: { n: number; state: OptionState }) {
  const tone =
    state === "correct" ? "bg-emerald-700 text-white"
      : state === "chosen-wrong" ? "bg-rose-700 text-white"
        : "bg-gray-100 text-gray-600";
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums ${tone}`}
    >
      {n}
    </span>
  );
}

/** 答えたあとに選択肢の右端へ出す印（「正解」「あなたの答え」） */
export function OptionMark({ state }: { state: OptionState }) {
  if (state === "correct") {
    return (
      <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-emerald-800">
        <Check className="w-4 h-4" aria-hidden="true" />
        正解
      </span>
    );
  }
  if (state === "chosen-wrong") {
    return (
      <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-rose-800">
        <X className="w-4 h-4" aria-hidden="true" />
        あなたの答え
      </span>
    );
  }
  return null;
}

/** 出題の指示（「意味を選んでください」など）。見出しの上に小さく置く */
export function QuizPrompt({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-500">{children}</p>;
}
