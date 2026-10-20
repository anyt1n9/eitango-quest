import React from "react";
import { Sun, Moon, Image as ImageIcon, Leaf, Database, Gift, Info, ShieldCheck, ScrollText, ChevronRight } from "lucide-react";
import { Screen } from "../routes";

interface MenuScreenProps {
  isDark: boolean;
  onToggleTheme: () => void;
  bgMotion: boolean;
  onToggleBgMotion: () => void;
  /** ガチャで使えるポイント（合計スコアからガチャで使った分を引いたもの） */
  availablePoints: number;
  onNavigate: (screen: Screen) => void;
}

const ROW =
  "w-full min-h-14 flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer";
const ICON = "w-9 h-9 shrink-0 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center";
const GROUP =
  "bg-white border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-slate-800";

/**
 * メニューの画面（画面下のタブの「メニュー」）。
 *
 * ハンバーガーの中身（ガチャ・データ・背景）と、フッターにあった
 * アプリの説明・規約・使っているAIの表示をここにまとめる。
 * フッターはクイズ中も含めてどの画面の下にも出ていたが、
 * 学習中に要るものではなかった。
 */
export default function MenuScreen({
  isDark,
  onToggleTheme,
  bgMotion,
  onToggleBgMotion,
  availablePoints,
  onNavigate
}: MenuScreenProps) {
  return (
    <div className="space-y-6" id="menu_page">
      <h1 className="text-xl font-black text-gray-900 px-1">メニュー</h1>

      <section aria-labelledby="menu_view_heading" className="space-y-2.5">
        <h2 id="menu_view_heading" className="text-sm font-black text-gray-600 px-1">表示</h2>
        <div className={GROUP}>
          <button type="button" id="menu_theme_btn" onClick={onToggleTheme} className={ROW} aria-pressed={isDark}>
            <span className={ICON}>{isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}</span>
            <span className="flex-1 text-sm font-black text-gray-900">テーマ</span>
            <span className="text-xs font-bold text-gray-600">{isDark ? "暗い（海）" : "明るい（森）"}</span>
          </button>
          <button type="button" id="nav_background_btn" onClick={() => onNavigate("background")} className={ROW}>
            <span className={ICON}><ImageIcon className="w-5 h-5" /></span>
            <span className="flex-1 text-sm font-black text-gray-900">背景の画像・透明感</span>
            <ChevronRight className="w-4 h-4 text-gray-500" aria-hidden="true" />
          </button>
          {/* 動くものが視界にあると落ち着かない人もいる */}
          <button type="button" id="nav_bg_motion_btn" onClick={onToggleBgMotion} className={ROW} aria-pressed={bgMotion}>
            <span className={ICON}><Leaf className="w-5 h-5" /></span>
            <span className="flex-1 text-sm font-black text-gray-900">背景の動き</span>
            <span className="text-xs font-bold text-gray-600">{bgMotion ? "動かす" : "止める"}</span>
          </button>
        </div>
      </section>

      <section aria-labelledby="menu_data_heading" className="space-y-2.5">
        <h2 id="menu_data_heading" className="text-sm font-black text-gray-600 px-1">学習</h2>
        <div className={GROUP}>
          <button type="button" id="nav_settings_btn" onClick={() => onNavigate("settings")} className={ROW}>
            <span className={ICON}><Database className="w-5 h-5" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-black text-gray-900">データと目標</span>
              <span className="block text-xs text-gray-500 mt-0.5">1日の目標・バックアップ・端末の引っ越し</span>
            </span>
            <ChevronRight className="w-4 h-4 text-gray-500" aria-hidden="true" />
          </button>
          <button type="button" id="nav_gacha_btn" onClick={() => onNavigate("gacha")} className={ROW}>
            <span className={ICON}><Gift className="w-5 h-5" /></span>
            <span className="flex-1 text-sm font-black text-gray-900">ごほうびガチャ</span>
            <span className="text-xs font-bold text-gray-700" data-testid="menu_points" aria-label={`使えるポイント ${availablePoints}`}>
              {availablePoints} P
            </span>
            <ChevronRight className="w-4 h-4 text-gray-500" aria-hidden="true" />
          </button>
        </div>
      </section>

      <section aria-labelledby="menu_about_heading" className="space-y-2.5">
        <h2 id="menu_about_heading" className="text-sm font-black text-gray-600 px-1">このアプリについて</h2>
        <div className={GROUP}>
          <button type="button" id="btn_about_app" onClick={() => onNavigate("about")} className={ROW}>
            <span className={ICON}><Info className="w-5 h-5" /></span>
            <span className="flex-1 text-sm font-black text-gray-900">アプリケーション説明</span>
            <ChevronRight className="w-4 h-4 text-gray-500" aria-hidden="true" />
          </button>
          <button type="button" id="btn_privacy" onClick={() => onNavigate("privacy")} className={ROW}>
            <span className={ICON}><ShieldCheck className="w-5 h-5" /></span>
            <span className="flex-1 text-sm font-black text-gray-900">プライバシーポリシー</span>
            <ChevronRight className="w-4 h-4 text-gray-500" aria-hidden="true" />
          </button>
          <button type="button" id="btn_terms" onClick={() => onNavigate("terms")} className={ROW}>
            <span className={ICON}><ScrollText className="w-5 h-5" /></span>
            <span className="flex-1 text-sm font-black text-gray-900">利用規約</span>
            <ChevronRight className="w-4 h-4 text-gray-500" aria-hidden="true" />
          </button>
        </div>
        <div className="px-1 space-y-1 text-xs text-gray-500" id="menu_credits">
          <p>AIの機能（単語の追加・長文の生成など）は Gemini 3.5 Flash を使っています。</p>
          <p>© 2026 Eigorira. Built with Google AI Studio &amp; Claude.</p>
          <p>Ver 1.6.0</p>
        </div>
      </section>
    </div>
  );
}
