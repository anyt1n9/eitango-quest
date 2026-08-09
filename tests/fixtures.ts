import { Word, UserStats } from "../src/types";

/**
 * 画面の描画テスト用の単語。
 *
 * 収録データ（7,700語）をそのまま使うと、どの語が出題されるかで
 * 結果が変わってしまう。描画の検証では中身を固定したい。
 */
export function makeWord(over: Partial<Word> = {}): Word {
  return {
    id: "w_beautiful",
    word: "beautiful",
    translation: "美しい",
    level: "junior",
    options: ["美しい", "重い", "静かな", "危険な"],
    sentence: "The garden is very [_____] in spring.",
    sentenceTranslation: "その庭は春にとても美しい。",
    sentenceOptions: ["beautiful", "careful", "powerful", "peaceful"],
    pos: "adjective",
    ...over
  };
}

/** id と表示だけ違う単語をまとめて作る（出題数の検証用） */
export function makeWords(count: number): Word[] {
  return Array.from({ length: count }, (_, i) =>
    makeWord({
      id: `w_${i}`,
      word: `word${i}`,
      translation: `意味${i}`,
      options: [`意味${i}`, "誤答A", "誤答B", "誤答C"],
      sentenceOptions: [`word${i}`, "wrongA", "wrongB", "wrongC"]
    })
  );
}

export function makeStats(over: Partial<UserStats> = {}): UserStats {
  return {
    score: 0,
    currentStreak: 1,
    lastLoginDate: null,
    completedQuestions: 0,
    correctAnswers: 0,
    unlockedLevels: ["junior"],
    ...over
  };
}
