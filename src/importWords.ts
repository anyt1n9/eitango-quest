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
 *
 * 引用符として扱うのは**フィールドの先頭の `"`** だけ。途中の `"`（`5" pipe` のインチ記号など）は
 * 文字として残す。どこにあっても引用符の開始と見なしていたときは、そこから先の改行とカンマが
 * すべて引用符の中になり、ファイルの残り全部が1つのセルになっていた。1列の行は読み飛ばすので、
 * 前に正常な行があれば「N件登録しました」のまま残りの単語が黙って失われた（issue #118）。
 * 先頭の `"` が最後まで閉じられなかったとき（`"unterminated,x`）も同じことが起きるので、
 * その `"` を文字として読み直す。
 */
/** 閉じられなかった引用符を読み直す回数の上限（壊れたファイルで解析が何度も走らないように） */
const MAX_REPARSE = 20;

export function parseCSV(text: string): string[][] {
  // 閉じられなかった引用符の位置。ここは文字として読み直す（1回に1つずつ増えるので必ず止まる）
  const literalQuotes = new Set<number>();
  for (let n = 0; ; n++) {
    // 上限まで読み直しても閉じないものが残るファイルは、引用符をすべて文字として読む
    const { rows, unclosedAt } = parseCSVOnce(text, literalQuotes, n >= MAX_REPARSE);
    if (unclosedAt < 0) return rows;
    literalQuotes.add(unclosedAt);
  }
}

function parseCSVOnce(
  text: string,
  literalQuotes: Set<number>,
  quotesAsText = false
): { rows: string[][]; unclosedAt: number } {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let quoteStart = -1;
  let entry = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && !quotesAsText && !literalQuotes.has(i)) {
      if (inQuotes && nextChar === '"') {
        entry += '"';
        i++;
      } else if (inQuotes) {
        inQuotes = false;
      } else if (entry.trim() === "") {
        // フィールドの先頭（前に空白しか無い）の " だけを引用符の開始とする
        inQuotes = true;
        quoteStart = i;
      } else {
        entry += char;
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
  return {
    rows: lines.filter(r => r.length > 0 && r.some(c => c !== "")),
    unclosedAt: inQuotes ? quoteStart : -1
  };
}

/** CSV の文字コードを読み取れなかったときの文言 */
export const CSV_ENCODING_ERROR =
  "文字コードを読み取れませんでした。UTF-8 で保存し直してください（Excel なら「CSV UTF-8（コンマ区切り）」）。";

/**
 * CSV ファイルの中身（バイト列）を文字列にする。UTF-8 で読めなければ Shift_JIS で読む。
 *
 * 日本語版 Excel の「CSV（コンマ区切り）」は Shift_JIS で保存される。UTF-8 として読んでいたときは
 * 訳が置換文字（\uFFFD）だらけになり、それでも空ではないので取り込みを通り抜け、
 * 「N件登録しました」と表示されて文字化けした訳が単語帳に入り、四択の正解にもなった（issue #114）。
 * どちらも不正な並びで止まる読み方（fatal）にして、どちらでも読めなければ保存し直しを案内する。
 * 読めても置換文字が残っている（前に文字化けしたまま保存したファイル）ときも同じく止める。
 */
export function decodeCsvBytes(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  // UTF-16（Excel の「Unicode テキスト」）は BOM か NUL バイトで分かる。英字だけなら UTF-8 として
  // 読めてしまい、NUL の混ざった綴りが登録される。NUL はほかのバイナリ（xlsx など）でも出るので同じく断る
  const utf16Bom = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff);
  if (utf16Bom || bytes.includes(0)) throw new Error(CSV_ENCODING_ERROR);
  let text: string | null = null;
  for (const encoding of ["utf-8", "shift_jis"]) {
    try {
      text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
      break;
    } catch {
      // 次の文字コードを試す（Shift_JIS を扱えない環境では構築で投げる）
    }
  }
  if (text === null || text.includes("\uFFFD")) throw new Error(CSV_ENCODING_ERROR);
  return text;
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
