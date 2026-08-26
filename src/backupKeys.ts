/**
 * バックアップ（書き出し・復元）の対象にする localStorage のキー。
 *
 * 画面から分けてあるのは、テストから読めるようにするため。
 * 新しい保存キーを足したときにここへの追加を忘れると、
 * 書き出したファイルにその項目だけが入らず、
 * 端末を移したときに「その機能の進捗だけが消える」ことになる。
 * 実際、文法ガイドを足したときに `quest_grammar_progress` の追加が漏れていた。
 * tests/dataBackup.test.ts が src 内の保存キーを機械的に集めて突き合わせる。
 */
export const BACKUP_KEYS = [
  "quest_stats",
  "quest_vocab_custom",
  "quest_wrong_words",
  "quest_solved_history",
  "quest_ranking_score",
  "quest_rival_growth_date",
  "quest_srs",
  "quest_daily_progress",
  "quest_daily_goal",
  "quest_question_count",
  "quest_selected_level",
  "quest_daily_log",
  "quest_read_passages",
  "quest_reading_show_ja",
  "quest_custom_passages",
  "quest_theme",
  "quest_diary_history",
  "quest_current_diary_cache",
  "quest_owned_rewards",
  "quest_gacha_spent",
  "quest_equipped",
  "quest_grammar_progress",
  "quest_grammar_wrong",
  "quest_puzzle_rewarded_words",
  "quest_reading_wrong",
] as const;

/**
 * バックアップに含めないキーと、その理由。
 *
 * 「入れ忘れ」と「意図して外した」を区別できるようにするため、
 * 除外にも理由を書いて残す。
 */
export const NON_BACKUP_KEYS: Record<string, string> = {
  // 外部の辞書APIから取り直せる。復元しても学習の記録は増えない
  quest_phonetics_cache: "取り直せるキャッシュのため",
  // 端末ごとの見た目の設定。学習の記録ではない（テーマと同じ扱いにしたいが、
  // テーマは以前からバックアップに入れているので、新しい方だけ外す）
  quest_bg_motion: "端末ごとの見た目の設定のため",
  // 画像そのもの（数百KB）。書き出したJSONが写真で膨らみ、
  // 学習の記録を移すという本来の用途を邪魔する
  quest_bg_image: "端末ごとの見た目の設定で、容量も大きいため",
};
