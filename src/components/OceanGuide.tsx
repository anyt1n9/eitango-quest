import React, { useEffect, useMemo, useState } from "react";
import { Check, Volume2 } from "lucide-react";
import type { Word } from "../types";
import type { SrsState } from "../srs";
import { isMastered, SolvedHistory } from "../mastery";
import { speak } from "../speech";
import { DEPTH_STAGES, nextStageInfo, stageIndexOf } from "../ocean/depth";
import { OCEAN_GUIDE, GuideCreature, creaturesAt, findCreature, hasMet, metCount } from "../ocean/guide";
import { OCEAN_GUIDE_TEXT } from "../data/oceanGuide";
import OceanGuideArt from "./OceanGuideArt";
import BackButton from "./BackButton";

interface Props {
  vocabulary: Word[];
  solvedHistory: SolvedHistory;
  srsData: Record<string, SrsState>;
  /** 覚えた語数（習得済み） */
  mastered: number;
  /** 潜った段（0 が浅瀬。戻さない） */
  reached: number;
  /** 海の3D背景を使っているか（使っていなければ、使うと泳ぐ姿が見られることを伝える） */
  oceanOn: boolean;
  /** URL から開く生き物（`/ocean-guide/<id>`） */
  initialCreatureId?: string | null;
  /** 開いている生き物が変わったことを伝える（URL に反映する） */
  onOpenCreatureChange?: (id: string | null) => void;
  onBack: () => void;
  onOpenBackground: () => void;
}

/**
 * 海の図鑑（src/ocean/guide.ts）。潜った深さで出会った生き物を、英語の名前で集める。
 *
 * 覚えた語数で海が深くなっても、背景を眺めているだけでは何がいるのか・英語で何と言うのかは分からない。
 * 海の背景を英単語の学習そのものに結び付けるため、出会った生き物の英語の名前・発音・例文・
 * 一緒に覚えたい収録語をここにまとめる。
 *
 * まだ出会っていない生き物は、絵だけを薄く見せて名前は伏せる（あと何語で出会えるかを書く）。
 * URL で直接開かれても、出会っていない生き物の中身は見せない（一覧を出す）。
 */
export default function OceanGuide({
  vocabulary, solvedHistory, srsData, mastered, reached, oceanOn,
  initialCreatureId = null, onOpenCreatureChange, onBack, onOpenBackground
}: Props) {
  const [openId, setOpenId] = useState<string | null>(initialCreatureId);

  // 外（URL・戻る・進む）から指定が変わったら開き直す
  useEffect(() => {
    setOpenId(initialCreatureId);
  }, [initialCreatureId]);

  const open = findCreature(openId);
  const shown = open && hasMet(open, reached) ? open : undefined;

  // 開いているものを URL に反映する。出会っていない生き物の ID は残さない
  useEffect(() => {
    onOpenCreatureChange?.(shown ? shown.id : null);
  }, [shown?.id]);

  // 開いた・閉じたら先頭へ（長い一覧の途中から詳しい説明に入ると、上の絵が見えない）
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [shown?.id]);

  if (shown) {
    return (
      <CreatureDetail
        creature={shown}
        vocabulary={vocabulary}
        solvedHistory={solvedHistory}
        srsData={srsData}
        onBack={() => setOpenId(null)}
      />
    );
  }

  const met = metCount(reached);
  const next = nextStageInfo(mastered, reached);
  const nextCount = next ? creaturesAt(next.stage.id).length : 0;

  return (
    <div className="space-y-4" id="ocean_guide_screen">
      <BackButton onClick={onBack} id="btn_ocean_guide_back" />
      <h1 className="text-2xl font-bold text-gray-900 px-4 py-3 rounded-2xl bg-slate-50">海の図鑑</h1>

      <section className="glass-panel bg-white border border-gray-200 rounded-2xl p-5 space-y-3" aria-labelledby="ocean_guide_summary_heading">
        <h2 id="ocean_guide_summary_heading" className="flex items-baseline gap-2">
          <span className="text-base font-bold text-gray-900">出会った生き物</span>
          <span className="text-2xl font-bold text-gray-900 tabular-nums" id="ocean_guide_met">
            {met}<span className="text-base text-gray-500"> / {OCEAN_GUIDE.length}種</span>
          </span>
        </h2>
        <div
          className="h-2 rounded-full bg-gray-100 overflow-hidden"
          role="progressbar"
          aria-label="図鑑の埋まり具合"
          aria-valuemin={0}
          aria-valuemax={OCEAN_GUIDE.length}
          aria-valuenow={met}
        >
          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.round((met / OCEAN_GUIDE.length) * 100)}%` }} />
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">
          覚えた語数に応じて海に潜り、その深さで出会った生き物の英語の名前を集めます。
        </p>
        <p className="text-sm text-gray-700 leading-relaxed" id="ocean_guide_next">
          {next
            ? <>あと<strong className="font-bold text-gray-900 tabular-nums mx-0.5">{next.remaining.toLocaleString()}語</strong>覚えて水深{next.stage.depth}mの「{next.stage.name}」へ潜ると、{nextCount}種に出会えます。</>
            : "すべての深さに潜り、図鑑の生き物すべてに出会いました。"}
        </p>
        {!oceanOn && (
          <div className="pt-1 space-y-2" id="ocean_guide_ocean_off">
            <p className="text-sm text-gray-600 leading-relaxed">
              背景を海の3Dにすると、ここに載っている生き物が泳ぐ姿を見られます。
            </p>
            <button
              type="button"
              onClick={onOpenBackground}
              id="btn_ocean_guide_background"
              className="min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
            >
              背景の設定を開く
            </button>
          </div>
        )}
      </section>

      {DEPTH_STAGES.map((stage, i) => {
        const creatures = creaturesAt(stage.id);
        const reachedHere = i <= reached;
        return (
          <section
            key={stage.id}
            className="glass-panel bg-white border border-gray-200 rounded-2xl p-5 space-y-3"
            aria-labelledby={`ocean_guide_stage_${stage.id}`}
            data-stage={stage.id}
          >
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 id={`ocean_guide_stage_${stage.id}`} className="text-base font-bold text-gray-900">
                {stage.name}
                <span className="ml-2 text-sm font-normal text-gray-500 tabular-nums">水深{stage.depth}m</span>
              </h2>
              {!reachedHere && (
                <span className="text-xs text-gray-600 tabular-nums">覚えた語{stage.minMastered.toLocaleString()}語で潜れます</span>
              )}
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {creatures.map(c => (
                <li key={c.id}>
                  {reachedHere ? (
                    <button
                      type="button"
                      id={`guide_entry_${c.id}`}
                      onClick={() => setOpenId(c.id)}
                      className="w-full h-full min-h-32 flex flex-col items-center gap-1 p-3 text-center bg-white border border-gray-200 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition cursor-pointer"
                    >
                      <OceanGuideArt id={c.id} className="w-16 h-16 text-gray-800" />
                      <span className="font-headword text-base text-gray-900 leading-tight" lang="en">{c.name}</span>
                      <span className="text-xs text-gray-500">{c.ja}</span>
                    </button>
                  ) : (
                    <div
                      className="w-full h-full min-h-32 flex flex-col items-center gap-1 p-3 text-center bg-slate-50 border border-dashed border-gray-300 rounded-xl"
                      data-locked={c.id}
                    >
                      <OceanGuideArt id={c.id} className="w-16 h-16 text-gray-300" />
                      <span className="text-base font-bold text-gray-500" aria-hidden="true">？？？</span>
                      <span className="text-xs text-gray-500">まだ出会っていません</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function CreatureDetail({ creature, vocabulary, solvedHistory, srsData, onBack }: {
  creature: GuideCreature;
  vocabulary: Word[];
  solvedHistory: SolvedHistory;
  srsData: Record<string, SrsState>;
  onBack: () => void;
}) {
  const text = OCEAN_GUIDE_TEXT[creature.id];
  const stage = DEPTH_STAGES[stageIndexOf(creature.stage)];
  // 一緒に覚えたい語。収録から外れた語は出さない（テストで、収録にあることを見ている）
  const words = useMemo(() => {
    const byId = new Map(vocabulary.map(w => [w.id, w]));
    return text.words.map(id => byId.get(id)).filter((w): w is Word => !!w);
  }, [vocabulary, text]);

  return (
    <div className="space-y-4" id="ocean_guide_detail">
      <BackButton onClick={onBack} id="btn_ocean_guide_detail_back" label="図鑑の一覧に戻る" />

      <section className="glass-panel bg-white border border-gray-200 rounded-2xl p-5" aria-labelledby="ocean_guide_name">
        <div className="flex items-center gap-4">
          <OceanGuideArt id={creature.id} className="w-24 h-24 sm:w-32 sm:h-32 text-gray-800 shrink-0" />
          <div className="min-w-0 space-y-1">
            <h2 id="ocean_guide_name" className="font-headword text-3xl text-gray-900 leading-tight break-words" lang="en">
              {creature.name}
            </h2>
            <p className="text-base font-bold text-gray-700">{creature.ja}</p>
            <p className="text-sm text-gray-500" id="ocean_guide_where">
              {stage.name}（水深{stage.depth}m）で出会う
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => speak(creature.name)}
          id="btn_ocean_guide_speak"
          aria-label={`${creature.name} の発音を聴く`}
          className="mt-4 inline-flex items-center gap-2 min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
        >
          <Volume2 className="w-5 h-5" aria-hidden="true" />
          発音を聴く
        </button>
      </section>

      <section className="glass-panel bg-white border border-gray-200 rounded-2xl p-5 space-y-4" aria-label="説明と例文">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-gray-900">どんな生き物</h3>
          <p className="text-sm text-gray-700 leading-relaxed" id="ocean_guide_about">{text.about}</p>
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-gray-900">名前の英語</h3>
          <p className="text-sm text-gray-700 leading-relaxed" id="ocean_guide_memo">{text.memo}</p>
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-gray-900">例文</h3>
          <div className="bg-slate-50 rounded-xl p-3 flex items-start gap-2">
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-headword text-base text-gray-900 leading-relaxed" lang="en" id="ocean_guide_example">{text.example[0]}</p>
              <p className="text-sm text-gray-600 leading-relaxed">{text.example[1]}</p>
            </div>
            <button
              type="button"
              onClick={() => speak(text.example[0])}
              id="btn_ocean_guide_speak_example"
              aria-label="例文を読み上げる"
              className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition cursor-pointer"
            >
              <Volume2 className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {words.length > 0 && (
        <section className="glass-panel bg-white border border-gray-200 rounded-2xl overflow-hidden" aria-labelledby="ocean_guide_words_heading">
          <h3 id="ocean_guide_words_heading" className="text-sm font-bold text-gray-900 px-5 pt-4 pb-2">一緒に覚えたい単語</h3>
          <ul className="divide-y divide-gray-200 border-t border-gray-200" id="ocean_guide_words">
            {words.map(w => {
              const done = isMastered(w.id, solvedHistory, srsData);
              return (
                <li key={w.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="font-headword text-base text-gray-900 shrink-0" lang="en">{w.word}</span>
                  <span className="flex-1 min-w-0 text-sm text-gray-600 truncate">{w.translation}</span>
                  {done && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 shrink-0">
                      <Check className="w-4 h-4" aria-hidden="true" />
                      覚えた
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
