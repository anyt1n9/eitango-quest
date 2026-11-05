import React from "react";
import { GLASS_SAFE_MAX, setGlass, useGlass } from "../glass";

/** 読み上げに渡す値。数だけだと、どこから読みにくくなるのかが伝わらない */
export function glassValueText(value: number): string {
  if (value <= 0) return "0%（不透明）";
  if (value <= GLASS_SAFE_MAX) return `${value}%（文字の読みやすさを保つ範囲）`;
  return `${value}%（背景によっては文字が読みにくくなります）`;
}

/**
 * カードの透明度のつまみ（0〜100%）。ヘッダーとメニューで同じものを使う。
 *
 * 値は src/glass.ts が持ち、動かすとすぐ画面に当たる（App を描き直さない）。
 * 18%（GLASS_SAFE_MAX）に目盛りを付ける。そこまでは文字の読みやすさを保証している。
 */
export default function GlassSlider({
  id,
  hint = false,
  className = ""
}: {
  id: string;
  /** 下に「どこまでなら読みやすいか」を書く（場所に余裕があるとき） */
  hint?: boolean;
  className?: string;
}) {
  const value = useGlass();
  const marks = `${id}_marks`;
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-xs text-gray-600 whitespace-nowrap shrink-0">
          透明度
        </label>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          list={marks}
          onChange={e => setGlass(Number(e.target.value))}
          aria-valuetext={glassValueText(value)}
          title={`カードの透明度（${GLASS_SAFE_MAX}%までは文字の読みやすさを保ちます）`}
          className="flex-1 min-w-0 h-10 accent-indigo-600 cursor-pointer"
        />
        <datalist id={marks}>
          <option value="0" />
          <option value={GLASS_SAFE_MAX} />
          <option value="100" />
        </datalist>
        <span className="w-10 text-right text-xs font-bold tabular-nums text-gray-900 shrink-0" aria-hidden="true">
          {value}%
        </span>
      </div>
      {hint && (
        <p className="text-xs text-gray-600 leading-snug" id={`${id}_hint`}>
          {value <= GLASS_SAFE_MAX
            ? `${GLASS_SAFE_MAX}%までは、どんな背景の上でも文字の読みやすさを保ちます。`
            : `${GLASS_SAFE_MAX}%より透かすと、背景によっては文字が読みにくくなります。`}
          効くのは「今日」の画面のカードです。
        </p>
      )}
    </div>
  );
}
