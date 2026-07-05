import { Flame } from "lucide-react";
import { todayStr } from "../srs";

interface StudyCalendarProps {
  dailyLog: Record<string, { count: number; correct: number }>;
  dailyGoal: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 17; // 直近17週間 (約4ヶ月) を表示

/**
 * GitHubの草スタイルの学習カレンダー。
 * 日別の解答数を5段階の濃さで可視化する。
 */
export default function StudyCalendar({ dailyLog, dailyGoal }: StudyCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 表示範囲: 今週の日曜日から WEEKS 週間さかのぼる
  const endSunday = new Date(today.getTime() - today.getDay() * DAY_MS);
  const startDate = new Date(endSunday.getTime() - (WEEKS - 1) * 7 * DAY_MS);

  // 週ごとの列を構築（列=週、行=曜日）
  const weeks: { date: Date; key: string }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const days: { date: Date; key: string }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate.getTime() + (w * 7 + d) * DAY_MS);
      days.push({ date, key: todayStr(date) });
    }
    weeks.push(days);
  }

  // 解答数 -> 色の濃さ (0〜4)。デイリー目標を「濃さMAX」の基準にする
  const intensityFor = (count: number): number => {
    if (count <= 0) return 0;
    const goal = Math.max(dailyGoal, 4);
    if (count >= goal) return 4;
    if (count >= goal * 0.6) return 3;
    if (count >= goal * 0.3) return 2;
    return 1;
  };

  const intensityClass = [
    "bg-gray-100 dark:bg-slate-800",
    "bg-emerald-200 dark:bg-emerald-900",
    "bg-emerald-400 dark:bg-emerald-700",
    "bg-emerald-500 dark:bg-emerald-600",
    "bg-emerald-700 dark:bg-emerald-400"
  ];

  // 集計サマリー
  const todayKey = todayStr(today);
  const entries = Object.entries(dailyLog);
  const totalAnswers = entries.reduce((sum, [, v]) => sum + v.count, 0);
  const activeDays = entries.filter(([, v]) => v.count > 0).length;

  // 連続学習日数（今日または昨日を起点に途切れるまで遡る）
  let streak = 0;
  {
    let cursor = new Date(today);
    if (!dailyLog[todayKey] || dailyLog[todayKey].count === 0) {
      cursor = new Date(today.getTime() - DAY_MS); // 今日まだ未学習なら昨日から数える
    }
    while (true) {
      const key = todayStr(cursor);
      if (dailyLog[key] && dailyLog[key].count > 0) {
        streak++;
        cursor = new Date(cursor.getTime() - DAY_MS);
      } else {
        break;
      }
    }
  }

  // 月ラベル（各週の先頭日が月初めの週に月名を表示）
  const monthLabels: (string | null)[] = weeks.map((days, i) => {
    const first = days[0].date;
    if (i === 0 || first.getDate() <= 7) {
      return `${first.getMonth() + 1}月`;
    }
    return null;
  });
  // 連続する同じ月ラベルは省く
  for (let i = monthLabels.length - 1; i > 0; i--) {
    if (monthLabels[i] && monthLabels[i] === monthLabels[i - 1]) monthLabels[i] = null;
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm rounded-3xl p-6" id="study_calendar_section">
      <div className="flex items-center gap-2 mb-2">
        <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950/50 rounded-xl text-emerald-700 dark:text-emerald-400">
          <Flame className="w-4 h-4" />
        </span>
        <span className="text-xs font-black tracking-wider uppercase font-mono text-emerald-700 dark:text-emerald-400">Study Calendar</span>
      </div>
      <h2 className="text-xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">学習カレンダー</h2>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
        毎日の解答数を記録しています。マスを濃い緑で埋めて、学習の連続記録を伸ばしましょう！
      </p>

      {/* サマリーチップ */}
      <div className="mt-4 flex flex-wrap gap-2.5 text-xs font-bold">
        <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-150 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5" />
          <span>連続学習 <span className="font-mono text-sm">{streak}</span> 日</span>
        </div>
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-150 dark:border-slate-700 text-gray-600 dark:text-slate-300 rounded-xl">
          学習した日: <span className="font-mono text-sm">{activeDays}</span> 日
        </div>
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-150 dark:border-slate-700 text-gray-600 dark:text-slate-300 rounded-xl">
          累計解答: <span className="font-mono text-sm">{totalAnswers}</span> 問
        </div>
      </div>

      {/* ヒートマップ本体（横スクロール対応） */}
      <div className="mt-5 overflow-x-auto pb-2">
        <div className="inline-block min-w-full">
          {/* 月ラベル行 */}
          <div className="flex gap-1 mb-1 pl-8">
            {monthLabels.map((label, i) => (
              <div key={i} className="w-3.5 shrink-0 text-[9px] text-gray-400 dark:text-slate-500 font-bold whitespace-nowrap overflow-visible">
                {label || ""}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            {/* 曜日ラベル列 */}
            <div className="flex flex-col gap-1 w-7 shrink-0 text-[9px] text-gray-400 dark:text-slate-500 font-bold">
              {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
                <div key={d} className="h-3.5 flex items-center">{i % 2 === 1 ? d : ""}</div>
              ))}
            </div>
            {/* 週の列 */}
            {weeks.map((days, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {days.map(({ date, key }) => {
                  const isFuture = date.getTime() > today.getTime();
                  const entry = dailyLog[key];
                  const count = entry?.count || 0;
                  const level = intensityFor(count);
                  return (
                    <div
                      key={key}
                      className={`w-3.5 h-3.5 rounded-[3px] ${
                        isFuture ? "bg-transparent" : intensityClass[level]
                      } ${key === todayKey ? "ring-1 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900" : ""}`}
                      title={isFuture ? "" : `${key}: ${count}問 (正解 ${entry?.correct || 0})`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 凡例 */}
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-gray-400 dark:text-slate-500 font-semibold">
        <span>少ない</span>
        {intensityClass.map((cls, i) => (
          <div key={i} className={`w-3 h-3 rounded-[3px] ${cls}`} />
        ))}
        <span>多い ({dailyGoal}問以上)</span>
      </div>
    </div>
  );
}
