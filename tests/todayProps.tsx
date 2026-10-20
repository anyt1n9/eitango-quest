import { useState, type ComponentProps } from "react";
import { vi } from "vitest";
import Dashboard from "../src/components/Dashboard";
import type { Level } from "../src/types";

type TodayProps = ComponentProps<typeof Dashboard>;

/**
 * 「今日」の画面（Dashboard）に渡す既定の props。
 * テストごとに要るものだけを上書きする。
 */
export function todayProps(overrides: Partial<TodayProps> = {}): TodayProps {
  return {
    vocabulary: [],
    solvedHistory: {},
    srsData: {},
    wrongWords: [],
    onStartQuiz: vi.fn(),
    onStartReview: vi.fn(),
    dueCount: 0,
    onStartSrsReview: vi.fn(),
    dailyGoal: 20,
    todayCount: 0,
    bonusClaimable: false,
    onOpenRecords: vi.fn(),
    level: "junior",
    onLevelChange: vi.fn(),
    questionCount: 10,
    onQuestionCountChange: vi.fn(),
    ...overrides
  };
}

/**
 * レベルと問題数を App と同じく外側で持って描く。
 * 選んだら画面が切り替わるところまで見たいテストで使う（変更は props の関数にも伝える）。
 */
export function TodayHarness(props: TodayProps) {
  const [level, setLevel] = useState<Level>(props.level);
  const [count, setCount] = useState<number>(props.questionCount);
  return (
    <Dashboard
      {...props}
      level={level}
      onLevelChange={l => { setLevel(l); props.onLevelChange(l); }}
      questionCount={count}
      onQuestionCountChange={c => { setCount(c); props.onQuestionCountChange(c); }}
    />
  );
}
