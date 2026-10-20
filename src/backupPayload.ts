/**
 * バックアップの中身（学習データの一式）。
 *
 * 書き出し先が2つある（端末のファイル／Googleドライブ）ので、
 * 「何を集めて、どう戻すか」はここ1か所に置く。
 * 画面ごとに組み立てを書くと、片方にだけ新しいキーが入る・
 * 片方だけ復元の検査が甘い、といったずれが起きる。
 */
import { BACKUP_KEYS } from "./backupKeys";
import { readStoredString, removeStored, writeStored } from "./storage";

export const BACKUP_APP = "eitango-quest";
export const BACKUP_VERSION = 1;

export interface BackupPayload {
  app: string;
  version: number;
  /** 書き出した時刻（ISO 8601）。ドライブ側との新旧の比較にも使う */
  exportedAt: string;
  data: Record<string, string | null>;
}

/** いまの学習データを集める */
export function buildBackupPayload(now: Date = new Date()): BackupPayload {
  const data: Record<string, string | null> = {};
  for (const key of BACKUP_KEYS) {
    // 生の localStorage.getItem は、保存を塞いだ環境では例外を投げる
    data[key] = readStoredString(key);
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

/**
 * バックアップとして扱える形かどうか。
 *
 * ドライブから取ってきたものは、こちらが書いたとは限らない
 * （利用者が別のアプリで置き換えることもできる）ので、
 * ファイルから読んだときと同じだけ疑ってかかる。
 *
 * **名札（`app`）と版（`version`）を必ず見ること。**
 * 中身の形だけを見ていたときは、`{"data":{"quest_srs":""}}` のような
 * 無関係なJSONでも通ってしまい、復習の期日が空文字で黙って上書きされた。
 * 書き戻しは `applyBackupPayload()` が載っているキーだけを触るので
 * 「一部だけ消える」形になり、画面には「復元しました」と出る。
 * 利用者は学習の記録が消えたことに気づけない。
 *
 * 版は「数であること」だけでなく、**この版のアプリが読める範囲か**まで見る。
 * 型しか見ていなかったときは、新しい版のアプリが書き出した（形式の変わった）
 * バックアップも通り、古い版の端末で「ドライブから復元」すると
 * 読めない形のまま書き戻して「復元しました」と出ていた。
 * 新しすぎるものは `isNewerBackup()` で見分けて、アプリの更新を促す。
 */
export function isBackupPayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<BackupPayload>;
  if (v.app !== BACKUP_APP || !isReadableVersion(v.version)) return false;
  if (!v.data || typeof v.data !== "object" || Array.isArray(v.data)) return false;
  // 中身は「キー→文字列（または null）」だけを認める
  return Object.values(v.data).every(x => x === null || typeof x === "string");
}

/** この版のアプリが読める版か（1 から BACKUP_VERSION までの整数） */
function isReadableVersion(version: unknown): boolean {
  return Number.isInteger(version) && (version as number) >= 1 && (version as number) <= BACKUP_VERSION;
}

/**
 * このアプリのバックアップだが、この版より新しい版で書き出されたもの。
 * 復元はできないので、理由（アプリが古い）を利用者に伝えるために使う。
 */
export function isNewerBackup(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<BackupPayload>;
  return v.app === BACKUP_APP && Number.isInteger(v.version) && (v.version as number) > BACKUP_VERSION;
}

/**
 * 書き出した時刻をミリ秒で返す（比べられないときは 0）。
 * ドライブと端末のどちらが新しいかを利用者に見せるために使う。
 */
export function payloadTime(payload: BackupPayload): number {
  const t = Date.parse(payload.exportedAt ?? "");
  return Number.isNaN(t) ? 0 : t;
}

/**
 * 学習データを書き戻す。保存できなかったキーを返す。
 *
 * writeStored は容量超過でも例外を投げないので、戻り値で確かめる。
 * 確かめずに画面を作り直すと、一部しか戻っていないのに
 * 「復元できた」と伝えてしまう。
 *
 * **1件でも書けなかったら、書き込む前の状態へ戻す。**
 * キーを1件ずつ上書きするので、途中で容量が尽きると、それまでのキーは
 * バックアップの内容・それ以降のキーは元の端末の内容、という混ざった状態が残る
 * （復習の期日だけ戻り、解答履歴は古いまま、など）。
 * 書き込む前の値を控えておき、失敗したら控えから戻す。
 * 戻しきれなかったキーは `notRestored` で返す（画面で別の文言にする）。
 *
 * バックアップに値が無い（null の）キーには触らない。
 * 元の端末で使っていなかった機能の進捗を、空で消してしまわないため。
 */
export function applyBackupPayload(payload: BackupPayload): { failed: string[]; notRestored: string[] } {
  const before = new Map<string, string | null>();
  for (const key of BACKUP_KEYS) before.set(key, readStoredString(key));

  const failed: string[] = [];
  const written: string[] = [];
  for (const key of BACKUP_KEYS) {
    const value = payload.data[key];
    if (typeof value !== "string") continue;
    if (writeStored(key, value)) written.push(key);
    else failed.push(key);
  }
  if (failed.length === 0) return { failed, notRestored: [] };

  // 途中までの書き換えを元に戻す（新旧が混ざった状態を残さない）。
  // 書けなかったキーは元の値のままなので、書けたキーだけを戻す
  const notRestored: string[] = [];
  for (const key of written) {
    const old = before.get(key) ?? null;
    const ok = old === null ? removeStored(key) : writeStored(key, old);
    if (!ok) notRestored.push(key);
  }
  return { failed, notRestored };
}
