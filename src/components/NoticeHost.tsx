import React, { useEffect } from "react";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { dismissNotice, useNotices, type Notice } from "../notice";

/** 自動で消えるまで。2行ほどの文を読み切れる長さにする */
export const NOTICE_MS = 6000;

const ICON = {
  success: { Icon: CheckCircle2, cls: "text-emerald-700" },
  info: { Icon: Info, cls: "text-indigo-700" },
  warning: { Icon: AlertTriangle, cls: "text-amber-700" }
} as const;

function NoticeItem({ notice }: { notice: Notice }) {
  useEffect(() => {
    const t = setTimeout(() => dismissNotice(notice.id), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice.id]);
  const { Icon, cls } = ICON[notice.tone];
  return (
    <div
      className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow"
      data-testid="notice"
      data-tone={notice.tone}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${cls}`} aria-hidden="true" />
      <p className="flex-1 min-w-0 text-sm text-gray-900 leading-relaxed whitespace-pre-line">{notice.message}</p>
      <button
        type="button"
        onClick={() => dismissNotice(notice.id)}
        aria-label="知らせを閉じる"
        className="-mr-2 -mt-1 shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 transition cursor-pointer"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * 知らせ（src/notice.ts）を画面の下に重ねて出す。App の最上位に1つだけ置く。
 *
 * カード（glass-panel）の中に置かないこと。透かしたカードの中では position: fixed の基準が
 * 画面ではなくカードになる（index.css の glass-flat の説明）。
 * 地は不透明にする（背景の海・写真の上に重なるため）。読み上げには aria-live="polite" で伝える
 * （入れ物は常に置いておく。中身を足したときに読み上げが拾えるように）。
 * role="status" にはしない。出題画面の正誤も role="status" で、入れ物を常に置くと
 * 1画面に status が2つ並び、どちらが正誤なのかが分からなくなる（e2e が実際にそれで落ちた）。
 */
export default function NoticeHost({ aboveTabBar }: { aboveTabBar: boolean }) {
  const notices = useNotices();
  return (
    <div
      aria-live="polite"
      aria-label="お知らせ"
      id="notice_host"
      className={`pointer-events-none fixed inset-x-4 z-50 mx-auto max-w-md space-y-2 ${
        aboveTabBar ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]" : "bottom-[calc(1rem+env(safe-area-inset-bottom))]"
      }`}
    >
      {notices.map(n => (
        <React.Fragment key={n.id}>
          <NoticeItem notice={n} />
        </React.Fragment>
      ))}
    </div>
  );
}
