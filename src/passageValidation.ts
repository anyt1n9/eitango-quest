import { Passage, PassageQuestion } from "./data/passages";
import { Level } from "./types";

/**
 * localStorage から読み込んだ長文データの検証。
 *
 * `readStoredArray` は「配列であること」しか見ていないため、
 * 中身が壊れていても素通りする。長文は AI 生成のものを保存しており、
 * バックアップの復元・手動編集・古い形式の残骸で要素が欠けうる。
 * 欠けたまま描画すると `p.englishParagraphs.map(...)` などで例外が投げられ、
 * 一覧を開いた時点でエラー画面になる。
 *
 * ここでは壊れた要素を落とすのではなく、描画に必要な形へ整えることを優先する。
 * 利用者から見れば「AIに書かせた長文が黙って消える」方が困るため、
 * 直せるものは直し、本文が無いものだけを捨てる。
 */

const LEVELS: Level[] = ["junior", "senior", "senior2", "senior3", "advanced"];

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "") : [];

/** 理解度チェックの設問を整える。選択肢が2つ未満のものや正解位置が壊れたものは捨てる */
function sanitizeQuestions(v: unknown): PassageQuestion[] {
  if (!Array.isArray(v)) return [];
  const out: PassageQuestion[] = [];
  for (const q of v) {
    if (!q || typeof q !== "object") continue;
    const question = typeof (q as any).question === "string" ? (q as any).question : "";
    const options = strings((q as any).options);
    const correctIndex = (q as any).correctIndex;
    if (!question.trim() || options.length < 2) continue;
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) continue;
    out.push({ question, options, correctIndex });
  }
  return out;
}

/** ハイライト語を整える。word か translation が欠けたものは捨てる */
function sanitizeHighlights(v: unknown): { word: string; translation: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(h => h && typeof h === "object"
      && typeof (h as any).word === "string" && (h as any).word.trim() !== ""
      && typeof (h as any).translation === "string")
    .map(h => ({ word: (h as any).word, translation: (h as any).translation }));
}

/**
 * 1件の長文を描画できる形に整える。
 * 英文の本文が1段落も無いものは長文として成立しないため null を返す。
 */
export function sanitizePassage(raw: unknown, index = 0): Passage | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;

  const englishParagraphs = strings(p.englishParagraphs);
  if (englishParagraphs.length === 0) return null;

  // 和訳が英文より少ない場合は空文字で補い、段落の対応がずれないようにする
  const japanese = strings(p.japaneseParagraphs);
  const japaneseParagraphs = englishParagraphs.map((_, i) => japanese[i] ?? "");

  const level = LEVELS.includes(p.level as Level) ? (p.level as Level) : "junior";
  const reward = typeof p.pointReward === "number" && Number.isFinite(p.pointReward) && p.pointReward > 0
    ? Math.round(p.pointReward)
    : 100;

  return {
    // id が欠けていると読了管理（読了IDの配列）が壊れるため、必ず何か割り当てる
    id: typeof p.id === "string" && p.id.trim() !== "" ? p.id : `restored_${index}`,
    level,
    title: typeof p.title === "string" && p.title.trim() !== "" ? p.title : "無題の長文",
    englishParagraphs,
    japaneseParagraphs,
    vocabularyHighlight: sanitizeHighlights(p.vocabularyHighlight),
    description: typeof p.description === "string" ? p.description : "",
    pointReward: reward,
    questions: sanitizeQuestions(p.questions)
  };
}

/** 長文の配列を整える。壊れて直せない要素は取り除く */
export function sanitizePassages(raw: unknown): Passage[] {
  if (!Array.isArray(raw)) return [];
  const out: Passage[] = [];
  const seenIds = new Set<string>();
  raw.forEach((item, i) => {
    const p = sanitizePassage(item, i);
    if (!p) return;
    // id が重複すると読了状態が別の長文に伝染するため、後勝ちで付け直す
    if (seenIds.has(p.id)) p.id = `${p.id}_${i}`;
    seenIds.add(p.id);
    out.push(p);
  });
  return out;
}
