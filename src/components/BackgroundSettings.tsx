import React, { useRef, useState } from "react";
import { ArrowLeft, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import {
  checkFile, fileToScaledDataUrl, saveBackgroundImage, clearBackgroundImage,
  MAX_EDGE, MAX_FILE_BYTES, VEIL_CHOICES, VeilLevel
} from "../backgroundImage";

/**
 * 背景の画像を選ぶ画面。
 *
 * 画像は端末の中だけに置き、どこにも送らない。
 * そのまま保存すると localStorage（多くのブラウザで5MB前後）を写真で埋めてしまい、
 * 学習の記録の保存まで巻き添えで失敗するので、長辺 1600px の JPEG に縮めてから保存する。
 */

interface Props {
  /** いま使っている背景画像（無ければ null） */
  image: string | null;
  onChange: (image: string | null) => void;
  /** 画像の上にかける幕の濃さ */
  veil: VeilLevel;
  onVeilChange: (veil: VeilLevel) => void;
  onBack: () => void;
}

export default function BackgroundSettings({ image, onChange, veil, onVeilChange, onBack }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 同じ画像をもう一度選べるようにする
    e.target.value = "";
    const rejected = checkFile(file);
    if (rejected) {
      setError(rejected);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await fileToScaledDataUrl(file as File);
      const saved = saveBackgroundImage(dataUrl);
      if (!saved.ok) {
        setError(saved.error || "背景を保存できませんでした。");
        return;
      }
      onChange(saved.dataUrl as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "画像を読み込めませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const handleClear = () => {
    clearBackgroundImage();
    onChange(null);
    setError(null);
  };

  return (
    <div className="space-y-6" id="background_settings_screen">
      <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition mb-4 min-h-11"
          id="btn_back_from_background"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ダッシュボードに戻る</span>
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span className="p-1.5 bg-indigo-100 rounded-xl text-indigo-700">
            <ImageIcon className="w-4 h-4" />
          </span>
          <span className="text-xs font-black tracking-wider uppercase font-mono text-indigo-700">Background</span>
        </div>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">背景の画像</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-xl">
          お好きな画像を背景にできます。画像は<strong>この端末の中だけ</strong>に保存され、どこにも送信されません。
          選んだ画像は長辺 {MAX_EDGE}px まで縮めてから保存します（{Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB まで）。
        </p>

        <div className="mt-6 border-t border-gray-100 pt-6">
          {/* いまの背景 */}
          <div
            className="w-full h-40 rounded-2xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center"
            id="background_preview"
            data-testid="background_preview"
            style={image ? { backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          >
            {!image && (
              <p className="text-xs font-bold text-gray-400 px-4 text-center">
                いまは、はじめから入っている飾り（明るいテーマ＝ジャングル／暗いテーマ＝海）を使っています。
              </p>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handlePick}
            className="hidden"
            id="background_file_input"
            data-testid="background_file_input"
          />

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl transition shadow hover:shadow-md inline-flex items-center gap-2 cursor-pointer text-sm disabled:opacity-60"
              id="btn_pick_background"
            >
              <Upload className="w-4 h-4" />
              <span>{busy ? "読み込み中..." : image ? "別の画像を選ぶ" : "画像を選ぶ"}</span>
            </button>

            {image && (
              <button
                onClick={handleClear}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-5 py-3 rounded-xl transition inline-flex items-center gap-2 cursor-pointer text-sm"
                id="btn_clear_background"
              >
                <Trash2 className="w-4 h-4" />
                <span>もとの飾りに戻す</span>
              </button>
            )}
          </div>

          {image && (
            <div className="mt-6 pt-5 border-t border-gray-100" data-testid="veil_picker">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-wide mb-1">画像の上の幕</h3>
              <p className="text-xs text-gray-500 mb-3 max-w-md">
                カードの外に出ている小さな文字（辞書の語数や文法のレベルなど）は、
                画像の柄に紛れることがあります。読みにくいときは濃くしてください。
              </p>
              <div className="flex flex-wrap gap-2">
                {VEIL_CHOICES.map(c => (
                  <button
                    key={c.level}
                    onClick={() => onVeilChange(c.level)}
                    aria-pressed={veil === c.level}
                    id={`btn_veil_${c.level}`}
                    className={`min-h-11 px-4 rounded-xl text-xs font-black border transition cursor-pointer ${
                      veil === c.level
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {c.label}
                    <span className={`ml-1.5 font-bold ${veil === c.level ? "text-indigo-100" : "text-gray-400"}`}>
                      {c.note}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p
              className="text-sm text-rose-600 font-medium mt-4 bg-rose-50 border border-rose-100 rounded-lg p-3"
              id="background_error"
              role="status"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
