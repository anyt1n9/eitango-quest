import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DataBackup from "../src/components/DataBackup";
import { BACKUP_KEYS } from "../src/backupKeys";

/**
 * 学習データの書き出しと読み込み。
 *
 * 端末を移すときの唯一の手段なので、ここの不具合は
 * 「進捗が消えた」「戻したつもりが戻っていない」に直結する。
 * 一覧そのもの（quest_ で始まる保存キーの取りこぼし）は
 * tests/dataBackup.test.ts が機械的に突き合わせる。
 * ここでは画面から操作したときの挙動を見る。
 */

function renderBackup(onBackToDashboard = vi.fn()) {
  const setDailyGoal = vi.fn();
  render(
    <DataBackup dailyGoal={20} setDailyGoal={setDailyGoal} onBackToDashboard={onBackToDashboard} />
  );
  return { setDailyGoal, onBackToDashboard };
}

/** 書き出しでできた JSON を受け取る */
function captureExport(): () => any {
  let text = "";
  const OriginalBlob = globalThis.Blob;
  vi.spyOn(globalThis, "Blob").mockImplementation(((parts: any[]) => {
    text = String(parts[0]);
    return new OriginalBlob(parts);
  }) as any);
  return () => JSON.parse(text);
}

/** ファイル選択の内容を読み込ませる */
async function importJson(body: string) {
  const user = userEvent.setup();
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([body], "backup.json", { type: "application/json" });
  await user.upload(input, file);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("書き出し", () => {
  it("バックアップ対象のキーをすべて含める", async () => {
    const user = userEvent.setup();
    const read = captureExport();
    localStorage.setItem("quest_stats", JSON.stringify({ score: 120 }));
    renderBackup();

    await user.click(screen.getByText(/エクスポート（書き出し）/));
    const payload = read();
    expect(payload.app).toBe("eitango-quest");
    expect(Object.keys(payload.data).sort()).toEqual([...BACKUP_KEYS].sort());
    expect(payload.data.quest_stats).toContain("120");
  });

  it("書き出したと伝える", async () => {
    const user = userEvent.setup();
    captureExport();
    renderBackup();
    await user.click(screen.getByText(/エクスポート（書き出し）/));
    expect(screen.getByText(/書き出しました/)).toBeInTheDocument();
  });
});

describe("読み込み", () => {
  it("上書きの前に確かめる", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderBackup();
    await importJson(JSON.stringify({ data: { quest_stats: '{"score":999}' } }));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    // 取り消したら書き換えない
    expect(localStorage.getItem("quest_stats")).toBeNull();
  });

  it("承諾したら書き戻す", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    // 復元後のリロードは jsdom では動かないので差し替える
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, reload }
    });
    renderBackup();
    await importJson(JSON.stringify({ data: { quest_stats: '{"score":999}' } }));

    await waitFor(() => expect(localStorage.getItem("quest_stats")).toBe('{"score":999}'));
    expect(reload).toHaveBeenCalled();
  });

  it("知らないキーは書き戻さない", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, reload: vi.fn() }
    });
    renderBackup();
    await importJson(JSON.stringify({ data: { quest_stats: "{}", "悪意のキー": "x" } }));

    await waitFor(() => expect(localStorage.getItem("quest_stats")).toBe("{}"));
    expect(localStorage.getItem("悪意のキー")).toBeNull();
  });

  it("形式が違うファイルは断る", async () => {
    renderBackup();
    await importJson("これはJSONではありません");
    expect(await screen.findByText(/ファイルの形式が正しくありません/)).toBeInTheDocument();
  });

  it("data の無いJSONも断る", async () => {
    renderBackup();
    await importJson(JSON.stringify({ app: "eitango-quest" }));
    expect(await screen.findByText(/ファイルの形式が正しくありません/)).toBeInTheDocument();
  });
});

describe("1日の目標", () => {
  it("保存できる", async () => {
    const user = userEvent.setup();
    const { setDailyGoal } = renderBackup();
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "35");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(setDailyGoal).toHaveBeenCalledWith(35);
  });

  it("極端な値は範囲に収める", async () => {
    const user = userEvent.setup();
    const { setDailyGoal } = renderBackup();
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "9999");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(setDailyGoal).toHaveBeenCalledWith(500);
  });
});
