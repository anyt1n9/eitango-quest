import { useEffect, useState } from "react";
import { todayStr } from "./srs";

/**
 * 今日の日付（YYYY-MM-DD）。日付が変わったら描き直す。
 *
 * 以前は描くたびに todayStr() を呼んでいるだけで、日付が変わったことを知らせる仕組みが無かった。
 * ホーム画面から開くとアプリは何日も閉じないので、開いたまま0時を過ぎると、何か操作するまで
 * 「今日」の画面に前の日の日付・目標の数（「達成！」のまま）・復習の数が残り、
 * ログインボーナスも「受け取り済み」に見えたままだった。
 *
 * 次の0時に合わせて時計を掛け、加えて画面に戻ってきたとき（裏に回っていた・端末が眠っていた）にも
 * 確かめ直す。裏に回っているあいだの時計はブラウザが止めたり遅らせたりするので、0時の時計だけには頼れない。
 */
export function msUntilNextDay(now: Date = new Date()): number {
  // 暦日で足す（24時間を足すと、夏時間の切り替わる日に0時からずれる。CLAUDE.md「日付のテスト」）
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

/** 0時ちょうどに見ると、時計のずれで前の日のままのことがあるので、少しだけ遅らせる */
const AFTER_MIDNIGHT_MS = 1000;

export function useToday(): string {
  const [today, setToday] = useState(() => todayStr());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => setToday(prev => {
      const now = todayStr();
      return now === prev ? prev : now;
    });
    const schedule = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        check();
        schedule();
      }, msUntilNextDay() + AFTER_MIDNIGHT_MS);
    };
    const onReturn = () => {
      if (document.visibilityState === "hidden") return;
      check();
      schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
    };
  }, []);
  return today;
}
