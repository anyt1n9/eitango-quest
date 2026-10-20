import React from "react";
import { CalendarCheck, Search, BookOpen, BarChart3, Menu } from "lucide-react";
import { Tab } from "../routes";

const TABS: { tab: Tab; label: string; Icon: typeof Search }[] = [
  { tab: "today", label: "今日", Icon: CalendarCheck },
  { tab: "search", label: "調べる", Icon: Search },
  { tab: "learn", label: "教材", Icon: BookOpen },
  { tab: "records", label: "記録", Icon: BarChart3 },
  { tab: "menu", label: "メニュー", Icon: Menu }
];

interface TabBarProps {
  /** いま開いている画面が属するタブ */
  active: Tab;
  onSelect: (tab: Tab) => void;
  /** 今日の復習の語数。0より多ければ「今日」に印を付ける */
  dueCount: number;
  /** ログインボーナスをまだ受け取っていなければ「記録」に印を付ける */
  bonusClaimable: boolean;
}

/**
 * 画面下のタブ。
 *
 * 親指の届く位置に、行き先を5つだけ並べる。出題中は出さない（App が判断する）。
 * 印は「開かなくても気づける」ためのもの。しまい込んだせいで復習やボーナスに
 * 気づかれないのでは、まとめた意味がない。
 */
export default function TabBar({ active, onSelect, dueCount, bonusClaimable }: TabBarProps) {
  return (
    <nav
      aria-label="メイン"
      id="tab_bar"
      className="fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-4xl mx-auto grid grid-cols-5">
        {TABS.map(({ tab, label, Icon }) => {
          const on = tab === active;
          const badge =
            tab === "today" && dueCount > 0 ? String(dueCount)
              : tab === "records" && bonusClaimable ? "!"
                : null;
          return (
            <button
              key={tab}
              type="button"
              id={`tab_${tab}`}
              onClick={() => onSelect(tab)}
              aria-current={on ? "page" : undefined}
              aria-label={
                badge && tab === "today" ? `${label}（復習 ${dueCount}語）`
                  : badge ? `${label}（ログインボーナスを受け取れます）`
                    : undefined
              }
              className={`min-h-16 flex flex-col items-center justify-center gap-1 text-[11px] cursor-pointer transition ${
                on ? "text-indigo-700 font-black" : "text-gray-500 font-bold hover:text-gray-800 dark:hover:text-slate-200"
              }`}
            >
              <span
                className={`relative w-14 h-8 rounded-full flex items-center justify-center ${on ? "bg-indigo-100" : ""}`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                {badge && (
                  <span
                    className="absolute -top-0.5 right-1.5 min-w-4.5 h-4.5 px-1 rounded-full bg-rose-700 text-white text-[10px] font-black flex items-center justify-center"
                    aria-hidden="true"
                    data-testid={`tab_badge_${tab}`}
                  >
                    {badge}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
