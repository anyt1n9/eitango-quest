import { PartOfSpeech, WordSense } from "./types";

/**
 * 語義データの遅延読み込み。
 *
 * 語義（src/data/senses.ts）は約1.4MBあり、単語データに混ぜると
 * 初回読み込みが gzip で 400KB 以上増える。使うのは辞書画面とクイズの結果表示だけで、
 * 起動時には要らないため、必要になった時点で読み込む。
 *
 * 一度読み込んだら以降は同じ Promise を返すので、何度呼んでも取得は1回で済む。
 */
let cache: Promise<Record<string, WordSense[]>> | null = null;

export function loadSenses(): Promise<Record<string, WordSense[]>> {
  if (!cache) {
    cache = import("./data/senses")
      .then(m => m.wordSenses)
      .catch(e => {
        // 読み込めなくても学習は続けられるべきなので、空として扱う
        console.warn("語義データを読み込めませんでした", e);
        cache = null;
        return {};
      });
  }
  return cache;
}

/** 品詞の使用割合を「動詞 91%」のような表示用の文字列にする */
export const POS_SHARE_LABELS: Record<string, string> = {
  verb: "動詞",
  noun: "名詞",
  adjective: "形容詞",
  adverb: "副詞",
  other: "その他"
};

/**
 * 教材が教えている語義が、その単語で最もよく使われる品詞かどうかを判定する。
 * 違う場合は学習者に補足を出す価値がある
 * （例: watch は教材が「腕時計」＝名詞9%だが、実際は動詞が91%）。
 */
export function findDominantSense(
  senses: WordSense[] | undefined,
  ownPos: string | undefined
): WordSense | null {
  if (!senses || senses.length === 0) return null;
  const withShare = senses.filter(s => typeof s.share === "number");
  if (withShare.length === 0) return null;
  const top = withShare.reduce((a, b) => (b.share! > a.share! ? b : a));
  if (!ownPos || top.pos === ownPos) return null;
  const ownShare = withShare.find(s => s.pos === ownPos)?.share ?? 0;
  // 差が小さいときは口を出さない（order は名詞52%・動詞48%でどちらも普通に使う）
  return top.share! - ownShare >= 25 ? top : null;
}

/** 品詞でまとめた語義。割合と用例は品詞単位の情報なのでまとまり側が持つ */
export interface SenseGroup {
  pos: PartOfSpeech;
  /** その品詞が使われる割合(%)。undefined は実測データが無い、0 は実測で見つからなかった */
  share?: number;
  /** その品詞での用例（英語のみ） */
  usage?: string;
  senses: WordSense[];
}

/**
 * 語義を品詞ごとにまとめる。
 *
 * 割合(%)も用例も品詞単位の情報なのに、語義1行ごとに並べていたため
 * 「美しい 100% ／ みごとな 100%」のように意味ごとの頻度に見えてしまっていた。
 * まとめて持てば、割合を見出しに1回だけ出せる。
 *
 * 並び順は元の配列の登場順を保つ（生成側で「教材が教えている品詞を先頭に、
 * 残りは割合の高い順」に並べてあるため、ここで並べ替えると意図が壊れる）。
 */
export function groupSensesByPos(senses: WordSense[]): SenseGroup[] {
  const groups: SenseGroup[] = [];
  const byPos = new Map<PartOfSpeech, SenseGroup>();
  for (const s of senses) {
    let g = byPos.get(s.pos);
    if (!g) {
      g = { pos: s.pos, share: s.share, senses: [] };
      byPos.set(s.pos, g);
      groups.push(g);
    }
    // 用例は同じ品詞の最初の語義にだけ付いている
    if (!g.usage && s.usage) g.usage = s.usage;
    g.senses.push(s);
  }
  return groups;
}
