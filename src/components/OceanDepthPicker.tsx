import { Check, Lock } from "lucide-react";
import { DEPTH_STAGES, shownStageIndex, type DepthChoice } from "../ocean/depth";

export interface OceanDepthState {
  choice: DepthChoice;
  /** 潜った段（戻さない） */
  reached: number;
  /** いま覚えている語数 */
  mastered: number;
}

/**
 * 背景に出す海の深さを選ぶ（背景の設定の「海の3D背景」の中。段階③）。
 *
 * 深い海は暗く、サンゴもエイもいない。浅い海が好きな人が、覚えるほど好きな海を失うのでは
 * 逆効果なので、潜ったことのある深さなら浅い方も選べるようにする。既定は「いちばん深いところ」。
 * まだ潜っていない深さは選べない（覚えた語数で潜る、という約束を崩さない）。押せない理由は文字で書く。
 */
export default function OceanDepthPicker({ state, onChange }: { state: OceanDepthState; onChange: (c: DepthChoice) => void }) {
  const deepest = DEPTH_STAGES[Math.min(Math.max(state.reached, 0), DEPTH_STAGES.length - 1)];
  const shown = shownStageIndex(state.choice, state.reached);
  const base = "w-full min-h-11 px-4 py-2.5 rounded-xl border text-left transition flex items-start gap-3";
  const pressed = "bg-indigo-50 text-indigo-800 border-indigo-600";
  const idle = "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 cursor-pointer";

  return (
    <div className="mt-5" data-testid="ocean_depth_picker">
      <h4 className="text-sm font-bold text-gray-900">海の深さ</h4>
      <p className="text-sm text-gray-500 mt-1 mb-3 max-w-md leading-relaxed">
        {`覚えた語数に応じて、潜れる深さが増えます（いま ${state.mastered.toLocaleString()}語）。潜ったことのある深さなら、浅い方も選べます。`}
      </p>
      <div className="flex flex-col gap-2 max-w-md" role="group" aria-label="海の深さ">
        <button
          type="button"
          onClick={() => onChange("auto")}
          aria-pressed={state.choice === "auto"}
          id="btn_depth_auto"
          className={`${base} ${state.choice === "auto" ? pressed : idle}`}
        >
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold">いちばん深いところ</span>
            <span className="block text-xs mt-0.5">覚えるたびに潜ります（いまは水深{deepest.depth}mの「{deepest.name}」）</span>
          </span>
        </button>
        {DEPTH_STAGES.map((s, i) => {
          const open = i <= state.reached;
          const isOn = state.choice === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => open && onChange(s.id)}
              disabled={!open}
              aria-pressed={open ? isOn : undefined}
              id={`btn_depth_${s.id}`}
              data-shown={i === shown ? "true" : undefined}
              className={`${base} ${!open ? "bg-white text-gray-500 border-dashed border-gray-300 cursor-default" : isOn ? pressed : idle}`}
            >
              <span className="w-14 shrink-0 text-sm font-bold tabular-nums">{s.depth}m</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold">{s.name}</span>
                <span className="block text-xs mt-0.5">
                  {open ? s.scene : `覚えた語が${s.minMastered.toLocaleString()}語になると潜れます`}
                </span>
              </span>
              {open
                ? i === shown && <Check className="w-4 h-4 mt-0.5 shrink-0" aria-label="いま出している深さ" />
                : <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
