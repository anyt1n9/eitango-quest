import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * データ画面から見た「保存先の選択」。
 *
 * Googleドライブとファイルは**どちらも残す**。ドライブが使えない場面
 * （鍵を設定していない配布・ログインを断った・iOSでポップアップが戻らない）
 * でも、ファイルでの持ち運びが必ずできることを固定する。
 * ここが片方に寄ると、そのまま「進捗が移せない」になる。
 */

const requestDriveToken = vi.fn();
const isGoogleSyncConfigured = vi.fn();
vi.mock("../src/googleAuth", () => ({
  isGoogleSyncConfigured: () => isGoogleSyncConfigured(),
  requestDriveToken: (o?: unknown) => requestDriveToken(o)
}));

const fetchRemote = vi.fn();
const pushToDrive = vi.fn();
const DRIVE_LINKED_KEY = "quest_drive_linked";
vi.mock("../src/driveSync", async () => {
  const actual = await vi.importActual<typeof import("../src/driveSync")>("../src/driveSync");
  return {
    ...actual,
    fetchRemote: (...a: unknown[]) => fetchRemote(...a),
    pushToDrive: (...a: unknown[]) => pushToDrive(...a)
  };
});

import DataBackup from "../src/components/DataBackup";
import { BACKUP_KEYS } from "../src/backupKeys";

function renderBackup() {
  render(<DataBackup dailyGoal={20} setDailyGoal={vi.fn()} onBackToDashboard={vi.fn()} />);
}

const payload = (savedAt: string, data: Record<string, string> = { quest_stats: '{"score":50}' }) => ({
  app: "eitango-quest", version: 1, exportedAt: savedAt, data
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  isGoogleSyncConfigured.mockReturnValue(true);
  requestDriveToken.mockResolvedValue("tok");
  fetchRemote.mockResolvedValue(null);
  pushToDrive.mockResolvedValue(payload("2026-09-01T03:04:00.000Z"));
});

afterEach(() => cleanup());

describe("保存先の選択", () => {
  it("ドライブとファイルの両方を出す", async () => {
    renderBackup();
    await waitFor(() => expect(document.getElementById("drive_sync_section")).toBeTruthy());
    expect(document.getElementById("btn_drive_push")).toBeTruthy();
    expect(document.getElementById("btn_drive_pull")).toBeTruthy();
    expect(screen.getByText(/エクスポート（書き出し）/)).toBeTruthy();
    expect(screen.getByText(/インポート（復元）/)).toBeTruthy();
  });

  it("鍵を設定していない配布では、ドライブの欄は出さず、ファイルは残す", async () => {
    isGoogleSyncConfigured.mockReturnValue(false);
    renderBackup();
    expect(document.getElementById("drive_sync_section")).toBeNull();
    // 押しても必ず失敗するボタンを見せない
    expect(document.getElementById("btn_drive_push")).toBeNull();
    // ファイルでの持ち運びは変わらず使える
    expect(screen.getByText(/エクスポート（書き出し）/)).toBeTruthy();
    expect(requestDriveToken).not.toHaveBeenCalled();
  });
});

describe("ドライブへ保存", () => {
  it("押すと保存し、最終保存の日時を出す", async () => {
    const user = userEvent.setup();
    renderBackup();
    await waitFor(() => expect(document.getElementById("btn_drive_push")).toBeTruthy());

    await user.click(document.getElementById("btn_drive_push")!);
    await waitFor(() => expect(pushToDrive).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Googleドライブに学習データを保存しました/)).toBeTruthy();
    expect(document.getElementById("drive_saved_at")!.textContent).toMatch(/2026\/09\/01/);
    // 次からは開いたときに日時を見に行ってよい端末になる
    expect(localStorage.getItem(DRIVE_LINKED_KEY)).toBe("1");
  });

  it("ログインできなければ理由を出し、学習データには触らない", async () => {
    const user = userEvent.setup();
    requestDriveToken.mockRejectedValue(new Error("Googleのログインを完了できませんでした。"));
    localStorage.setItem("quest_stats", '{"score":1}');
    renderBackup();
    await waitFor(() => expect(document.getElementById("btn_drive_push")).toBeTruthy());

    await user.click(document.getElementById("btn_drive_push")!);
    expect(await screen.findByText(/ログインを完了できませんでした/)).toBeTruthy();
    expect(pushToDrive).not.toHaveBeenCalled();
    expect(localStorage.getItem("quest_stats")).toBe('{"score":1}');
  });
});

describe("ドライブから復元", () => {
  it("上書きの前に確かめ、断れば何も変えない", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fetchRemote.mockResolvedValue({ fileId: "f1", savedAt: Date.parse("2026-09-01T00:00:00Z"), payload: payload("2026-09-01T00:00:00.000Z") });
    localStorage.setItem("quest_stats", '{"score":1}');
    renderBackup();
    await waitFor(() => expect(document.getElementById("btn_drive_pull")).toBeTruthy());

    await user.click(document.getElementById("btn_drive_pull")!);
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(localStorage.getItem("quest_stats")).toBe('{"score":1}');
  });

  it("承知すればドライブの中身で置き換える", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
    fetchRemote.mockResolvedValue({
      fileId: "f1",
      savedAt: Date.parse("2026-09-01T00:00:00Z"),
      payload: payload("2026-09-01T00:00:00.000Z", { quest_stats: '{"score":999}' })
    });
    localStorage.setItem("quest_stats", '{"score":1}');
    renderBackup();
    await waitFor(() => expect(document.getElementById("btn_drive_pull")).toBeTruthy());

    await user.click(document.getElementById("btn_drive_pull")!);
    await waitFor(() => expect(localStorage.getItem("quest_stats")).toBe('{"score":999}'));
    expect(reload).toHaveBeenCalled();
  });

  it("ドライブが空なら、そう伝えて上書きしない", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchRemote.mockResolvedValue(null);
    localStorage.setItem("quest_stats", '{"score":1}');
    renderBackup();
    await waitFor(() => expect(document.getElementById("btn_drive_pull")).toBeTruthy());

    await user.click(document.getElementById("btn_drive_pull")!);
    expect(await screen.findByText(/まだ何も保存されていません/)).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
    expect(localStorage.getItem("quest_stats")).toBe('{"score":1}');
  });

  it("中身が壊れていれば、そう伝えて上書きしない", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchRemote.mockResolvedValue({ fileId: "f1", savedAt: 0, payload: null });
    localStorage.setItem("quest_stats", '{"score":1}');
    renderBackup();
    await waitFor(() => expect(document.getElementById("btn_drive_pull")).toBeTruthy());

    await user.click(document.getElementById("btn_drive_pull")!);
    expect(await screen.findByText(/読めませんでした/)).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
    expect(localStorage.getItem("quest_stats")).toBe('{"score":1}');
  });
});

describe("開いたときの下見", () => {
  it("使ったことのない端末では、Googleへ一切問い合わせない", async () => {
    // 同期を使うつもりのない人の端末から、開いただけで外部へ通信が出るのを避ける
    renderBackup();
    await waitFor(() => expect(document.getElementById("btn_drive_push")).toBeTruthy());
    expect(requestDriveToken).not.toHaveBeenCalled();
    expect(fetchRemote).not.toHaveBeenCalled();
    expect(document.getElementById("drive_saved_at")!.textContent).toMatch(/ログインすると確認できます/);
  });

  it("一度使った端末では、許可済みなら日時だけ見に行く（許可の画面は出さない）", async () => {
    localStorage.setItem(DRIVE_LINKED_KEY, "1");
    fetchRemote.mockResolvedValue({ fileId: "f1", savedAt: Date.parse("2026-08-30T10:20:00Z"), payload: payload("2026-08-30T10:20:00.000Z") });
    renderBackup();
    await waitFor(() =>
      expect(document.getElementById("drive_saved_at")!.textContent).toMatch(/2026\/08\/30/)
    );
    expect(requestDriveToken).toHaveBeenCalledWith({ silent: true });
  });

  it("未ログインなら黙って何も出さない（勝手にポップアップを出さない）", async () => {
    localStorage.setItem(DRIVE_LINKED_KEY, "1");
    requestDriveToken.mockRejectedValue(new Error("not signed in"));
    renderBackup();
    await waitFor(() => expect(requestDriveToken).toHaveBeenCalled());
    expect(screen.queryByText(/not signed in/)).toBeNull();
    expect(document.getElementById("drive_saved_at")!.textContent).toMatch(/ログインすると確認できます/);
  });
});

describe("バックアップの中身", () => {
  it("ドライブへ送るものも、ファイルと同じ全キーぶん", async () => {
    const user = userEvent.setup();
    for (const key of BACKUP_KEYS) localStorage.setItem(key, `v-${key}`);
    renderBackup();
    await waitFor(() => expect(document.getElementById("btn_drive_push")).toBeTruthy());
    await user.click(document.getElementById("btn_drive_push")!);
    await waitFor(() => expect(pushToDrive).toHaveBeenCalled());
    // 中身の組み立ては buildBackupPayload に一本化してあるので、
    // ここでは「画面が独自に集め直していない」ことだけを見る
    expect(pushToDrive).toHaveBeenCalledWith("tok");
  });
});
