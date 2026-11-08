import { Waves } from "lucide-react";
import { DEPTH_STAGES, nextStageInfo } from "../ocean/depth";
import { OCEAN_GUIDE, metCount } from "../ocean/guide";

export interface OceanDepthInfo {
  /** いま覚えている語数（習得済み。src/mastery.ts） */
  mastered: number;
  /** 潜った段（戻さない） */
  reached: number;
  /** いま背景に出している段（浅い方を選んでいれば reached より小さい） */
  shown: number;
}

/**
 * 「記録」の画面の「海の深さ」（段階③。src/ocean/depth.ts）。
 *
 * 覚えた語数で海が深くなることは、背景を見ているだけでは分からない。ここで、いまの深さと
 * 次の深さまでの語数を見せる。海の3D背景を使っていない人には出さない（App が null を渡す）。
 * 深さの選び直しは背景の設定にまとめ、ここからはそこへ案内するだけにする（入口を2つに分けない）。
 * 潜った深さで出会った生き物は海の図鑑（OceanGuide）にまとめ、ここから開く。
 */
export default function OceanDepthCard({ info, onOpenBackground, onOpenGuide }: {
  info: OceanDepthInfo;
  onOpenBackground: () => void;
  onOpenGuide: () => void;
}) {
  const reached = DEPTH_STAGES[Math.min(Math.max(info.reached, 0), DEPTH_STAGES.length - 1)];
  const shown = DEPTH_STAGES[Math.min(Math.max(info.shown, 0), DEPTH_STAGES.length - 1)];
  const next = nextStageInfo(info.mastered, info.reached);
  const percent = next ? Math.round(next.progress * 100) : 100;

  return (
    <section className="glass-panel bg-white border border-gray-200 rounded-2xl p-5" id="ocean_depth_section" aria-labelledby="ocean_depth_heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="ocean_depth_heading" className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Waves className="w-5 h-5 text-gray-500" aria-hidden="true" />
          海の深さ
        </h2>
        <span className="text-sm text-gray-500 tabular-nums" id="ocean_depth_mastered">覚えた語 {info.mastered.toLocaleString()}語</span>
      </div>

      <p className="mt-3 flex flex-wrap items-baseline gap-x-2" id="ocean_depth_current">
        <span className="text-2xl font-bold text-gray-900 tabular-nums">水深 {reached.depth}m</span>
        <span className="text-base font-bold text-gray-900">{reached.name}</span>
      </p>
      <p className="text-sm text-gray-500 mt-1">{reached.scene}</p>

      {next ? (
        <div className="mt-4">
          <div
            className="h-2 rounded-full bg-gray-100 overflow-hidden"
            role="progressbar"
            aria-label={`水深${next.stage.depth}mの「${next.stage.name}」まで`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="h-full rounded-full bg-indigo-600" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-sm text-gray-700" id="ocean_depth_next">
            あと<strong className="font-bold text-gray-900 tabular-nums mx-0.5">{next.remaining.toLocaleString()}語</strong>
            {`覚えると、水深${next.stage.depth}mの「${next.stage.name}」まで潜れます。`}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-700" id="ocean_depth_next">いちばん深い海まで潜りました。</p>
      )}

      {info.shown < info.reached && (
        <p className="mt-3 text-sm text-gray-600" id="ocean_depth_shown">
          背景には、水深{shown.depth}mの「{shown.name}」を出しています。
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpenGuide}
          className="min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
          id="btn_open_ocean_guide"
        >
          海の図鑑<span className="ml-1.5 font-normal text-gray-500 tabular-nums">{metCount(info.reached)} / {OCEAN_GUIDE.length}種</span>
        </button>
        <button
          type="button"
          onClick={onOpenBackground}
          className="min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
          id="btn_choose_ocean_depth"
        >
          背景に出す深さを選ぶ
        </button>
      </div>
    </section>
  );
}
