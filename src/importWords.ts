import { Level, PartOfSpeech, Word } from "./types";
import { pickDistractors, Candidate } from "./distractors";
import { getWordPos, inferPartOfSpeech } from "./pos";
import { shuffle } from "./shuffle";
import { toFillInSentence } from "./fillIn";
import { isOffensiveText } from "./offensiveTerms";

/**
 * 外から入ってきた単語（CSV取り込み・PDF抽出・AI生成）を、
 * アプリが扱える形に整える。
 *
 * Dashboard.tsx の中に書かれていたが、通信も描画もしない処理なので分けた。
 * 画面の中にあるとテストから触れず、取り込んだ単語が
 * 「どのクイズにも出てこない」といった不具合を確かめられない。
 */

const VALID_LEVELS: Level[] = ["junior", "senior", "senior2", "senior3", "advanced"];
const VALID_POS = ["verb", "noun", "adjective", "adverb", "other"];

/** 例文が無いときの当たり障りのない枠 */
const FALLBACK_SENTENCE = "I want to study [_____] today.";
const FALLBACK_SENTENCE_JA = "私は今日、[_____]を勉強したいです。";

/**
 * CSV を行と列に分ける。
 * 引用符の中の改行とカンマ、二重引用符のエスケープに対応する。
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let entry = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        entry += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(entry.trim());
      entry = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      row.push(entry.trim());
      lines.push(row);
      row = [];
      entry = "";
    } else {
      entry += char;
    }
  }
  if (entry || row.length > 0) {
    row.push(entry.trim());
    lines.push(row);
  }
  return lines.filter(r => r.length > 0 && r.some(c => c !== ""));
}

/**
 * 誤選択肢（ディストラクター）を集める。
 * 収録語と同じく「同じ品詞・同じレベルで、表記の近い語」から選ぶ。
 * 以前は同レベルからのランダム抽出で品詞すら揃っておらず、
 * 意味を知らなくても消去法で正解できてしまっていた。
 *
 * 候補が足りないときは正解で埋めず、取れた分だけ返す。
 */
export function buildDistractors(
  target: { word: string; translation: string; level: Level; pos: PartOfSpeech },
  pool: Word[],
  mode: "translation" | "word",
  count = 3
): string[] {
  const candidates: Candidate[] = pool.map(w => ({
    word: w.word,
    translation: w.translation,
    level: w.level,
    pos: getWordPos(w)
  }));
  return pickDistractors(target as Candidate, candidates, count, mode);
}

/**
 * 取り込んだ1語を整える。単語か訳が欠けていれば取り込まない（null）。
 *
 * 応答は必ずしもスキーマ通りではなく、そのまま保存すると次の不具合になる:
 *  - level が "SENIOR" のように不正だと `w.level === level` にどれも一致せず、
 *    追加した単語がどのレベルのクイズにも一度も出題されない（エラーも出ないので気づけない）
 *  - options が配列でないと選択肢が0個の問題になり、その問題から先へ進めなくなる
 */
export function normalizeImportedWord(
  raw: any,
  idPrefix: string,
  index: number,
  pool: Word[],
  random: () => number = Math.random
): Word | null {
  const word = typeof raw?.word === "string" ? raw.word.trim() : "";
  const translation = typeof raw?.translation === "string" ? raw.translation.trim() : "";
  if (!word || !translation) return null;

  const level: Level = VALID_LEVELS.includes(raw?.level) ? raw.level : "senior";

  // AIが付けてきた誤答に不適切な語が混ざっていたら使わない（足りない分は収録語から補う）
  const strList = (v: any): string[] =>
    Array.isArray(v)
      ? v.filter((x: any) => typeof x === "string" && x.trim() !== "" && !isOffensiveText(x))
      : [];

  // 誤選択肢を同じ品詞から選ぶために品詞を確定させる
  const pos: PartOfSpeech = VALID_POS.includes(raw?.pos)
    ? raw.pos
    : inferPartOfSpeech(word, translation);

  // 四択は「正解を必ず含む4件以上」を保証する
  let options = strList(raw?.options);
  if (!options.includes(translation)) options = [translation, ...options];
  if (options.length < 4) {
    const d = buildDistractors({ word, translation, level, pos }, pool, "translation", 3);
    options = shuffle([translation, ...d]);
  }

  let sentenceOptions = strList(raw?.sentenceOptions);
  if (!sentenceOptions.includes(word)) sentenceOptions = [word, ...sentenceOptions];
  if (sentenceOptions.length < 4) {
    const d = buildDistractors({ word, translation, level, pos }, pool, "word", 3);
    sentenceOptions = shuffle([word, ...d]);
  }

  let sentence = typeof raw?.sentence === "string" ? raw.sentence.trim() : "";
  let sentenceTranslation =
    typeof raw?.sentenceTranslation === "string" ? raw.sentenceTranslation.trim() : "";
  if (!sentence) {
    sentence = FALLBACK_SENTENCE;
    sentenceTranslation = FALLBACK_SENTENCE_JA;
  } else {
    // 末尾に穴を足すだけでは、本文に残った答えが出題画面に見えてしまう。
    // 答えのある位置を穴にする
    sentence = toFillInSentence(sentence, word);
  }

  const id = typeof raw?.id === "string" && raw.id.trim() !== ""
    ? raw.id
    : `${idPrefix}_${Date.now()}_${random().toString(36).substr(2, 5)}_${index}`;

  return {
    id,
    word,
    translation,
    level,
    options,
    sentence,
    sentenceTranslation,
    sentenceOptions,
    pos
  };
}

/**
 * 取り込んだ語を単語帳に足す。同じ綴りの語（大文字小文字は区別しない）は足さない。
 * `setVocabulary(prev => appendNewWords(prev, words))` の形で、**更新の時点の単語帳**に対して使う。
 *
 * 重複の確認を取り込みを始めた時点の単語帳（props の vocabulary）だけで行うと、
 * PDF の解析中に別の PDF・CSV・AI 追加が終わった場合に、どちらも相手の語を知らないまま
 * 同じ語を別の ID で2件登録していた。
 */
export function appendNewWords(prev: Word[], words: Word[]): Word[] {
  const seen = new Set(prev.map(w => w.word.toLowerCase()));
  const added: Word[] = [];
  for (const w of words) {
    const key = w.word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(w);
  }
  return added.length === 0 ? prev : [...prev, ...added];
}
