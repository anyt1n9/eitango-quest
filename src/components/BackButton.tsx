import React from "react";
import { ChevronLeft } from "lucide-react";

/**
 * 下の階層の画面（文法・長文・ガチャ・データなど）の左上に置く「‹ 戻る」。
 *
 * 以前は画面ごとに書いていて、文字の大きさ（12px・14px）・色（灰・青）・枠の有無・
 * 置き場所（カードの中・外）がばらばらで、少なくとも7通りあった。
 * 出題中の中断は「×」（QuizParts の QuizTopBar）で、こちらとは分ける。
 *
 * カードの外に置かれても背景の飾りや写真に紛れないよう、地の色を不透明で敷く。
 */
export default function BackButton({
  onClick,
  id,
  label = "戻る",
  className = ""
}: {
  onClick: () => void;
  id?: string;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      id={id}
      className={`inline-flex self-start w-fit items-center gap-0.5 min-h-11 pl-1.5 pr-3 rounded-xl bg-slate-50 text-sm font-bold text-indigo-700 hover:text-indigo-900 hover:bg-gray-100 transition cursor-pointer ${className}`}
    >
      <ChevronLeft className="w-5 h-5" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
