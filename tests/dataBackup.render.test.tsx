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
  // Blob は new で呼ばれるので、差し替えはアロー関数にできない
  // （vitest 4 以降は「is not a constructor」で投げ、書き出しが失敗扱いになる）
  vi.spyOn(globalThis, "Blob").mockImplementation(function (parts: any[], options?: BlobPropertyBag) {
    text = String(parts[0]);
    return new OriginalBlob(parts, options);
  } as any);
  return () => JSON.parse(text);
}

/** ファイル選択の内容を読み込ませる */
/** 正しいバックアップの形にする（名札と版は書き出し側が必ず入れる） */
function backupFile(data: Record<string, string>) {
  return JSON.stringify({
    app: "eitango-quest",
    version: 1,
    exportedAt: "2026-10-02T00:00:00.000Z",
    data
  });
}

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

  it("ファイル名の日付は端末の暦日（日本の朝でも前日にならない）", async () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "Asia/Tokyo";
    // 日本時間 10/30 の朝7時半。UTC ではまだ 10/29
    vi.useFakeTimers({ now: new Date("2026-10-30T07:30:00+09:00").getTime(), toFake: ["Date"] });
    try {
      let name = "";
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
        name = this.download;
      });
      captureExport();
      renderBackup();
      screen.getByText(/エクスポート（書き出し）/).click();
      expect(name).toBe("eitango-quest-backup-2026-10-30.json");
    } finally {
      vi.useRealTimers();
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    }
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
    await importJson(backupFile({ quest_stats: '{"score":999}' }));

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
    await importJson(backupFile({ quest_stats: '{"score":999}' }));

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
    await importJson(backupFile({ quest_stats: "{}", "悪意のキー": "x" }));

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

  /**
   * 名札（app）と版（version）の無いJSONを断る。
   *
   * 書き戻しは載っているキーだけを触るので、通してしまうと
   * 「一部だけ空文字で消える」形になる。しかも画面には「復元しました」と出るため、
   * 利用者は学習の記録が消えたことに気づけない。
   */
  it("別のアプリのJSONを、学習データに触れずに断る", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    localStorage.setItem("quest_srs", '{"j1":{"box":3}}');
    renderBackup();
    await importJson(JSON.stringify({ data: { quest_srs: "" } }));

    expect(await screen.findByText(/ファイルの形式が正しくありません/)).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(localStorage.getItem("quest_srs")).toBe('{"j1":{"box":3}}');
  });

  it("中身が空のJSONも断る", async () => {
    localStorage.setItem("quest_srs", '{"j1":{"box":3}}');
    renderBackup();
    await importJson(JSON.stringify({ data: {} }));

    expect(await screen.findByText(/ファイルの形式が正しくありません/)).toBeInTheDocument();
    expect(localStorage.getItem("quest_srs")).toBe('{"j1":{"box":3}}');
  });

  it("新しい版のアプリが書き出したファイルは、理由を伝えて断る", async () => {
    // 型だけ見ていたときは通り、読めない形のまま書き戻して「復元しました」と出ていた
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    localStorage.setItem("quest_srs", '{"j1":{"box":3}}');
    renderBackup();
    await importJson(JSON.stringify({ app: "eitango-quest", version: 99, exportedAt: "", data: { quest_srs: "{}" } }));

    expect(await screen.findByText(/新しい版のアプリで保存されたため/)).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(localStorage.getItem("quest_srs")).toBe('{"j1":{"box":3}}');
  });

  it("容量が足りず書けなかったら、元に戻したことを伝える（新旧を混ぜない）", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    localStorage.setItem("quest_stats", '{"score":1}');
    const realSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === "quest_srs" && value === "{}") throw new Error("QuotaExceededError");
      return realSet.call(this, key, value);
    });
    renderBackup();
    await importJson(backupFile({ quest_stats: '{"score":999}', quest_srs: "{}" }));

    expect(await screen.findByText(/復元前の状態に戻しました/)).toBeInTheDocument();
    expect(localStorage.getItem("quest_stats")).toBe('{"score":1}');
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
