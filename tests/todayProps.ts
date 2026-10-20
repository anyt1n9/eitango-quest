import { vi } from "vitest";
import type { ComponentProps } from "react";
import type Dashboard from "../src/components/Dashboard";
import { makeStats } from "./fixtures";

/**
 * 「今日」の画面（Dashboard）に渡す既定の props。
 * テストごとに要るものだけを上書きする。
 */
export function todayProps(
  overrides: Partial<ComponentProps<typeof Dashboard>> = {}
): ComponentProps<typeof Dashboard> {
  return {
    stats: makeStats(),
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
    onOpenRecords: vi.fn(),
    ...overrides
  };
}
