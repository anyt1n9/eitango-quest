export type Level = "junior" | "senior" | "senior2" | "senior3" | "advanced";

export type PartOfSpeech = "verb" | "noun" | "adjective" | "adverb" | "other";

/**
 * 単語の語義。1語につき複数の意味を持たせるためのもの。
 *
 * `share` はその品詞が実際の英文でどれくらいの割合を占めるかで、
 * WordNet の SemCor 頻度から求めている（データのある語だけ付く）。
 * 語義そのものの頻度ではなく品詞単位の割合である点に注意。
 * 日本語の語義と英語の語義を1対1で対応づけるのは信頼できないため、
 * 品詞という粗い単位でのみ実測値を使っている。
 */
export interface WordSense {
  meaning: string;      // 日本語の語義
  pos: PartOfSpeech;    // その語義の品詞
  share?: number;       // その品詞が使われる割合(%)
}

export interface Word {
  id: string; // 識別用
  word: string; // 英単語
  translation: string; // 日本語訳
  level: Level; // レベル
  options: string[]; // 英単語クイズ用の四択選択肢(日本語)
  sentence: string; // 例文 (例: "This flower is very [_____].")
  sentenceTranslation: string; // 例文の日本語訳
  sentenceOptions: string[]; // 例文クイズ用の四択選択肢(英語、スペル)
  pos?: PartOfSpeech; // 品詞 (未設定の場合は訳語・語尾から推定する)
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
