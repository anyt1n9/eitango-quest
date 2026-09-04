/**
 * 「ドライブへ保存」「ドライブから復元」の2つの操作。
 *
 * 自動で新しい方に寄せる（last-write-wins）ことはしない。
 * 端末を2台使っていると、片方で解いた分が黙って消える形になるため、
 * **どちらへ動かすかは利用者が選ぶ**（ファイルの書き出し・読み込みと同じ考え方）。
 * 画面には「ドライブに入っているものの日時」を出して、選ぶ材料にする。
 */
import {
  BackupPayload,
  buildBackupPayload,
  isBackupPayload,
  payloadTime
} from "./backupPayload";
import { findBackupFile, readBackupFile, writeBackupFile } from "./driveBackup";
import { writeStored } from "./storage";

/**
 * この端末でドライブ同期を使ったことがあるか、の印。
 *
 * これが無い端末では、画面を開いてもGoogleへは一切問い合わせない。
 * 使うつもりのない人の端末から、開いただけで外部へ通信が出るのを避けるため
 * （バックアップの対象外。別の端末に持っていくと、まだ許可していないのに
 * 問い合わせが出てしまう）。
 */
export const DRIVE_LINKED_KEY = "quest_drive_linked";

export function isDriveLinked(): boolean {
  try {
    return localStorage.getItem(DRIVE_LINKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markDriveLinked(): void {
  writeStored(DRIVE_LINKED_KEY, "1");
}

type FetchLike = typeof fetch;

/** ドライブに入っているバックアップの様子（無ければ null） */
export interface RemoteState {
  fileId: string;
  /** バックアップ自身が持つ書き出し時刻（ミリ秒）。読めなければ 0 */
  savedAt: number;
  /** 中身。形が違えば null（＝復元には使えない） */
  payload: BackupPayload | null;
}

/** ドライブの中身を見に行く */
export async function fetchRemote(
  token: string,
  fetchImpl: FetchLike = fetch
): Promise<RemoteState | null> {
  const file = await findBackupFile(token, fetchImpl);
  if (!file) return null;
  const raw = await readBackupFile(token, file.id, fetchImpl);
  const payload = isBackupPayload(raw) ? raw : null;
  return {
    fileId: file.id,
    savedAt: payload ? payloadTime(payload) : 0,
    payload
  };
}

/** いまの学習データをドライブへ書く（既にあれば上書き） */
export async function pushToDrive(
  token: string,
  fetchImpl: FetchLike = fetch,
  now: Date = new Date()
): Promise<BackupPayload> {
  const existing = await findBackupFile(token, fetchImpl);
  const payload = buildBackupPayload(now);
  await writeBackupFile(token, payload, existing ? existing.id : null, fetchImpl);
  return payload;
}
