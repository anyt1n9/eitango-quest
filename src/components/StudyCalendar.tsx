import { todayStr } from "../srs";

interface StudyCalendarProps {
  dailyLog: Record<string, { count: number; correct: number }>;
  dailyGoal: number;
}

const WEEKS = 17; // 直近17週間 (約4ヶ月) を表示

/**
 * 暦日で日数を足した Date を返す。
 *
 * ミリ秒（24時間 × 日数）で足してはいけない。夏時間を採る地域では
 * 時計が1時間戻る日が25時間あり、24時間ずつ足すと同じ暦日が2度現れて
 * 最後の1日が押し出される（実測: TZ=America/New_York で 2026-11-01 が2回出た）。
 * 4ヶ月ぶんを並べるこの表は、そうした地域では必ず切り替え日をまたぐ。
 */
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * GitHubの草スタイルの学習カレンダー。
 * 日別の解答数を5段階の濃さで可視化する。
 */
export default function StudyCalendar({ dailyLog, dailyGoal }: StudyCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 表示範囲: 今週の日曜日から WEEKS 週間さかのぼる
  const endSunday = addDays(today, -today.getDay());
  const startDate = addDays(endSunday, -(WEEKS - 1) * 7);

  // 週ごとの列を構築（列=週、行=曜日）
  const weeks: { date: Date; key: string }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const days: { date: Date; key: string }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(startDate, w * 7 + d);
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
  const activeDays = entries.filter(([, v]) => v.count > 0).length;

  // 連続学習日数（今日または昨日を起点に途切れるまで遡る）
  let streak = 0;
  {
    let cursor = new Date(today);
    if (!dailyLog[todayKey] || dailyLog[todayKey].count === 0) {
      cursor = addDays(today, -1); // 今日まだ未学習なら昨日から数える
    }
    while (true) {
      const key = todayStr(cursor);
      if (dailyLog[key] && dailyLog[key].count > 0) {
        streak++;
        cursor = addDays(cursor, -1);
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
    // 記録の画面のログインボーナスのカードの中に置くので、ここではカードにしない
    // （カードの中にカードを重ねると、枠と余白が二重になる）
    <div id="study_calendar_section">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-base font-bold text-gray-900">学習カレンダー</h2>
        {/* 累計の解答数は、同じ「記録」の画面の「累計回答数」が受け持つ。
            ここでも日別の記録から数えて出していたが、数え方が違ったため
            同じ画面に「累計解答 11問」と「累計回答数 10問」が並んでいた */}
        <div className="flex gap-3 text-sm text-gray-500 tabular-nums">
          <div>連続学習 <span className="font-bold text-gray-900">{streak}</span> 日</div>
          <div>学習した日 <span className="font-bold text-gray-900">{activeDays}</span> 日</div>
        </div>
      </div>
      <p className="text-sm text-gray-500 mt-1">
        1日に解いた問題の数を、マスの濃さで表しています。
      </p>

      {/* ヒートマップ本体（横スクロール対応） */}
      <div className="mt-4 overflow-x-auto pb-2">
        <div className="inline-block min-w-full">
          {/* 月ラベル行 */}
          <div className="flex gap-1 mb-1 pl-8">
            {monthLabels.map((label, i) => (
              <div key={i} className="w-3.5 shrink-0 text-xs text-gray-500 whitespace-nowrap overflow-visible">
                {label || ""}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            {/* 曜日ラベル列 */}
            <div className="flex flex-col gap-1 w-7 shrink-0 text-xs text-gray-500">
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
      <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-gray-500">
        <span>少ない</span>
        {intensityClass.map((cls, i) => (
          <div key={i} className={`w-3 h-3 rounded-[3px] ${cls}`} />
        ))}
        <span>多い ({dailyGoal}問以上)</span>
      </div>
    </div>
  );
}
