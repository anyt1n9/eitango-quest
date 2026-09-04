import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  DRIVE_FILE_NAME, DRIVE_SCOPE, DriveError,
  findBackupFile, readBackupFile, writeBackupFile
} from "../src/driveBackup";
import { fetchRemote, pushToDrive } from "../src/driveSync";
import { BACKUP_KEYS } from "../src/backupKeys";
import { buildBackupPayload, isBackupPayload, payloadTime, applyBackupPayload } from "../src/backupPayload";

/**
 * Googleドライブへの保存・読み出し。
 *
 * 学習記録の引っ越し先なので、ここが崩れると「別の端末で続きから」が
 * できなくなる。実際のドライブには繋がず、`fetch` を差し替えて
 *   - どのURLへ、どの権限で投げているか
 *   - 置き場所（appDataFolder）を間違えていないか
 *   - 壊れた中身・許可切れをどう扱うか
 * を固定する。通信の成否より、**取り違えて学習データを壊さないこと**が要点。
 */

/** localStorage の最小実装（node 環境には無い） */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
}
const store = new MemoryStorage();
(globalThis as any).localStorage = store;
afterAll(() => { delete (globalThis as any).localStorage; });
beforeEach(() => store.clear());

/** 呼ばれたURLと中身を控える fetch */
function stubFetch(handlers: ((url: string, init: any) => any | undefined)[]) {
  const calls: { url: string; init: any }[] = [];
  const impl = vi.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    for (const h of handlers) {
      const r = h(String(url), init);
      if (r) return r;
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("ドライブの置き場所と権限", () => {
  it("求める権限はアプリ専用フォルダだけ（ドライブ全体を読まない）", () => {
    expect(DRIVE_SCOPE).toBe("https://www.googleapis.com/auth/drive.appdata");
  });

  it("探すのは appDataFolder の中だけ", async () => {
    const { impl, calls } = stubFetch([(url) => url.includes("/drive/v3/files?") ? okJson({ files: [] }) : undefined]);
    await findBackupFile("tok", impl);
    const url = calls[0].url;
    expect(url).toContain("spaces=appDataFolder");
    expect(url).toContain(encodeURIComponent(DRIVE_FILE_NAME));
    expect(calls[0].init.headers.Authorization).toBe("Bearer tok");
  });

  it("初回の保存では appDataFolder に作る", async () => {
    const { impl, calls } = stubFetch([
      (url) => url.includes("/drive/v3/files?") ? okJson({ files: [] }) : undefined,
      (url) => url.includes("/upload/") ? okJson({ id: "f1", name: DRIVE_FILE_NAME }) : undefined
    ]);
    store.setItem("quest_stats", '{"score":10}');
    await pushToDrive("tok", impl);
    const upload = calls.find(c => c.url.includes("/upload/"))!;
    expect(upload.init.method).toBe("POST");
    expect(String(upload.init.body)).toContain('"parents":["appDataFolder"]');
    // 学習データがそのまま入っている
    expect(String(upload.init.body)).toContain('{\\"score\\":10}');
  });

  it("2回目からは同じファイルを上書きする（増やさない）", async () => {
    const { impl, calls } = stubFetch([
      (url) => url.includes("/drive/v3/files?") ? okJson({ files: [{ id: "f1", name: DRIVE_FILE_NAME }] }) : undefined,
      (url) => url.includes("/upload/") ? okJson({ id: "f1", name: DRIVE_FILE_NAME }) : undefined
    ]);
    await pushToDrive("tok", impl);
    const upload = calls.find(c => c.url.includes("/upload/"))!;
    expect(upload.init.method).toBe("PATCH");
    expect(upload.url).toContain("/files/f1");
    expect(String(upload.init.body)).not.toContain("parents");
  });

  it("保存したものは、そのまま学習データとして戻せる形になっている", async () => {
    const { impl } = stubFetch([
      (url) => url.includes("/drive/v3/files?") ? okJson({ files: [] }) : undefined,
      (url) => url.includes("/upload/") ? okJson({ id: "f1", name: DRIVE_FILE_NAME }) : undefined
    ]);
    for (const key of BACKUP_KEYS) store.setItem(key, `v-${key}`);
    const payload = await pushToDrive("tok", impl);
    expect(isBackupPayload(payload)).toBe(true);
    expect(Object.keys(payload.data).sort()).toEqual([...BACKUP_KEYS].sort());
  });
});

describe("ドライブから取ってくる", () => {
  it("入っていなければ null（＝復元するものが無い）", async () => {
    const { impl } = stubFetch([(url) => url.includes("/drive/v3/files?") ? okJson({ files: [] }) : undefined]);
    expect(await fetchRemote("tok", impl)).toBeNull();
  });

  it("中身と保存時刻を返す", async () => {
    const payload = { app: "eitango-quest", version: 1, exportedAt: "2026-09-01T00:00:00.000Z", data: { quest_stats: "{}" } };
    const { impl } = stubFetch([
      (url) => url.includes("/drive/v3/files?") ? okJson({ files: [{ id: "f1", name: DRIVE_FILE_NAME }] }) : undefined,
      (url) => url.includes("alt=media") ? okJson(payload) : undefined
    ]);
    const remote = await fetchRemote("tok", impl);
    expect(remote!.fileId).toBe("f1");
    expect(remote!.savedAt).toBe(Date.parse("2026-09-01T00:00:00.000Z"));
    expect(remote!.payload).toEqual(payload);
  });

  it("形が違うものは中身として受け取らない（学習データを壊さない）", async () => {
    for (const broken of [{ note: "別のアプリのファイル" }, { data: [1, 2, 3] }, { data: { quest_stats: 42 } }, null]) {
      const { impl } = stubFetch([
        (url) => url.includes("/drive/v3/files?") ? okJson({ files: [{ id: "f1", name: DRIVE_FILE_NAME }] }) : undefined,
        (url) => url.includes("alt=media") ? okJson(broken) : undefined
      ]);
      const remote = await fetchRemote("tok", impl);
      expect(remote!.payload, JSON.stringify(broken)).toBeNull();
      expect(remote!.savedAt).toBe(0);
    }
  });

  it("許可が切れていれば、それと分かる形で失敗する", async () => {
    for (const status of [401, 403]) {
      const { impl } = stubFetch([() => ({ ok: false, status, json: async () => ({}) })]);
      const err = await findBackupFile("tok", impl).catch(e => e);
      expect(err).toBeInstanceOf(DriveError);
      expect((err as DriveError).needsSignIn).toBe(true);
    }
  });

  it("通信そのものの失敗は、ログインし直しとは区別する", async () => {
    const { impl } = stubFetch([() => ({ ok: false, status: 500, json: async () => ({}) })]);
    const err = await readBackupFile("tok", "f1", impl).catch(e => e);
    expect(err).toBeInstanceOf(DriveError);
    expect((err as DriveError).needsSignIn).toBe(false);
  });
});

describe("ファイルとドライブで同じものを扱う", () => {
  it("書き出しの中身は、どちらの経路でも同じ", () => {
    for (const key of BACKUP_KEYS) store.setItem(key, `v-${key}`);
    const a = buildBackupPayload(new Date("2026-09-01T00:00:00Z"));
    const b = buildBackupPayload(new Date("2026-09-01T00:00:00Z"));
    expect(a).toEqual(b);
    expect(payloadTime(a)).toBe(Date.parse("2026-09-01T00:00:00Z"));
  });

  it("戻すと、保存していた値がそのまま入る", () => {
    for (const key of BACKUP_KEYS) store.setItem(key, `v-${key}`);
    const payload = buildBackupPayload();
    store.clear();
    const { failed } = applyBackupPayload(payload);
    expect(failed).toEqual([]);
    for (const key of BACKUP_KEYS) expect(store.getItem(key)).toBe(`v-${key}`);
  });

  it("保存されていなかったキーは、空文字で上書きしない", () => {
    store.setItem("quest_stats", '{"score":1}');
    const payload = buildBackupPayload();      // 他のキーは null
    store.setItem("quest_srs", "{}");          // 戻す前に別の端末で増えた分
    applyBackupPayload(payload);
    expect(store.getItem("quest_srs")).toBe("{}");
  });

  it("時刻が読めないバックアップは 0 として扱う（新旧を偽らない）", () => {
    expect(payloadTime({ app: "x", version: 1, exportedAt: "", data: {} })).toBe(0);
    expect(payloadTime({ app: "x", version: 1, exportedAt: "きのう", data: {} })).toBe(0);
  });
});

describe("writeBackupFile の中身", () => {
  it("multipart の境界と本文の順序が壊れていない", async () => {
    const { impl, calls } = stubFetch([(url) => url.includes("/upload/") ? okJson({ id: "f1", name: DRIVE_FILE_NAME }) : undefined]);
    await writeBackupFile("tok", { hello: "world" }, null, impl);
    const body = String(calls[0].init.body);
    const boundary = calls[0].init.headers["Content-Type"].split("boundary=")[1];
    expect(body.startsWith(`--${boundary}\r\n`)).toBe(true);
    expect(body.endsWith(`--${boundary}--`)).toBe(true);
    // メタデータ → 中身 の順
    expect(body.indexOf('"name"')).toBeLessThan(body.indexOf('"hello"'));
  });
});
