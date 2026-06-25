export type Level = "junior" | "senior" | "senior2" | "senior3" | "advanced";

export interface Word {
  id: string; // 識別用
  word: string; // 英単語
  translation: string; // 日本語訳
  level: Level; // レベル
  options: string[]; // 英単語クイズ用の四択選択肢(日本語)
  sentence: string; // 例文 (例: "This flower is very [_____].")
  sentenceTranslation: string; // 例文の日本語訳
  sentenceOptions: string[]; // 例文クイズ用の四択選択肢(英語、スペル)
}

export interface QuizHistory {
  wordId: string;
  isCorrect: boolean;
  date: string; // ISO 8601 string
}

export interface UserStats {
  score: number; // 総合獲得スコア
  currentStreak: number; // 連続ログイン日数
  lastLoginDate: string | null; // 前回のログイン日 (YYYY-MM-DD)
  completedQuestions: number; // 回答した総問題数
  correctAnswers: number; // 正解した総問題数
  unlockedLevels: Level[]; // 解放済みレベル
}

export interface RankingUser {
  id: string;
  name: string;
  score: number;
  avatar: string;
  isMe?: boolean;
}

export interface LoginBonusDay {
  day: number;
  rewardPoints: number;
  received: boolean;
}
