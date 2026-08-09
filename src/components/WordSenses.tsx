import { useEffect, useState } from "react";
import { WordSense } from "../types";
import { loadSenses, POS_SHARE_LABELS, findDominantSense } from "../senses";
import { Layers } from "lucide-react";

/**
 * 1つの単語が持つ複数の意味を並べて見せる。
 *
 * この教材は長く「1語につき1つの意味」しか持っていなかった。
 * そのため watch を「腕時計」とだけ覚えた学習者は、長文で "watch the birds" に
 * 出会っても手がかりが無かった（収録している長文15本には、教材に無い語義で
 * 使われている語が8語ある）。
 *
 * 割合(%)は、その品詞が実際の英文でどれくらい使われるかを WordNet の SemCor 頻度から
 * 求めたもの。語義そのものの頻度ではなく品詞単位である点は画面にも明記する。
 */
interface Props {
  wordId: string;
  /** 教材が教えている訳語。これと重なる語義には印を付ける */
  ownTranslation: string;
  className?: string;
}

/** 訳語を語義ごとに分け、括弧書きと先頭の記号を落とす */
function parts(text: string): string[] {
  return text
    .replace(/[（(][^）)]*[）)]/g, "")
    .split(/[、,，/／;；]/)
    .map(s => s.replace(/^[〜～を…]+/, "").trim())
    .filter(s => s.length >= 2);
}

/**
 * 教材が教えている訳語と同じ意味を指す語義かどうか。
 * 「腕時計」と「(携帯用の)時計」のように語形が少し違うことがあるため、
 * どちらがどちらを含んでいても同じ意味とみなす。
 */
function isTaught(meaning: string, ownTranslation: string): boolean {
  const own = parts(ownTranslation);
  const here = parts(meaning);
  return own.some(o => here.some(h => h.includes(o) || o.includes(h)));
}

export default function WordSenses({ wordId, ownTranslation, className = "" }: Props) {
  const [senses, setSenses] = useState<WordSense[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadSenses().then(table => {
      if (!alive) return;
      setSenses(table[wordId] || []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [wordId]);

  if (loading) {
    return <p className={`text-xs text-gray-400 font-semibold ${className}`}>意味を読み込んでいます…</p>;
  }
  // 語義が1つしか無い語は、上の「正しい日本語訳」と同じ情報になるので出さない
  if (!senses || senses.length < 2) return null;

  const hasShare = senses.some(s => typeof s.share === "number");
  const hasUsage = senses.some(s => s.usage);
  // politely のように辞書に見出しが無い派生語は、基本形の意味を借りて出している
  const borrowedFrom = senses[0]?.from;

  return (
    <div className={`bg-amber-50/50 border border-amber-200/70 dark:bg-slate-800/40 dark:border-slate-700 p-3.5 rounded-xl space-y-2 ${className}`}>
      <div className="flex items-center gap-1.5">
        <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <p className="font-extrabold text-amber-700 dark:text-amber-400 text-xs">
          この単語の他の意味（{senses.length}件）
          {borrowedFrom && (
            <span className="ml-1 font-bold text-amber-600/80 dark:text-amber-500">
              — 基本形 <span className="font-mono">{borrowedFrom}</span> の意味
            </span>
          )}
        </p>
      </div>

      <ul className="space-y-1.5">
        {senses.map((s, i) => {
          const taught = isTaught(s.meaning, ownTranslation);
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="shrink-0 mt-0.5 flex items-center gap-1">
                <span className="inline-block px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-amber-200 dark:border-slate-600 text-[10px] font-black text-amber-700 dark:text-amber-300">
                  {POS_SHARE_LABELS[s.pos] || s.pos}
                </span>
                {typeof s.share === "number" && (
                  <span className="inline-block w-9 text-right text-[10px] font-mono font-bold text-gray-500 dark:text-slate-400">
                    {s.share}%
                  </span>
                )}
              </span>
              <span className={`flex-1 leading-snug ${taught
                ? "font-black text-indigo-800 dark:text-indigo-300"
                : "font-semibold text-gray-700 dark:text-slate-300"}`}>
                {s.meaning}
                {taught && (
                  <span className="ml-1.5 text-[10px] font-black text-indigo-500 dark:text-indigo-400">
                    ← 学習中
                  </span>
                )}
                {/* その品詞で実際に使われている例（英英辞典の用例。訳は付かない） */}
                {s.usage && (
                  <span className="block mt-1 font-mono text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900 rounded-lg px-2 py-1">
                    {s.usage}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {(hasShare || hasUsage) && (
        <div className="text-[10px] text-gray-500 dark:text-slate-400 leading-relaxed pt-1 border-t border-amber-200/70 dark:border-slate-700 space-y-0.5">
          {hasShare && (
            <p>
              ％は、その品詞が実際の英文で使われる割合です（WordNet の SemCor 頻度による）。
              意味ごとの頻度ではなく、品詞のまとまりごとの割合です。
            </p>
          )}
          {hasUsage && (
            <p>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">緑の行</span>
              は、その品詞で実際に使われている用例です（英英辞典 WordNet より）。
              意味ごとではなく品詞ごとに選んでいるため、上の語義と細かくは対応しないことがあります。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 間違えた直後に出す一言。
 *
 * 覚えた語義が、その単語で最もよく使われる品詞と違うときだけ出す。
 * 例) watch を「腕時計」と覚えていても、実際の英文では動詞が91%を占める。
 * 常に出すと騒がしいので、差が大きいときに限る（判定は findDominantSense）。
 */
export function DominantSenseHint({ wordId, ownPos }: { wordId: string; ownPos?: string }) {
  const [hint, setHint] = useState<WordSense | null>(null);

  useEffect(() => {
    let alive = true;
    setHint(null);
    loadSenses().then(table => {
      if (alive) setHint(findDominantSense(table[wordId], ownPos));
    });
    return () => { alive = false; };
  }, [wordId, ownPos]);

  if (!hint) return null;

  return (
    <div className="border-t border-slate-800 w-full pt-2.5 mt-1 text-center">
      <span className="text-[10px] text-amber-400 font-black tracking-wider uppercase block mb-1">
        よく使われるのはこちら
      </span>
      <p className="text-xs text-slate-200 font-bold leading-snug">
        <span className="text-amber-300">{POS_SHARE_LABELS[hint.pos] || hint.pos}</span>
        <span className="font-mono text-amber-400 mx-1">{hint.share}%</span>
        {hint.meaning}
      </p>
    </div>
  );
}
