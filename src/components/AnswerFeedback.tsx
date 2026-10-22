import React, { useEffect, useRef } from "react";
import { ArrowRight, Check, X } from "lucide-react";

/**
 * 答えたあとに選択肢の下へ出す、正誤と解説（四択・例文穴埋め・類義語・語義分別で共通）。
 *
 * 以前の四択と例文穴埋めは、答えると問題のカード全体を大きな〇×でぼかして覆い、
 * 不正解のときは6秒数えてから自動で次へ進んでいた。覆われているあいだは
 * 自分の選んだ語と正解を見比べられず、解説を読み切る前に次の問題へ移る
 * （「すぐに次に進む」のボタンも指で押すには小さかった）。
 * 選択肢は見せたまま、その下に正誤と解説を出し、間違えたときは「次の問題へ」を
 * 押すまで待つ。
 *
 * `onNext` を渡さないときは「次へ」を出さない（正解のあと少しで自動で進む場合）。
 */
export default function AnswerFeedback({
  correct,
  message,
  children,
  onNext,
  nextLabel = "次の問題へ",
  id = "answer_feedback"
}: {
  correct: boolean;
  /** 正誤の一文。読み上げにもこの文が伝わる */
  message: string;
  /** 解説（正解の語と訳など）。無ければ枠を出さない */
  children?: React.ReactNode;
  onNext?: () => void;
  nextLabel?: string;
  id?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const waits = onNext !== undefined;

  // 解説が画面の下に隠れていても目に入るように寄せ、キーボードで解いている人が
  // Enter で進めるよう「次へ」に移る（寄せるのは自前で行うので focus ではスクロールしない）。
  // 少しで自動で進むときは動かさない（正解のたびに画面が上下することになる）
  useEffect(() => {
    if (!waits) return;
    boxRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    nextRef.current?.focus({ preventScroll: true });
  }, [waits]);

  return (
    <div ref={boxRef} className="mt-6 space-y-4" id={id}>
      <p
        role="status"
        aria-live="polite"
        className={`text-sm font-black flex items-center gap-2 ${correct ? "text-emerald-800" : "text-rose-800"}`}
      >
        {correct
          ? <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
          : <X className="w-5 h-5 shrink-0" aria-hidden="true" />}
        <span>{message}</span>
      </p>
      {children && (
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm text-gray-800 space-y-2">
          {children}
        </div>
      )}
      {waits && (
        <button
          ref={nextRef}
          type="button"
          onClick={onNext}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-2xl shadow transition text-sm flex items-center justify-center gap-2 min-h-12 cursor-pointer"
          id="btn_next_question"
        >
          <span>{nextLabel}</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
