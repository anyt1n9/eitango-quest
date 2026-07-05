import { useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Download, Upload, Target, Database, ShieldCheck, AlertTriangle } from "lucide-react";

// バックアップ対象の localStorage キー一覧
const BACKUP_KEYS = [
  "quest_stats",
  "quest_vocab_custom",
  "quest_wrong_words",
  "quest_solved_history",
  "quest_ranking_score",
  "quest_srs",
  "quest_daily_progress",
  "quest_daily_goal",
  "quest_daily_log",
  "quest_read_passages",
  "quest_custom_passages",
  "quest_theme",
];

interface DataBackupProps {
  dailyGoal: number;
  setDailyGoal: (n: number) => void;
  onBackToDashboard: () => void;
}

export default function DataBackup({ dailyGoal, setDailyGoal, onBackToDashboard }: DataBackupProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [goalInput, setGoalInput] = useState<number>(dailyGoal);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  // すべての学習データを JSON ファイルとしてダウンロード
  const handleExport = () => {
    try {
      const data: Record<string, string | null> = {};
      BACKUP_KEYS.forEach((k) => {
        data[k] = localStorage.getItem(k);
      });
      const payload = {
        app: "eitango-quest",
        version: 1,
        exportedAt: new Date().toISOString(),
        data,
      };
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
        const data = parsed && parsed.data ? parsed.data : null;
        if (!data || typeof data !== "object") {
          throw new Error("invalid format");
        }
        if (!window.confirm("現在の学習データを、このファイルの内容で上書きします。よろしいですか？")) {
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
        BACKUP_KEYS.forEach((k) => {
          if (k in data && data[k] !== null && data[k] !== undefined) {
            localStorage.setItem(k, data[k]);
          }
        });
        // 状態を確実に反映させるためリロード
        window.location.reload();
      } catch (err) {
        setMessage({ type: "error", text: "ファイルの形式が正しくありません。バックアップファイルを選んでください。" });
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

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
          <span className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs px-3.5 py-1.5 rounded-full font-black">
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

        {/* バックアップ */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-gray-800 dark:text-slate-200">
            <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            データのバックアップ
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
            学習の進捗・スコア・苦手単語・AIで追加した単語などはこの端末のブラウザにのみ保存されています。
            ブラウザのデータを消すと失われるため、定期的にファイルへ書き出しておくと安心です。別の端末への引っ越しにも使えます。
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
