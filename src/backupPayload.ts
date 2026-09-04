/**
 * バックアップの中身（学習データの一式）。
 *
 * 書き出し先が2つある（端末のファイル／Googleドライブ）ので、
 * 「何を集めて、どう戻すか」はここ1か所に置く。
 * 画面ごとに組み立てを書くと、片方にだけ新しいキーが入る・
 * 片方だけ復元の検査が甘い、といったずれが起きる。
 */
import { BACKUP_KEYS } from "./backupKeys";
import { writeStored } from "./storage";

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
    data[key] = localStorage.getItem(key);
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

/**
 * バックアップとして扱える形かどうか。
 *
 * ドライブから取ってきたものは、こちらが書いたとは限らない
 * （利用者が別のアプリで置き換えることもできる）ので、
 * ファイルから読んだときと同じだけ疑ってかかる。
 */
export function isBackupPayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<BackupPayload>;
  if (!v.data || typeof v.data !== "object" || Array.isArray(v.data)) return false;
  // 中身は「キー→文字列（または null）」だけを認める
  return Object.values(v.data).every(x => x === null || typeof x === "string");
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
 */
export function applyBackupPayload(payload: BackupPayload): { failed: string[] } {
  const failed: string[] = [];
  for (const key of BACKUP_KEYS) {
    const value = payload.data[key];
    if (typeof value === "string" && !writeStored(key, value)) failed.push(key);
  }
  return { failed };
}
