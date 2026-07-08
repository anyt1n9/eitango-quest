export type RewardRarity = "common" | "rare" | "epic" | "legendary";
export type RewardType = "avatar" | "title";

export interface Reward {
  id: string;
  type: RewardType;
  rarity: RewardRarity;
  // avatarの場合は絵文字、titleの場合は称号テキスト
  value: string;
  description: string;
}

export const RARITY_LABELS: Record<RewardRarity, string> = {
  common: "コモン",
  rare: "レア",
  epic: "エピック",
  legendary: "レジェンダリー"
};

// レアリティごとの排出率（合計100）
export const RARITY_WEIGHTS: Record<RewardRarity, number> = {
  common: 60,
  rare: 25,
  epic: 12,
  legendary: 3
};

export const RARITY_COLORS: Record<RewardRarity, { text: string; bg: string; border: string; glow: string }> = {
  common: { text: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200", glow: "shadow-gray-200" },
  rare: { text: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", glow: "shadow-blue-300" },
  epic: { text: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", glow: "shadow-purple-300" },
  legendary: { text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-300", glow: "shadow-amber-300" }
};

export const REWARD_POOL: Reward[] = [
  // —— アバター: コモン ——
  { id: "av_cat", type: "avatar", rarity: "common", value: "🐱", description: "ねこアバター" },
  { id: "av_dog", type: "avatar", rarity: "common", value: "🐶", description: "いぬアバター" },
  { id: "av_rabbit", type: "avatar", rarity: "common", value: "🐰", description: "うさぎアバター" },
  { id: "av_bear", type: "avatar", rarity: "common", value: "🐻", description: "くまアバター" },
  { id: "av_panda", type: "avatar", rarity: "common", value: "🐼", description: "パンダアバター" },
  { id: "av_koala", type: "avatar", rarity: "common", value: "🐨", description: "コアラアバター" },
  { id: "av_owl", type: "avatar", rarity: "common", value: "🦉", description: "ふくろうアバター" },
  { id: "av_penguin", type: "avatar", rarity: "common", value: "🐧", description: "ペンギンアバター" },

  // —— アバター: レア ——
  { id: "av_fox", type: "avatar", rarity: "rare", value: "🦊", description: "きつねアバター" },
  { id: "av_lion", type: "avatar", rarity: "rare", value: "🦁", description: "ライオンアバター" },
  { id: "av_tiger", type: "avatar", rarity: "rare", value: "🐯", description: "とらアバター" },
  { id: "av_wolf", type: "avatar", rarity: "rare", value: "🐺", description: "オオカミアバター" },
  { id: "av_eagle", type: "avatar", rarity: "rare", value: "🦅", description: "イーグルアバター" },

  // —— アバター: エピック ——
  { id: "av_unicorn", type: "avatar", rarity: "epic", value: "🦄", description: "ユニコーンアバター" },
  { id: "av_dragon", type: "avatar", rarity: "epic", value: "🐲", description: "ドラゴンアバター" },
  { id: "av_phoenix", type: "avatar", rarity: "epic", value: "🔥", description: "フェニックスアバター" },

  // —— アバター: レジェンダリー ——
  { id: "av_crown", type: "avatar", rarity: "legendary", value: "👑", description: "王冠アバター" },
  { id: "av_star", type: "avatar", rarity: "legendary", value: "🌟", description: "スターアバター" },

  // —— 称号: コモン ——
  { id: "ti_beginner", type: "title", rarity: "common", value: "英単語見習い", description: "英単語見習いの称号" },
  { id: "ti_effort", type: "title", rarity: "common", value: "コツコツ努力家", description: "コツコツ努力家の称号" },
  { id: "ti_reader", type: "title", rarity: "common", value: "読書家", description: "読書家の称号" },
  { id: "ti_earlybird", type: "title", rarity: "common", value: "早起き学習者", description: "早起き学習者の称号" },

  // —— 称号: レア ——
  { id: "ti_hunter", type: "title", rarity: "rare", value: "英単語ハンター", description: "英単語ハンターの称号" },
  { id: "ti_scholar", type: "title", rarity: "rare", value: "語彙の探求者", description: "語彙の探求者の称号" },
  { id: "ti_streak", type: "title", rarity: "rare", value: "継続は力なり", description: "継続は力なりの称号" },

  // —— 称号: エピック ——
  { id: "ti_master", type: "title", rarity: "epic", value: "語彙の魔術師", description: "語彙の魔術師の称号" },
  { id: "ti_polyglot", type: "title", rarity: "epic", value: "英語の賢者", description: "英語の賢者の称号" },

  // —— 称号: レジェンダリー ——
  { id: "ti_legend", type: "title", rarity: "legendary", value: "伝説の英単語王", description: "伝説の英単語王の称号" },
  { id: "ti_perfect", type: "title", rarity: "legendary", value: "パーフェクトマスター", description: "パーフェクトマスターの称号" }
];

/** レアリティの重みに従って1件をランダム抽選する */
export function drawReward(): Reward {
  const rand = Math.random() * 100;
  let cumulative = 0;
  let selectedRarity: RewardRarity = "common";
  for (const rarity of ["legendary", "epic", "rare", "common"] as RewardRarity[]) {
    cumulative += RARITY_WEIGHTS[rarity];
    if (rand < cumulative) {
      selectedRarity = rarity;
      break;
    }
  }
  const pool = REWARD_POOL.filter(r => r.rarity === selectedRarity);
  return pool[Math.floor(Math.random() * pool.length)];
}
