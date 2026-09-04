import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Download, Upload, Target, Database, ShieldCheck, AlertTriangle, Cloud, CloudDownload, RefreshCw } from "lucide-react";
import { applyBackupPayload, buildBackupPayload, isBackupPayload, payloadTime } from "../backupPayload";
import { isGoogleSyncConfigured, requestDriveToken } from "../googleAuth";
import { DriveError } from "../driveBackup";
import { fetchRemote, isDriveLinked, markDriveLinked, pushToDrive } from "../driveSync";

interface DataBackupProps {
  dailyGoal: number;
  setDailyGoal: (n: number) => void;
  onBackToDashboard: () => void;
}

/** 復元しきれなかったときの文言（ファイル・ドライブで同じ） */
function restoreFailedText(count: number): string {
  return `一部のデータを復元できませんでした（${count}件）。保存容量が足りない可能性があります。不要な単語や長文を削除してから、もう一度お試しください。`;
}

/** 「2026/09/01 12:34」の形にする（比べる材料として出すだけなので端末の時刻で十分） */
function formatTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function DataBackup({ dailyGoal, setDailyGoal, onBackToDashboard }: DataBackupProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [goalInput, setGoalInput] = useState<number>(dailyGoal);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  /*
   * Googleドライブ同期。
   *
   * クライアントIDが設定されていない配布では、この欄ごと出さない
   * （押しても必ず失敗するボタンを見せる方が分かりにくい）。
   * ファイルでの書き出し・読み込みは、設定の有無にかかわらず常に使える。
   */
  const driveAvailable = isGoogleSyncConfigured();
  const [driveBusy, setDriveBusy] = useState<"" | "push" | "pull" | "check">("");
  /** ドライブに入っているものの日時。null = 未確認、0 = 何も入っていない */
  const [driveSavedAt, setDriveSavedAt] = useState<number | null>(null);

  // すべての学習データを JSON ファイルとしてダウンロード
  const handleExport = () => {
    try {
      const payload = buildBackupPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eitango-quest-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ type: "ok", text: "学習データをバックアップファイルとして書き出しました。" });
    } catch (e) {
      setMessage({ type: "error", text: "エクスポートに失敗しました。" });
    }
  };

  // バックアップファイルを読み込んで復元（上書き後リロード）
  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!isBackupPayload(parsed)) {
          throw new Error("invalid format");
        }
        if (!window.confirm("現在の学習データを、このファイルの内容で上書きします。よろしいですか？")) {
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
        // 保存に失敗しても writeStored は例外を投げないため、戻り値で確かめる。
        // 確かめずにリロードすると、一部しか復元されていないのに
        // 「復元できた」ように見える画面だけが残ってしまう。
        const { failed } = applyBackupPayload(parsed);
        if (failed.length > 0) {
          setMessage({ type: "error", text: restoreFailedText(failed.length) });
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
        // 状態を確実に反映させるためリロード
        window.location.reload();
      } catch (err) {
        setMessage({ type: "error", text: "ファイルの形式が正しくありません。バックアップファイルを選んでください。" });
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  /** ドライブの操作をまとめて包む（ログイン → 通信 → 文言） */
  const runDrive = async (
    kind: "push" | "pull" | "check",
    action: (token: string) => Promise<void>,
    options: { silent?: boolean } = {}
  ) => {
    setDriveBusy(kind);
    try {
      const token = await requestDriveToken({ silent: options.silent });
      await action(token);
    } catch (err) {
      if (options.silent) return; // 起動時の下見は、失敗しても何も言わない
      const needsSignIn = err instanceof DriveError && err.needsSignIn;
      setMessage({
        type: "error",
        text: needsSignIn
          ? "Googleドライブへの許可が切れています。もう一度ログインしてください。"
          : err instanceof Error
            ? err.message
            : "Googleドライブに接続できませんでした。"
      });
    } finally {
      setDriveBusy("");
    }
  };

  // すでに許可済みなら、開いたときにドライブの日時だけ見に行く。
  // 許可を求める画面は出さない（押していないのにポップアップは出さない）
  useEffect(() => {
    // 使ったことがない端末では、Googleのスクリプトすら取りに行かない
    if (!driveAvailable || !isDriveLinked()) return;
    let alive = true;
    runDrive(
      "check",
      async (token) => {
        const remote = await fetchRemote(token);
        if (alive) setDriveSavedAt(remote ? remote.savedAt : 0);
      },
      { silent: true }
    );
    return () => { alive = false; };
    // 開いたときの1回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveAvailable]);

  const handleDrivePush = () =>
    runDrive("push", async (token) => {
      const payload = await pushToDrive(token);
      markDriveLinked();
      setDriveSavedAt(payloadTime(payload));
      setMessage({ type: "ok", text: "Googleドライブに学習データを保存しました。" });
    });

  const handleDrivePull = () =>
    runDrive("pull", async (token) => {
      const remote = await fetchRemote(token);
      markDriveLinked();
      if (!remote || !remote.payload) {
        setDriveSavedAt(remote ? 0 : 0);
        setMessage({
          type: "error",
          text: remote
            ? "ドライブのバックアップを読めませんでした。この端末から保存し直してください。"
            : "ドライブにはまだ何も保存されていません。"
        });
        return;
      }
      if (!window.confirm("現在の学習データを、ドライブの内容で上書きします。よろしいですか？")) return;
      // 取ってきたものをそのまま書き戻す（もう一度取りに行くと、
      // 確かめた中身と書き戻す中身がずれることがある）
      const { failed } = applyBackupPayload(remote.payload);
      if (failed.length > 0) {
        setMessage({ type: "error", text: restoreFailedText(failed.length) });
        return;
      }
      // 状態を確実に反映させるためリロード
      window.location.reload();
    });

  const handleSaveGoal = () => {
    const n = Math.max(1, Math.min(500, Math.floor(goalInput || 0)));
    setDailyGoal(n);
    setGoalInput(n);
    setMessage({ type: "ok", text: `1日の学習目標を ${n} 問に設定しました。` });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6" id="data_backup_root">
      <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ダッシュボードに戻る</span>
          </button>
          <span className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs px-3.5 py-1.5 rounded-full font-black">
            <Database className="w-3.5 h-3.5" />
            データ設定
          </span>
        </div>

        {message && (
          <div
            className={`flex items-start gap-2 text-xs font-bold p-3 rounded-xl border ${
              message.type === "ok"
                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900"
                : "bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900"
            }`}
          >
            {message.type === "ok" ? <ShieldCheck className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* 1日の学習目標 */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-gray-800 dark:text-slate-200">
            <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            1日の学習目標
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
            毎日この問題数を解くことを目標にします。ヘッダーに今日の進捗が表示されます。
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              aria-label="1日の学習目標（問題数）"
              min={1}
              max={500}
              value={goalInput}
              onChange={(e) => setGoalInput(Number(e.target.value))}
              className="w-28 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 font-bold font-mono text-center"
            />
            <span className="text-sm text-gray-500 dark:text-slate-400 font-bold">問 / 日</span>
            <button
              onClick={handleSaveGoal}
              className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-2 rounded-xl transition cursor-pointer"
            >
              保存
            </button>
          </div>
        </section>

        <div className="border-t border-gray-100 dark:border-slate-800" />

        {/* Googleドライブと同期（クライアントIDが設定されているときだけ出す） */}
        {driveAvailable && (
          <section className="space-y-3" id="drive_sync_section">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-gray-800 dark:text-slate-200">
              <Cloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Googleドライブと同期
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              学習データをご自身のGoogleドライブ（このアプリ専用の隠しフォルダ）に置きます。
              端末を変えても、同じGoogleアカウントでログインすれば続きから学習できます。
              保存先はあなたのドライブで、<strong>当方のサーバーには送られません</strong>。
            </p>
            <p className="text-xs font-bold text-gray-600 dark:text-slate-300" id="drive_saved_at">
              {driveSavedAt === null
                ? "ドライブの状態：ログインすると確認できます"
                : driveSavedAt > 0
                  ? `ドライブの最終保存：${formatTime(driveSavedAt)}`
                  : "ドライブにはまだ保存されていません"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleDrivePush}
                disabled={driveBusy === "push" || driveBusy === "pull"}
                id="btn_drive_push"
                className="flex items-center justify-center gap-2 min-h-11 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-2xl transition cursor-pointer"
              >
                {driveBusy === "push" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                ドライブへ保存
              </button>
              <button
                onClick={handleDrivePull}
                disabled={driveBusy === "push" || driveBusy === "pull"}
                id="btn_drive_pull"
                className="flex items-center justify-center gap-2 min-h-11 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-60 text-gray-800 dark:text-slate-200 font-bold text-sm py-3 rounded-2xl transition cursor-pointer border border-gray-200 dark:border-slate-700"
              >
                {driveBusy === "pull" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                ドライブから復元
              </button>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
              ※ どちらへ動かすかは選んでください。自動では合わせません
              （2台で学習していると、片方の記録が黙って消えることがあるためです）。
            </p>
          </section>
        )}

        {driveAvailable && <div className="border-t border-gray-100 dark:border-slate-800" />}

        {/* バックアップ（ファイル） */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-gray-800 dark:text-slate-200">
            <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            ファイルでバックアップ
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
            学習の進捗・スコア・苦手単語・AIで追加した単語などはこの端末のブラウザにのみ保存されています。
            ブラウザのデータを消すと失われるため、定期的にファイルへ書き出しておくと安心です。別の端末への引っ越しにも使えます。
            Googleアカウントを使わずに持ち運びたいときは、こちらを使ってください。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3 rounded-2xl transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              エクスポート（書き出し）
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 font-bold text-sm py-3 rounded-2xl transition cursor-pointer border border-gray-200 dark:border-slate-700"
            >
              <Upload className="w-4 h-4" />
              インポート（復元）
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            aria-label="バックアップファイル（JSON）を選ぶ"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
          <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
            ※ インポートすると現在のデータは上書きされ、ページが再読み込みされます。
          </p>
        </section>
      </div>
    </div>
  );
}
