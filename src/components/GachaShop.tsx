import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Sparkles, Gift, Lock, Check, Coins } from "lucide-react";
import {
  REWARD_POOL,
  RARITY_LABELS,
  RARITY_COLORS,
  RewardRarity,
  drawReward
} from "../data/rewards";

interface PulledResult {
  id: string;
  type: "avatar" | "title";
  rarity: RewardRarity;
  value: string;
  description: string;
  isDuplicate: boolean;
}

interface EquippedState {
  avatar?: string;
  title?: string;
}

interface GachaShopProps {
  availablePoints: number;
  totalScore: number;
  ownedRewardIds: string[];
  setOwnedRewardIds: React.Dispatch<React.SetStateAction<string[]>>;
  gachaSpent: number;
  setGachaSpent: React.Dispatch<React.SetStateAction<number>>;
  equipped: EquippedState;
  setEquipped: React.Dispatch<React.SetStateAction<EquippedState>>;
  onBackToDashboard: () => void;
}

const SINGLE_COST = 150;
const TEN_COST = 1400; // 単発x10(1500)より100Pお得
const DUPLICATE_REFUND = 20;

export default function GachaShop({
  availablePoints,
  totalScore,
  ownedRewardIds,
  setOwnedRewardIds,
  gachaSpent,
  setGachaSpent,
  equipped,
  setEquipped,
  onBackToDashboard
}: GachaShopProps) {
  const [pullResults, setPullResults] = useState<PulledResult[] | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [activeTab, setActiveTab] = useState<"avatar" | "title">("avatar");
  const [pullError, setPullError] = useState("");

  const handlePull = (count: 1 | 10) => {
    const cost = count === 1 ? SINGLE_COST : TEN_COST;
    if (availablePoints < cost) {
      setPullError(`ポイントが足りません（必要: ${cost}P / 現在: ${availablePoints}P）`);
      return;
    }
    setPullError("");
    setIsPulling(true);

    // 抽選演出のためわずかに待ってから結果を表示する
    setTimeout(() => {
      const ownedSet = new Set(ownedRewardIds);
      let netCost = cost;
      const results: PulledResult[] = [];

      for (let i = 0; i < count; i++) {
        const drawn = drawReward();
        const isDuplicate = ownedSet.has(drawn.id);
        if (isDuplicate) {
          netCost -= DUPLICATE_REFUND;
        } else {
          ownedSet.add(drawn.id);
        }
        results.push({ ...drawn, isDuplicate });
      }

      setOwnedRewardIds(Array.from(ownedSet));
      setGachaSpent(prev => prev + netCost);
      setPullResults(results);
      setIsPulling(false);
    }, 900);
  };

  const handleEquip = (type: "avatar" | "title", value: string) => {
    setEquipped(prev => ({ ...prev, [type]: value }));
  };

  const avatarPool = REWARD_POOL.filter(r => r.type === "avatar");
  const titlePool = REWARD_POOL.filter(r => r.type === "title");
  const activePool = activeTab === "avatar" ? avatarPool : titlePool;

  return (
    <div className="max-w-3xl mx-auto space-y-6" id="gacha_shop_root">
      <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition"
            id="btn_back_from_gacha"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ダッシュボードに戻る</span>
          </button>
          <span className="bg-indigo-50 text-indigo-700 text-xs px-3.5 py-1.5 rounded-full font-black font-mono flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" />
            使えるポイント: {availablePoints}P
          </span>
        </div>

        <div className="flex items-center gap-3 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-5 text-white shadow-sm">
          <div className="p-3 bg-white/15 rounded-xl">
            <Gift className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg tracking-tight">ごほうびガチャ</h3>
            <p className="text-xs text-violet-100 mt-0.5 font-medium leading-relaxed">
              学習で貯めたポイントを使って、アバターや称号をゲットしよう！総獲得スコア({totalScore}P)は減りません。
            </p>
          </div>
        </div>

        {/* ガチャ実行ボタン */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => handlePull(1)}
            disabled={isPulling}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-extrabold py-4 rounded-2xl shadow hover:shadow-md transition flex flex-col items-center justify-center gap-1 text-sm cursor-pointer"
            id="btn_gacha_single"
          >
            <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4" />単発ガチャ</span>
            <span className="text-xs font-mono opacity-80">{SINGLE_COST}P</span>
          </button>
          <button
            onClick={() => handlePull(10)}
            disabled={isPulling}
            className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 disabled:opacity-60 text-slate-950 font-extrabold py-4 rounded-2xl shadow hover:shadow-md transition flex flex-col items-center justify-center gap-1 text-sm cursor-pointer"
            id="btn_gacha_ten"
          >
            <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4" />10連ガチャ</span>
            <span className="text-xs font-mono opacity-80">{TEN_COST}P (100Pお得)</span>
          </button>
        </div>

        {pullError && (
          <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded-lg p-3 text-center">
            {pullError}
          </p>
        )}

        {/* 抽選結果表示 */}
        <AnimatePresence>
          {pullResults && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-gray-50 border border-gray-150 rounded-2xl p-5"
              id="gacha_result_panel"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-black text-gray-800">抽選結果</h4>
                <button
                  onClick={() => setPullResults(null)}
                  className="text-xs font-bold text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  閉じる
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {pullResults.map((r, i) => {
                  const colors = RARITY_COLORS[r.rarity];
                  return (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, rotate: -10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: i * 0.08, type: "spring", stiffness: 200 }}
                      className={`relative border-2 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-1 ${colors.bg} ${colors.border} ${
                        r.rarity === "legendary" || r.rarity === "epic" ? `shadow-md ${colors.glow}` : ""
                      }`}
                    >
                      {!r.isDuplicate && (
                        <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow">
                          NEW!
                        </span>
                      )}
                      <span className={`text-[9px] font-black uppercase ${colors.text}`}>
                        {RARITY_LABELS[r.rarity]}
                      </span>
                      {r.type === "avatar" ? (
                        <span className="text-4xl">{r.value}</span>
                      ) : (
                        <span className="text-xs font-black text-gray-800 leading-tight">{r.value}</span>
                      )}
                      {r.isDuplicate && (
                        <span className="text-[9px] text-gray-400 font-bold">
                          重複 (+{DUPLICATE_REFUND}P還元)
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* コレクション */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 mt-4 mb-4">
            <button
              onClick={() => setActiveTab("avatar")}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                activeTab === "avatar" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              アバター ({avatarPool.filter(r => ownedRewardIds.includes(r.id)).length}/{avatarPool.length})
            </button>
            <button
              onClick={() => setActiveTab("title")}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                activeTab === "title" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              称号 ({titlePool.filter(r => ownedRewardIds.includes(r.id)).length}/{titlePool.length})
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3" id="gacha_collection_grid">
            {activePool.map((r) => {
              const owned = ownedRewardIds.includes(r.id);
              const isEquipped = equipped[r.type] === r.value;
              const colors = RARITY_COLORS[r.rarity];

              return (
                <button
                  key={r.id}
                  onClick={() => owned && handleEquip(r.type, r.value)}
                  disabled={!owned}
                  title={owned ? r.description : "まだ入手していません"}
                  className={`relative border-2 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 text-center transition-all min-h-[92px] ${
                    owned
                      ? `${colors.bg} ${colors.border} cursor-pointer hover:scale-105`
                      : "bg-gray-100 border-gray-150 opacity-60 cursor-not-allowed"
                  } ${isEquipped ? "ring-2 ring-indigo-500 ring-offset-1" : ""}`}
                >
                  {isEquipped && (
                    <span className="absolute -top-2 -right-2 bg-indigo-600 text-white rounded-full p-1 shadow">
                      <Check className="w-2.5 h-2.5 stroke-4" />
                    </span>
                  )}
                  {owned ? (
                    r.type === "avatar" ? (
                      <span className="text-3xl">{r.value}</span>
                    ) : (
                      <span className="text-[11px] font-black text-gray-800 leading-tight">{r.value}</span>
                    )
                  ) : (
                    <Lock className="w-5 h-5 text-gray-350" />
                  )}
                  <span className={`text-[8px] font-black uppercase ${owned ? colors.text : "text-gray-350"}`}>
                    {RARITY_LABELS[r.rarity]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
