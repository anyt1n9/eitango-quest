import { DepthStageId, Dweller, stageIndexOf } from "./depth";

/**
 * 海の図鑑（段階④）。潜った深さで出会った生き物を、英語の名前で集める。
 *
 * ここは一覧の索引だけを置く（名前・出会う深さ）。説明・例文・一緒に覚える語は
 * src/data/oceanGuide.ts にあり、図鑑の画面を開いたときにだけ読む。
 * App は新しい段に届いたときの知らせで名前を使うので、こちらは軽く保つ（起動時に読む）。
 *
 * 決まり
 *   - **出会ったかどうかは潜った段（`quest_ocean_reached`）だけで決める。** 新しく保存するものは無い
 *     （バックアップにも足さなくてよい）。潜った段は戻さないので、図鑑から消えることもない。
 *   - 海の3D背景を使っていない人にも図鑑は出す（覚えた語数で潜る記録は、海を使わなくても残っている）。
 *   - 生き物は**その段で実際に泳いでいる（生えている）もの**だけを載せる（`dweller` の量が 0.5 以上。
 *     1匹で泳ぐものはそこから出す。tests/oceanGuide.data.test.ts）。図鑑で知った生き物を海で探せるように。
 *   - ID は URL に入る（`/ocean-guide/<id>`）ので「.」を含めない。
 */

export type GuideId =
  | "seagrass" | "sea-turtle" | "manta-ray" | "sardine"
  | "coral" | "brain-coral" | "butterflyfish" | "damselfish"
  | "sea-fan" | "humphead-wrasse"
  | "whale-shark" | "jellyfish"
  | "lanternfish" | "marine-snow"
  | "anglerfish";

export interface GuideCreature {
  id: GuideId;
  /** 英語の名前（見出し・読み上げ） */
  name: string;
  /** 日本語の名前 */
  ja: string;
  /** はじめて出会う段 */
  stage: DepthStageId;
  /** 3Dの海の中で、この生き物にあたるもの（src/ocean/depth.ts の住む量） */
  dweller: Dweller;
}

/** 浅い順。同じ段の中は、海で目に入りやすい順 */
export const OCEAN_GUIDE: readonly GuideCreature[] = [
  { id: "seagrass", name: "seagrass", ja: "海草", stage: "shallows", dweller: "seagrass" },
  { id: "sea-turtle", name: "sea turtle", ja: "ウミガメ", stage: "shallows", dweller: "turtle" },
  { id: "manta-ray", name: "manta ray", ja: "マンタ", stage: "shallows", dweller: "manta" },
  { id: "sardine", name: "sardine", ja: "イワシ", stage: "shallows", dweller: "fish" },
  { id: "coral", name: "coral", ja: "サンゴ", stage: "reef", dweller: "staghorn" },
  { id: "brain-coral", name: "brain coral", ja: "ノウサンゴ", stage: "reef", dweller: "brain" },
  { id: "butterflyfish", name: "butterflyfish", ja: "チョウチョウウオ", stage: "reef", dweller: "reeffish" },
  { id: "damselfish", name: "damselfish", ja: "スズメダイ", stage: "reef", dweller: "reeffish" },
  { id: "sea-fan", name: "sea fan", ja: "ウミウチワ", stage: "slope", dweller: "fan" },
  { id: "humphead-wrasse", name: "humphead wrasse", ja: "ナポレオンフィッシュ", stage: "slope", dweller: "wrasse" },
  { id: "whale-shark", name: "whale shark", ja: "ジンベエザメ", stage: "offshore", dweller: "whaleshark" },
  { id: "jellyfish", name: "jellyfish", ja: "クラゲ", stage: "offshore", dweller: "jelly" },
  { id: "lanternfish", name: "lanternfish", ja: "ハダカイワシ", stage: "twilight", dweller: "lantern" },
  { id: "marine-snow", name: "marine snow", ja: "マリンスノー", stage: "twilight", dweller: "snow" },
  { id: "anglerfish", name: "anglerfish", ja: "チョウチンアンコウ", stage: "deep", dweller: "angler" },
];

export function findCreature(id: string | null | undefined): GuideCreature | undefined {
  return OCEAN_GUIDE.find(c => c.id === id);
}

/** 潜った段（`reached`。0 が浅瀬）で、もう出会っているか */
export function hasMet(creature: GuideCreature, reached: number): boolean {
  return stageIndexOf(creature.stage) <= reached;
}

/** 出会った生き物の数 */
export function metCount(reached: number): number {
  return OCEAN_GUIDE.filter(c => hasMet(c, reached)).length;
}

/** 段 `from` から段 `to` へ潜ったときに、新しく出会う生き物（`from` より深く `to` まで） */
export function newlyMet(from: number, to: number): GuideCreature[] {
  return OCEAN_GUIDE.filter(c => {
    const k = stageIndexOf(c.stage);
    return k > from && k <= to;
  });
}

/** その段で出会う生き物 */
export function creaturesAt(stage: DepthStageId): GuideCreature[] {
  return OCEAN_GUIDE.filter(c => c.stage === stage);
}
