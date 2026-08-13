/**
 * 辞書に見出しの無い語へ、基本形の語義を借りて入れる。
 *
 * 語義（src/data/senses.ts）は EJDict の見出しから作っている。
 * 見出しが無い語は語義が空のままで、収録7,730語のうち377語がそれにあたる。
 * 内訳は
 *   句（in front of / as a result など）      273語 … 辞書の見出しにならない
 *   新しい語（laptop / blog / karaoke など）   92語 … 1950年代の辞書に載っていない
 *   複合語（fund-raising など）                12語
 * で、大半は構造的に埋められない。
 *
 * ただし「活用形」と「明らかな派生語」は別で、基本形の語義を借りれば済む。
 * bake_senses.ts にも同じ仕組みがあるが、
 *   is / were / been … EJDict の項目が「beの三人称・単数・現在」という
 *                      相互参照だけで、語義として残らない（意図した挙動）
 *   criteria / media … ラテン語系の複数形で、規則的な活用として拾えない
 * といった語は拾えていなかった。is・were・been は最頻出の語なのに
 * 辞書を引いても語義の欄が空だった。
 *
 * 規則を足すと他の語に波及して確かめようがなくなるため
 * （outsource←source、interactive←active のような取り違えが起きる）、
 * ここでは1語ずつ列挙する。
 *
 *   npx tsx scripts/borrow_senses.ts
 */
import fs from "fs";
import path from "path";
import { initialVocabulary } from "../src/data/vocabulary";

/** 語 → 語義を借りる基本形 */
const BORROW: Record<string, string> = {
  // be動詞・do の活用。EJDict の項目が相互参照だけで語義が残らない
  is: "be",
  were: "be",
  been: "be",
  did: "do",
  // 不規則動詞の過去分詞
  shaken: "shake",
  // ラテン語・ギリシャ語系の複数形
  criteria: "criterion",
  media: "medium",
  // 接頭辞 re-（もう一度〜する）
  reschedule: "schedule",
  redesign: "design",
  // 接尾辞による派生
  implementation: "implement",
  profitability: "profitable",
  sustainability: "sustainable",
  unsustainable: "sustainable",
  wearability: "wear",
  usability: "use",
  deregulation: "regulate",
  privatization: "private",
  acidic: "acid",
  guitarist: "guitar",
  stressful: "stress",
  insightful: "insight",
  innovative: "innovate",
  collaborative: "collaborate",
  aestheticism: "aesthetic"
};

/*
 * 借りなかった語。
 * 複合語は「部分の意味の足し算」ではないので、基本形の語義を当てると誤解を招く。
 *   laptop ← lap（ひざ）／ database ← data ／ website ← site ／ desktop ← desk
 *   download ← load（積む）／ outsource ← source ／ synergy ← energy（語源が別）
 *   demerger ← merger（de- が意味を反転させる）
 */

const file = path.join(process.cwd(), "src/data/senses.ts");
const src = fs.readFileSync(file, "utf8");
const start = src.indexOf("{", src.indexOf("wordSenses"));
const end = src.lastIndexOf("};") + 1;
const senses: Record<string, any[]> = JSON.parse(src.slice(start, end));

const byWord = new Map<string, any>();
for (const w of initialVocabulary) byWord.set(String(w.word).toLowerCase(), w);

const added: string[] = [];
const skipped: string[] = [];

for (const [word, baseWord] of Object.entries(BORROW)) {
  const target = byWord.get(word);
  const base = byWord.get(baseWord);
  if (!target) { skipped.push(`${word}: 収録語に無い`); continue; }
  if (senses[target.id]?.length) { skipped.push(`${word}: すでに語義がある`); continue; }
  const from = base && senses[base.id];
  if (!from?.length) { skipped.push(`${word}: ${baseWord} に語義が無い`); continue; }

  // 借りた語義には由来を書く。
  // 使用割合(share)と用例(usage)は基本形について測ったもので、
  // この語自身の数字ではないので落とす（tests/senses.test.ts が固定している）。
  senses[target.id] = from.map(s => {
    const copy: any = { ...s, from: baseWord };
    delete copy.share;
    delete copy.usage;
    return copy;
  });
  added.push(`${word} ← ${baseWord}（${from.length}件）`);
}

if (added.length > 0) {
  fs.writeFileSync(file, src.slice(0, start) + JSON.stringify(senses) + src.slice(end), "utf8");
}
console.log(`${added.length}語に基本形の語義を入れました`);
for (const line of added) console.log("  " + line);
if (skipped.length > 0) {
  console.log("入れなかった語:");
  for (const line of skipped) console.log("  " + line);
}
