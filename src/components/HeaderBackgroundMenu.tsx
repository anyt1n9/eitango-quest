import React, { useEffect, useRef, useState } from "react";
import { Blend, Fish } from "lucide-react";
import GlassSlider from "./GlassSlider";

/**
 * スマホのヘッダーに置く「透明度と背景」。押すとヘッダーの下に、透明度のつまみと「海を眺める」を出す。
 *
 * 広い画面ではつまみをヘッダーの中に並べている（App）。スマホのヘッダーには
 * アプリ名・海を眺める・テーマ・点数・連続日数が並んでいて、iPhone 14（幅390）で点数が大きいと
 * 残りは 44px しか無い。つまみはもちろん、ボタンをもう1つ足すだけでもはみ出すので、
 * 「今日」の画面では「海を眺める」もこの中に入れて、ボタンの数を変えない。
 *
 * 閉じ方：もう一度押す・外を押す・Esc・画面が変わる。
 */
export default function HeaderBackgroundMenu({
  canViewSea,
  onViewSea,
  resetKey
}: {
  canViewSea: boolean;
  /** 海を眺める。戻ったときに手元へ戻すため、押したボタンを渡す */
  onViewSea: (returnFocusTo: HTMLElement | null) => void;
  /** 変わったら閉じる（画面の切り替わり） */
  resetKey: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setOpen(false); }, [resetKey]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="sm:hidden">
      <button
        ref={buttonRef}
        type="button"
        id="btn_header_background"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="header_background_panel"
        aria-label="透明度と背景"
        title="透明度と背景"
        className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition cursor-pointer ${
          open ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Blend className="w-5 h-5" aria-hidden="true" />
      </button>
      {open && (
        // ヘッダー（sticky）の真下に重ねる。ヘッダーの高さは変えない（本文が押し下がらない）
        <div
          id="header_background_panel"
          className="absolute inset-x-0 top-full bg-slate-50 border-b border-gray-200 px-4 pt-2 pb-3 space-y-3"
        >
          <GlassSlider id="header_glass_slider_phone" hint />
          {canViewSea && (
            <button
              type="button"
              id="btn_sea_view_phone"
              onClick={() => {
                setOpen(false);
                onViewSea(buttonRef.current);
              }}
              className="w-full min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-900 hover:bg-gray-50 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Fish className="w-4.5 h-4.5" aria-hidden="true" />
              海を眺める（画面の文字を隠します）
            </button>
          )}
        </div>
      )}
    </div>
  );
}
