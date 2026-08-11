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
  /**
   * 辞書がこの語義を重要と示していたか（EJDict の『』）。
   * 使用割合は品詞単位でしか出せないため、語義ごとの手がかりはこれだけ。
   * 実測の頻度ではなく辞書編纂者の判断なので、割合(%)とは別物として見せる。
   */
  important?: boolean;
  /**
   * 別の見出し語から借りてきた語義であることを示す（その語）。
   * politely は辞書に見出しが無いため polite の語義を借りる。
   * 借り物なので使用割合は付けない。
   */
  from?: string;
  /**
   * その品詞で使ったときの用例（英語のみ）。
   * 単語データ側の例文は「教材が教えている語義」のものしか無いため、
   * 別の品詞の語義には WordNet に収録されている実際の用例を添える。
   * 機械訳を付けると誤訳が混ざるため、訳は付けない。
   */
  usage?: string;
}

/**
 * 単語の使い方。訳語だけでは英文が組み立てられないため、
 * 「どんな形をとるか」「どんな語と組むか」「どんな語族に属するか」を補う。
 * 生成は scripts/bake_usage.ts（出典はすべて WordNet と EJDict）。
 */
export interface WordUsage {
  /** 語源を同じくする語（decide → decision / decisive） */
  family?: { word: string; meaning: string; pos: PartOfSpeech }[];
  /** 動詞の文型。WordNet の sentence frame 番号（1〜35）。ラベルは src/usage.ts */
  patterns?: number[];
  /** よく組んで使われる複合語（gas station / weather forecast） */
  collocations?: { phrase: string; meaning: string }[];
}

/**
 * 文法項目。
 *
 * この教材は「単語と訳を1対1で覚える」ことに寄っていて、文法の解説がまったく無かった。
 * 単語を覚えても、その語をどう並べれば文になるかは別の知識なので、
 * 結局は文法の参考書を別に買う必要があった。ここでその穴を埋める。
 *
 * 出典のあるデータ（語義・語法）と違い、この解説は書き下ろしである。
 * 中学・高校で扱う順に並べ、各項目に「説明」「例文」「よくある間違い」「練習」を持たせる。
 */
export interface GrammarExample {
  english: string;
  japanese: string;
  /** その例文で何を見るか */
  note?: string;
}

/** 日本語話者がよく書いてしまう形と、その直し方 */
export interface GrammarMistake {
  wrong: string;
  right: string;
  why: string;
}

export interface GrammarQuestion {
  /** 空所は [_____] で表す */
  question: string;
  options: string[];
  correctIndex: number;
  /** なぜその答えになるか。間違えたときに読む */
  explanation: string;
}

export interface GrammarTopic {
  id: string;
  level: Level;
  /** 「文の組み立て」「動詞の形」など、目次の見出しに使う */
  category: string;
  title: string;
  /** 一行での要約 */
  summary: string;
  sections: { heading: string; body: string }[];
  examples: GrammarExample[];
  mistakes: GrammarMistake[];
  questions: GrammarQuestion[];
  /**
   * この文法に関係する動詞の文型番号（WordNet の sentence frame）。
   * 収録語のデータ（wordUsage.ts）から「その形をとる動詞」を引いて見せるのに使う。
   * 解説だけで終わらせず、覚えた単語と結び付けるため。
   */
  verbFrames?: number[];
  /** 先に読んでおくとよい項目のID */
  requires?: string[];
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
