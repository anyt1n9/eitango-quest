import { writeStored } from "./storage";

/**
 * 背景に使う画像。
 *
 * 端末の中だけで完結させる（どこにも送らない）。localStorage に置くので、
 * 写真をそのまま入れると容量（多くのブラウザで5MB前後）を食いつぶし、
 * 学習の記録の保存まで巻き添えで失敗する。
 * そのため必ず縮小してから保存する。
 */

export const BG_IMAGE_KEY = "quest_bg_image";

/** 受け付ける形式。ここに無いものは画像として読めても断る */
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** 選べるファイルの上限。これより大きいものは縮小する前に断る */
export const MAX_FILE_BYTES = 12 * 1024 * 1024;

/** 縮小後の長辺（px）。端末の画面より大きい画像を持っていても意味がない */
export const MAX_EDGE = 1600;

/** 保存する文字列の上限。localStorage を学習の記録ごと圧迫しないための歯止め */
export const MAX_STORED_CHARS = 2_600_000;

export interface PickResult {
  ok: boolean;
  /** 保存できたときの画像（data URL） */
  dataUrl?: string;
  /** 断ったときの理由。そのまま画面に出せる文にする */
  error?: string;
}

/** 選ばれたファイルが背景に使えるかを見る（読み込む前の門番） */
export function checkFile(file: { type?: string; size?: number } | null | undefined): string | null {
  if (!file) return "画像が選ばれていません。";
  if (!ALLOWED.includes(String(file.type))) {
    return "この形式は使えません。JPEG・PNG・WebP・GIF の画像を選んでください。";
  }
  if (Number(file.size) > MAX_FILE_BYTES) {
    return `画像が大きすぎます（${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB まで）。`;
  }
  return null;
}

/** 長辺が MAX_EDGE を超えないような縮小後の大きさ */
export function fitSize(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) return { width, height };
  const ratio = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

/** 保存済みの背景画像。無ければ null */
export function readBackgroundImage(): string | null {
  try {
    const saved = localStorage.getItem(BG_IMAGE_KEY);
    return saved && saved.startsWith("data:image/") ? saved : null;
  } catch {
    return null;
  }
}

/** 背景画像を保存する。大きすぎるときは断る（保存の失敗も理由にして返す） */
export function saveBackgroundImage(dataUrl: string): PickResult {
  if (!dataUrl.startsWith("data:image/")) {
    return { ok: false, error: "画像として読み取れませんでした。" };
  }
  if (dataUrl.length > MAX_STORED_CHARS) {
    return { ok: false, error: "画像が大きすぎて保存できません。別の画像を選んでください。" };
  }
  if (!writeStored(BG_IMAGE_KEY, dataUrl)) {
    return { ok: false, error: "端末の保存容量が足りず、背景を保存できませんでした。" };
  }
  return { ok: true, dataUrl };
}

/** 背景画像を消して、もとの飾り（ジャングル・海）に戻す */
export function clearBackgroundImage(): void {
  try {
    localStorage.removeItem(BG_IMAGE_KEY);
  } catch {
    // 消せなくてもアプリは動き続ける
  }
}

/**
 * 画像ファイルを読み込み、長辺 MAX_EDGE まで縮めた JPEG の data URL にする。
 * canvas を使うのでブラウザでのみ動く。
 */
export function fileToScaledDataUrl(file: File, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("画像を読み込めませんでした。"));
      img.onload = () => {
        const { width, height } = fitSize(img.naturalWidth || img.width, img.naturalHeight || img.height);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("画像を縮小できませんでした。"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** 画像の上にかける幕の濃さ */
export type VeilLevel = "light" | "normal" | "strong";

export const VEIL_KEY = "quest_bg_veil";

/** 濃さの選択肢。画面に出す文言もここに持つ */
export const VEIL_CHOICES: { level: VeilLevel; label: string; note: string }[] = [
  { level: "light", label: "うすい", note: "画像がはっきり見える" },
  { level: "normal", label: "ふつう", note: "既定" },
  { level: "strong", label: "しっかり", note: "文字が読みやすい" }
];

export function readVeilLevel(): VeilLevel {
  try {
    const saved = localStorage.getItem(VEIL_KEY);
    return saved === "light" || saved === "strong" ? saved : "normal";
  } catch {
    return "normal";
  }
}

export function saveVeilLevel(level: VeilLevel): void {
  writeStored(VEIL_KEY, level);
}
