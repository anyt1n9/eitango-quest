import React, { useRef, useState } from "react";
import { Image as ImageIcon, Trash2, Upload, Waves } from "lucide-react";
import {
  checkFile, fileToScaledDataUrl, saveBackgroundImage, clearBackgroundImage,
  MAX_EDGE, MAX_FILE_BYTES, VEIL_CHOICES, VeilLevel
} from "../backgroundImage";
import { GLASS_PRESETS, GLASS_SAFE_MAX, setGlass, useGlass } from "../glass";
import GlassSlider from "./GlassSlider";
import BackButton from "./BackButton";

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
  /** 海の3D背景を使うか（既定は使う。src/oceanSetting.ts） */
  ocean: boolean;
  onOceanChange: (on: boolean) => void;
  onBack: () => void;
}

export default function BackgroundSettings({ image, onChange, veil, onVeilChange, ocean, onOceanChange, onBack }: Props) {
  // カードの透明度はヘッダーのつまみと同じ値（src/glass.ts）。どちらで動かしても両方に出る
  const glass = useGlass();
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
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
        <BackButton onClick={onBack} id="btn_back_from_background" />

        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mt-2">
          <span className="p-1.5 bg-indigo-100 rounded-xl text-indigo-700">
            <ImageIcon className="w-4 h-4" />
          </span>
          背景の画像
        </h2>
        <p className="text-sm text-gray-500 mt-1 max-w-xl">
          お好きな画像を背景にできます。画像は<strong>この端末の中だけ</strong>に保存され、どこにも送信されません。
          選んだ画像は長辺 {MAX_EDGE}px まで縮めてから保存します（{Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB まで）。
        </p>

        {/* 海の3D背景。はじめから使う（データ節約の端末と、自分の画像を背景にしている人を除く。src/oceanSetting.ts） */}
        <div className="mt-6 border-t border-gray-200 pt-6" data-testid="ocean_picker">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Waves className="w-5 h-5 text-gray-500" aria-hidden="true" />
            海の3D背景
          </h3>
          <p className="text-sm text-gray-500 mt-1 mb-3 max-w-md leading-relaxed">
            光が差し込むサンゴ礁の海を、背景に動かして表示します。端末の性能に合わせて画質を自動で調整します。
            はじめて表示するときに約2MBを読み込みます（2回目からは端末に残ったものを使います）。
            使わないにすると、はじめから入っている飾り（明るいテーマ＝ジャングル／暗いテーマ＝海の絵）か、
            下で選んだ画像を出します。画像を選ぶと、海の代わりにその画像を出します。
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="海の3D背景">
            {[{ on: true, label: "使う" }, { on: false, label: "使わない" }].map(c => (
              <button
                key={c.label}
                onClick={() => onOceanChange(c.on)}
                aria-pressed={ocean === c.on}
                id={c.on ? "btn_ocean_on" : "btn_ocean_off"}
                className={`min-h-11 px-5 rounded-xl text-sm font-bold border transition cursor-pointer ${
                  ocean === c.on
                    ? "bg-indigo-50 text-indigo-800 border-indigo-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

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
                {ocean
                  ? "いまは海の3D背景を使っています。"
                  : "いまは、はじめから入っている飾り（明るいテーマ＝ジャングル／暗いテーマ＝海）を使っています。"}
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl transition shadow inline-flex items-center gap-2 cursor-pointer text-sm disabled:opacity-60"
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
              <h3 className="text-xs font-bold text-gray-500 mb-1">画像の上の幕</h3>
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
                    className={`min-h-11 px-4 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      veil === c.level
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {c.label}
                    <span className={`ml-1.5 font-bold ${veil === c.level ? "text-white" : "text-gray-400"}`}>
                      {c.note}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* カードとボタンの透明感。
              画像を選んでいなくても、はじめからの飾り（ジャングル／海）が
              背後にあるので、常に出す */}
          <div className="mt-6 pt-5 border-t border-gray-100" data-testid="glass_picker">
            <h3 className="text-xs font-bold text-gray-500 mb-1">カードとボタンの透明感</h3>
            <p className="text-xs text-gray-500 mb-3 max-w-md">
              「今日」の画面のカードとボタンを半透明にして、背景を透かします。
              透かすほど背景は見えますが、文字は読みにくくなります。
              「今日」の画面の上（ヘッダー）のつまみでも変えられます。
              文字を隠して海だけを見たいときは、画面の上の魚のボタン（海を眺める）を押してください。
            </p>
            <GlassSlider id="settings_glass_slider" className="max-w-md" />
            {/* つまみで18ちょうどに合わせるのは難しいので、よく使う値はボタンでも選べる */}
            <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="よく使う透明度">
              {GLASS_PRESETS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setGlass(c.value)}
                  aria-pressed={glass === c.value}
                  id={`btn_glass_${c.id}`}
                  className={`min-h-11 px-4 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    glass === c.value
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {c.label}
                  <span className={`ml-1.5 font-bold ${glass === c.value ? "text-white" : "text-gray-400"}`}>
                    {c.note}
                  </span>
                </button>
              ))}
            </div>
            {/* 18%より透かすと、読みやすさを測って保証できない
                （背後の色がそのまま文字の地に混ざるため）。選んだら伝える */}
            {glass > GLASS_SAFE_MAX && (
              <p
                className="text-xs text-gray-700 font-bold mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 max-w-md"
                id="glass_clear_note"
                role="status"
              >
                {GLASS_SAFE_MAX}%より透かすとカードの地が薄くなるため、背景によっては文字が読みにくくなります
                （明るい写真の上では明るい文字が、暗い写真の上では暗い文字が沈みます）。
                読みにくいときは「{GLASS_SAFE_MAX}%」に戻すか、背景の画像を変えてください。
              </p>
            )}
          </div>

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
