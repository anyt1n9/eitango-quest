import { useMemo, useState } from "react";
import { Level, Word } from "../types";
import { buildVerbTable, PATTERN_NOTES, VerbForms as Forms } from "../verbForms";
import { ArrowLeft, Search, Repeat, Volume2, X } from "lucide-react";

/**
 * 動詞の活用表（原形 → 過去形 → 過去分詞）。
 *
 * この教材は見出し語を原形で持っており、活用形を学ぶ場が無かった。
 * 一方で -ed 形が独立した見出しとして混ざっており、同じ語を2回覚えさせていた。
 * 活用は語彙とは別の知識なので、見出しを増やすのではなく表としてまとめる。
 *
 * 不規則動詞は変化の型（AAA / ABA / ABB / ABC）で絞り込めるようにしてある。
 * 「go - went - gone」と「buy - bought - bought」を別の型として意識できると
 * 覚える手がかりになるため。
 */
interface Props {
  vocabulary: Word[];
  onBackToDashboard: () => void;
}

type PatternFilter = "all" | "irregular" | Forms["pattern"];

const LEVEL_LABELS: Record<Level, string> = {
  junior: "初級 (中学)",
  senior: "中級1 (高1)",
  senior2: "中級2 (高2)",
  senior3: "中級3 (高3)",
  advanced: "上級 (大・社会人)"
};

const PATTERN_COLORS: Record<Forms["pattern"], string> = {
  AAA: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  ABA: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  ABB: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
  ABC: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  規則変化: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
};

function speak(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  } catch (e) {
    console.warn("発音の再生に失敗しました", e);
  }
}

export default function VerbFormsScreen({ vocabulary, onBackToDashboard }: Props) {
  const [query, setQuery] = useState("");
  const [pattern, setPattern] = useState<PatternFilter>("irregular");
  const [level, setLevel] = useState<Level | "all">("all");

  const table = useMemo(() => buildVerbTable(vocabulary), [vocabulary]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: table.length, irregular: 0 };
    for (const t of table) {
      c[t.pattern] = (c[t.pattern] || 0) + 1;
      if (t.irregular) c.irregular++;
    }
    return c;
  }, [table]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return table.filter(t => {
      if (level !== "all" && t.word.level !== level) return false;
      if (pattern === "irregular" && !t.irregular) return false;
      else if (pattern !== "all" && pattern !== "irregular" && t.pattern !== pattern) return false;
      if (!q) return true;
      return t.base.includes(q) || t.past.includes(q) || t.participle.includes(q)
        || t.word.translation.toLowerCase().includes(q);
    });
  }, [table, query, pattern, level]);

  const filters: { key: PatternFilter; label: string }[] = [
    { key: "irregular", label: "不規則のみ" },
    { key: "AAA", label: "AAA" },
    { key: "ABA", label: "ABA" },
    { key: "ABB", label: "ABB" },
    { key: "ABC", label: "ABC" },
    { key: "規則変化", label: "規則変化" },
    { key: "all", label: "すべて" }
  ];

  return (
    <div className="space-y-4" id="verb_forms_screen">
      <div className="flex items-center gap-2">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-1 text-xs font-bold text-gray-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer"
          id="btn_verb_forms_back"
        >
          <ArrowLeft className="w-4 h-4" />
          ダッシュボードに戻る
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex items-start gap-2">
          <Repeat className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-slate-100">動詞の活用表</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed mt-1">
              原形・過去形・過去分詞・ing形をまとめて確認できます。
              収録している動詞 {counts.all} 語のうち、{counts.irregular} 語が不規則変化です。
            </p>
          </div>
        </div>

        {/* 変化の型の凡例 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(["AAA", "ABA", "ABB", "ABC"] as const).map(p => (
            <div key={p} className={`border rounded-xl px-2.5 py-2 ${PATTERN_COLORS[p]}`}>
              <p className="font-black text-xs font-mono">{p}</p>
              <p className="text-[10px] font-bold leading-snug">{PATTERN_NOTES[p]}</p>
            </div>
          ))}
        </div>

        {/* 検索 */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="原形・過去形・過去分詞・日本語訳で検索..."
            aria-label="動詞を検索"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm font-semibold text-gray-900 dark:text-slate-100"
            id="verb_forms_search"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="検索条件を消す"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 絞り込み */}
        <div className="flex flex-wrap gap-1.5">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setPattern(f.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition cursor-pointer ${
                pattern === f.key
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100"
              }`}
            >
              {f.label}
              <span className="ml-1 font-mono opacity-70">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["all", "junior", "senior", "senior2", "senior3", "advanced"] as const).map(l => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                level === l
                  ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200"
                  : "bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700"
              }`}
            >
              {l === "all" ? "全レベル" : LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      {/* 表 */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
        <p className="px-4 py-2.5 text-xs font-black text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
          {filtered.length} 語
        </p>

        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm font-bold text-gray-400">
            条件に合う動詞が見つかりませんでした。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800 text-[11px] font-black text-gray-500 dark:text-slate-400">
                  <th className="text-left px-3 py-2">原形</th>
                  <th className="text-left px-3 py-2">過去形</th>
                  <th className="text-left px-3 py-2">過去分詞</th>
                  <th className="text-left px-3 py-2">ing形</th>
                  <th className="text-left px-3 py-2">意味</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr
                    key={t.word.id}
                    className="border-t border-gray-100 dark:border-slate-800 hover:bg-indigo-50/40 dark:hover:bg-slate-800/60"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-gray-900 dark:text-slate-100">{t.base}</span>
                        <button
                          onClick={() => speak(`${t.base}, ${t.past}, ${t.participle}`)}
                          aria-label={`${t.base} の活用を発音する`}
                          className="text-gray-300 hover:text-indigo-600 cursor-pointer shrink-0"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded border text-[9px] font-black font-mono ${PATTERN_COLORS[t.pattern]}`}>
                        {t.pattern}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 font-mono ${t.irregular ? "font-black text-rose-700 dark:text-rose-300" : "font-semibold text-gray-600 dark:text-slate-300"}`}>
                      {t.past}
                    </td>
                    <td className={`px-3 py-2.5 font-mono ${t.irregular ? "font-black text-rose-700 dark:text-rose-300" : "font-semibold text-gray-600 dark:text-slate-300"}`}>
                      {t.participle}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-gray-500 dark:text-slate-400">{t.ing}</td>
                    <td className="px-3 py-2.5 font-bold text-gray-700 dark:text-slate-300 text-xs">{t.word.translation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed px-1">
        規則変化の綴りは米つづりに揃えています（travel → traveled）。
        過去形・過去分詞が2通りある動詞は、より一般的な方を載せています。
      </p>
    </div>
  );
}
