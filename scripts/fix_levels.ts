import fs from "fs";
import path from "path";

/**
 * レベル配分の見直し（src/data/vocabulary.ts の level を書き換える）。
 *
 * 実測の裏取り: WordNet の SemCor 頻度（`.cache/cntlist.rev`）でレベル別の
 * 出現回数の中央値をとると junior 37 → senior 18 → senior2 10 → senior3 8 →
 * advanced 3 と単調に下がる。つまり全体の並びは概ね正しく、総入れ替えは要らない。
 *
 * 問題は外れ値のほうで、SemCor の上位1000語に入る語が senior3 / advanced に
 * 107語あった。seem（22位）や rest（376位）のような、日本の中学・高1で扱う語が
 * 上級に置かれていると、初級の学習者は最後まで出会えない。
 *
 * 逆方向（junior にあるのに実測が少ない179語）は動かさない。
 * その大半は the / of / you のような機能語と onion / carrot のような日常語で、
 * SemCor が内容語しか数えないために出てこないだけで、難しい語ではないため。
 * 頻度は難易度の代わりにはならないので、下の一覧は機械判定ではなく
 * 「日本の教科書でいつ習うか」を1語ずつ見て決めている。
 *
 * あわせて、判断の根拠にした頻度順位を tests/data/semcorRank.ts に書き出す。
 * `.cache/` は git に入れないので、これが無いとCIでレベル配分を検査できない。
 *
 * 実行: npx tsx scripts/fix_levels.ts
 */

/** 移動する語と移動先。頻度順ではなく、教科書で扱う学年で決めている */
export const LEVEL_FIXES: Record<string, string> = {
  // 中学〜高1で扱う語。senior3 / advanced から高1へ
  seem: "senior",
  own: "senior",
  reach: "senior",
  cover: "senior",
  order: "senior",
  war: "senior",
  past: "senior",
  address: "senior",
  laugh: "senior",
  forward: "senior",
  hang: "senior",
  swing: "senior",
  rest: "senior",
  length: "senior",

  // 高2で扱う語
  state: "senior2",
  public: "senior2",
  period: "senior2",
  difference: "senior2",
  success: "senior2",
  sort: "senior2",
  data: "senior2",
  energy: "senior2",
  doubt: "senior2",
  nation: "senior2",
  crowd: "senior2",
  bear: "senior2",
  destroy: "senior2",
  tax: "senior2",
  flow: "senior2",
  national: "senior2",
  item: "senior2",
  site: "senior2",
  block: "senior2",
  lower: "senior2",
  exist: "senior2",
  object: "senior2",
  limit: "senior2",
  army: "senior2",
  lift: "senior2",
  advance: "senior2",

  // 高3で扱う語。上級から1段下げる
  thus: "senior3",
  assume: "senior3",
  trial: "senior3",
  stare: "senior3",
  remark: "senior3",
  extend: "senior3",
  vary: "senior3",
  emerge: "senior3",
  struggle: "senior3",
  somewhat: "senior3"
};

/**
 * SemCor（WordNet に付属する意味タグ付きコーパス）での出現回数から順位を作る。
 * 1位がもっともよく現れる語。実測に出てこない語は順位を持たない。
 */
export function loadSemcorRank(cachePath: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of fs.readFileSync(cachePath, "utf8").split("\n")) {
    const parts = line.trim().split(/\s+/);
    const key = parts[0], cnt = Number(parts[2]);
    if (!key || !cnt) continue;
    const m = key.match(/^(.+?)%\d/);
    if (!m) continue;
    const lemma = m[1].replace(/_/g, " ");
    counts.set(lemma, (counts.get(lemma) || 0) + cnt);
  }
  const rank = new Map<string, number>();
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([w], i) => rank.set(w, i + 1));
  return rank;
}

/** 収録語のぶんだけ順位を書き出す（レベル配分のテストが参照する） */
function writeRankFixture(arr: any[], rank: Map<string, number>) {
  const table: Record<string, number> = {};
  for (const w of arr) {
    const r = rank.get(String(w.word).trim().toLowerCase());
    if (r !== undefined) table[w.id] = r;
  }
  const dir = path.join(process.cwd(), "tests/data");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "semcorRank.ts"), `/**
 * 収録語の SemCor 出現頻度の順位（1位がもっともよく現れる語）。
 * scripts/fix_levels.ts が生成する。レベル配分の検査だけに使う。
 *
 * 出典: WordNet 3.0 の cntlist.rev（意味タグ付きコーパス SemCor の集計）。
 * 実測に出てこない語は入っていない。頻度は難易度そのものではないので、
 * 「この順位ならこのレベル」と機械的に決める用途には使わないこと。
 */
export const semcorRank: Record<string, number> = ${JSON.stringify(table)};
`);
  console.log(`tests/data/semcorRank.ts: ${Object.keys(table).length}語`);
}

function main() {
  const file = path.join(process.cwd(), "src/data/vocabulary.ts");
  const src = fs.readFileSync(file, "utf8");
  const marker = "const rawVocabulary: any[] = ";
  const arrStart = src.indexOf("[", src.indexOf(marker) + marker.length);
  let depth = 0, inStr = false, esc = false, arrEnd = -1;
  for (let i = arrStart; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (inStr) { if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { arrEnd = i; break; } }
  }
  const arr: any[] = JSON.parse(src.slice(arrStart, arrEnd + 1));

  const before: Record<string, number> = {};
  const after: Record<string, number> = {};
  for (const w of arr) before[w.level] = (before[w.level] || 0) + 1;

  let moved = 0;
  const unmatched = new Set(Object.keys(LEVEL_FIXES));
  for (const w of arr) {
    const key = String(w.word).trim().toLowerCase();
    const target = LEVEL_FIXES[key];
    if (!target) continue;
    unmatched.delete(key);
    if (w.level === target) continue;
    console.log(`  ${key.padEnd(12)} ${String(w.level).padEnd(9)} → ${target}`);
    w.level = target;
    moved++;
  }
  for (const w of arr) after[w.level] = (after[w.level] || 0) + 1;

  if (unmatched.size > 0) {
    console.warn(`収録語に無い語: ${[...unmatched].join(", ")}`);
  }

  fs.writeFileSync(file, src.slice(0, arrStart) + JSON.stringify(arr) + src.slice(arrEnd + 1));
  writeRankFixture(arr, loadSemcorRank(path.join(process.cwd(), ".cache/cntlist.rev")));
  console.log(`\n${moved}語のレベルを変更しました`);
  console.log("レベル別の語数:");
  for (const l of ["junior", "senior", "senior2", "senior3", "advanced"]) {
    console.log(`  ${l.padEnd(9)} ${String(before[l] || 0).padStart(5)} → ${String(after[l] || 0).padStart(5)}`);
  }
}

if (process.argv[1] && process.argv[1].includes("fix_levels")) main();
