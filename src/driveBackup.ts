/**
 * Googleドライブ（アプリ専用の隠しフォルダ）への保存と読み出し。
 *
 * 置き場所は `appDataFolder`。利用者のドライブの一覧には出ず、容量も消費せず、
 * このアプリからしか読めない。**学習データはこちらのサーバーには一切送らない**
 * （プライバシーポリシーの「端末の中だけ」という約束を保つための選択）。
 *
 * 通信は `fetch` を差し替えられるようにしてある。
 * 実際のドライブに繋がずに、応答の形・失敗の扱いをテストで固定するため。
 */

/** ドライブに置くファイル名（appDataFolder の中なので衝突しない） */
export const DRIVE_FILE_NAME = "eitango-quest-backup.json";

/** 求める権限。アプリが自分で作ったファイルしか触れない */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

const FILES_API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

export interface DriveFile {
  id: string;
  name: string;
  /** ドライブ側の更新時刻（ISO 8601） */
  modifiedTime?: string;
}

/** 利用回数の上限（短い間に続けて保存した・1日の上限） */
const RATE_REASONS = ["userRateLimitExceeded", "rateLimitExceeded", "dailyLimitExceeded"];
/** ドライブの空き容量が無い */
const QUOTA_REASONS = ["storageQuotaExceeded", "quotaExceeded"];

/**
 * 呼び出し側が理由で分岐できるようにしたエラー。
 *
 * Google Drive API は、許可が足りないときだけでなく、利用回数の上限や容量切れでも 403 を返す。
 * 403 をまとめて「ログインし直して」と案内していたときは、続けて保存した・容量が尽きた人が
 * ログインを繰り返しても直らず、本当の原因が分からなかった（issue #115）。
 * 理由は応答の `error.errors[0].reason` にある。
 */
export class DriveError extends Error {
  constructor(message: string, readonly status: number, readonly reason: string = "") {
    super(message);
  }
  /** ログインし直しが要る（トークンが切れた・取り消された・権限が足りない） */
  get needsSignIn(): boolean {
    if (this.status === 401) return true;
    // ログインし直しても直らないと分かっている理由（回数の上限・容量切れ）だけを外す。
    // 許可系の理由は insufficientPermissions のほかにも appNotAuthorizedToFile などがあり、
    // 一覧で拾うと漏れたものが「接続できませんでした」だけになって、取れる手が無くなる
    return this.status === 403 && !RATE_REASONS.includes(this.reason) && !QUOTA_REASONS.includes(this.reason);
  }
  /** 利用者に見せる文言 */
  get userMessage(): string {
    if (this.needsSignIn) return "Googleドライブへの許可が切れています。もう一度ログインしてください。";
    if (this.status === 429 || RATE_REASONS.includes(this.reason)) {
      return "Googleドライブへの操作が続いたため、いったん断られました。少し時間をおいてから、もう一度お試しください。";
    }
    if (QUOTA_REASONS.includes(this.reason)) {
      return "Googleドライブの空き容量が足りません。ドライブの容量を空けてから、もう一度お試しください。";
    }
    if (this.status >= 500) {
      return "Googleドライブ側で一時的な問題が起きています。時間をおいて、もう一度お試しください。";
    }
    return `Googleドライブに接続できませんでした（${this.status}）。`;
  }
}

/** 失敗した応答から理由（`error.errors[0].reason`）を読む。読めなければ空 */
async function readDriveReason(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const reason = body?.error?.errors?.[0]?.reason;
    return typeof reason === "string" ? reason : "";
  } catch {
    return ""; // 本文が JSON でなくても、状態コードで扱う
  }
}

type FetchLike = typeof fetch;

async function callDrive(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  token: string
): Promise<Response> {
  const res = await fetchImpl(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new DriveError(`Drive API ${res.status}`, res.status, await readDriveReason(res));
  }
  return res;
}

/** 保存済みのバックアップを探す。無ければ null */
export async function findBackupFile(
  token: string,
  fetchImpl: FetchLike = fetch
): Promise<DriveFile | null> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    fields: "files(id,name,modifiedTime)",
    q: `name = '${DRIVE_FILE_NAME}'`,
    pageSize: "10",
    orderBy: "modifiedTime desc"
  });
  const res = await callDrive(fetchImpl, `${FILES_API}?${params}`, { method: "GET" }, token);
  const body = await res.json();
  const files = Array.isArray(body?.files) ? body.files : [];
  return files.length > 0 ? (files[0] as DriveFile) : null;
}

/** バックアップの中身を読む（JSON として解釈できなければ例外） */
export async function readBackupFile(
  token: string,
  fileId: string,
  fetchImpl: FetchLike = fetch
): Promise<unknown> {
  const res = await callDrive(
    fetchImpl,
    `${FILES_API}/${encodeURIComponent(fileId)}?alt=media`,
    { method: "GET" },
    token
  );
  return res.json();
}

/**
 * バックアップを書く。`fileId` があれば上書き、無ければ作る。
 *
 * 作成のときだけ置き場所（appDataFolder）を指定する必要があるため、
 * メタデータと中身をまとめて送る multipart を使う。
 */
export async function writeBackupFile(
  token: string,
  payload: unknown,
  fileId: string | null,
  fetchImpl: FetchLike = fetch
): Promise<DriveFile> {
  const boundary = "eitango-quest-boundary";
  const metadata = fileId
    ? { name: DRIVE_FILE_NAME }
    : { name: DRIVE_FILE_NAME, parents: ["appDataFolder"] };
  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${JSON.stringify(payload)}\r\n` +
    `--${boundary}--`;

  const url = fileId
    ? `${UPLOAD_API}/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id,name,modifiedTime`
    : `${UPLOAD_API}?uploadType=multipart&fields=id,name,modifiedTime`;

  const res = await callDrive(
    fetchImpl,
    url,
    {
      method: fileId ? "PATCH" : "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body
    },
    token
  );
  return (await res.json()) as DriveFile;
}
