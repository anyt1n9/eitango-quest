import { Level } from "./types";

/**
 * レベルの呼び方。
 *
 * 以前は画面ごとに書き方が違い、同じレベルが「中学」「初級 (中学生レベル)」
 * 「初級 (中学)」「初級 (中学生)」と4通りで出ていた（高1は「高1」「中級 (高校1年生レベル)」
 * 「中級1 (高1)」「中級 (高校1年)」）。並べると別のものに見えるので、
 * 「段階（対象）」の1つの形にそろえ、どの画面もここから引く。
 */
export const LEVEL_LABELS: Record<Level, string> = {
  junior: "初級（中学）",
  senior: "中級1（高1）",
  senior2: "中級2（高2）",
  senior3: "中級3（高3）",
  advanced: "上級（大学・社会人）"
};

/** 段階だけ（狭い場所で2行に分けて出すときの1行目） */
export const LEVEL_STAGES: Record<Level, string> = {
  junior: "初級",
  senior: "中級1",
  senior2: "中級2",
  senior3: "中級3",
  advanced: "上級"
};

/** 対象だけ（2行目） */
export const LEVEL_AUDIENCES: Record<Level, string> = {
  junior: "中学",
  senior: "高1",
  senior2: "高2",
  senior3: "高3",
  advanced: "大学・社会人"
};

/** 学習する順 */
export const LEVEL_ORDER: Level[] = ["junior", "senior", "senior2", "senior3", "advanced"];
