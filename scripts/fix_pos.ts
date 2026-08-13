import * as fs from "fs";
import * as path from "path";
import { pickDistractors, Candidate } from "../src/distractors";
import { shuffle } from "../src/shuffle";

/**
 * 収録語の品詞を1語ずつ直す（src/data/vocabulary.ts の pos を書き換える）。
 *
 * 品詞は scripts/bake_pos.ts が綴りと訳から推定して焼き込んでいる。
 * 推定なので外れることがあり、辞書に品詞での絞り込みを付けたことで
 * 「am / is / are が名詞に並ぶ」という形で表に出た。
 *
 * 推定の規則をいじると他の語に波及して確かめようがなくなるため、
 * 明らかに違う語だけをここに列挙して直す（fix_levels.ts の LEVEL_FIXES と同じやり方）。
 *
 * 品詞を変えたら四択の誤答も作り直す。誤答は「同じ品詞・同じレベル」から
 * 選ばれているので、品詞だけ変えると誤答が別の品詞のまま残り、
 * 品詞での消去法が復活してしまう（tests/vocabulary.data.test.ts が落ちる）。
 * bake_options.ts は全語を引き直してしまうため、ここでは直した語だけを作り直す。
 *
 *   npx tsx scripts/fix_pos.ts
 */

/** 綴り → 正しい品詞 */
const POS_FIXES: Record<string, string> = {
  // be動詞。訳が「〜である」なので名詞と推定されていた
  be: "verb",
  am: "verb",
  is: "verb",
  are: "verb",
  was: "verb",
  were: "verb",
  been: "verb",
  // 訳「一人で」から名詞と推定されていたが副詞
  alone: "adverb",

  // ここから下は、辞書(WordNet)がその品詞を記録しておらず、
  // かつ実測(SemCor)の使用割合が50%以上ある品詞へ寄せたもの。
  // 訳と突き合わせて1語ずつ確認した（DESERTED_ON_PURPOSE も参照）。
  nevertheless: "adverb",
  celebration: "noun",
  variety: "noun",
  overseas: "adverb",
  hesitate: "verb",
  incorrect: "adjective",
  asleep: "adjective",
  commit: "verb",
  annoy: "verb",
  controversial: "adjective",
  quite: "adverb",
  dozen: "noun",
  mystery: "noun",
  relevant: "adjective",
  jewish: "adjective",   // 照合は小文字で行う
  elaborate: "adjective",
  accustomed: "adjective",
  apart: "adverb",
  behalf: "noun",
  greeting: "noun",
  applicable: "adjective",
  transact: "verb",
  loose: "adjective",
  adjacent: "adjective",
  disabled: "adjective",
  wilt: "verb",
  mere: "adjective",
  revival: "noun",
  antitrust: "adjective",
  sympathetic: "adjective",
  misanthrope: "noun",
  want: "verb",
  ask: "verb",
  call: "verb",
  chief: "adjective",
  pardon: "verb",
  set: "verb",
  besides: "adverb",
  elsewhere: "adverb",
  musical: "adjective",
  aside: "adverb",
  jealous: "adjective",
  paddle: "verb",
  prominent: "adjective",
  protective: "adjective",
  upward: "adverb",
  astonishing: "adjective",
  compassionate: "adjective",
  costly: "adjective",
  enduring: "adjective",
  influential: "adjective",
  manual: "noun",
  outdo: "verb",
  salty: "adjective",
  taunt: "verb",
  thrilling: "adjective",
  untie: "verb",
  enterprising: "adjective",
  gnaw: "verb",
  gruesome: "adjective",
  intrinsic: "adjective",
  macabre: "adjective",
  nascent: "adjective",
  unoccupied: "adjective",
  veritable: "adjective"
};

/**
 * 実測の割合では別の品詞が優勢だが、**この教材が教えている訳**は別の品詞なので
 * 変えなかった語。割合だけで機械的に寄せると、画面上で訳と品詞が食い違う。
 *   desert   … 訳「砂漠」は名詞。動詞69%は「見捨てる」の意味
 *   orient   … 訳「東洋」は名詞。動詞83%は「方向づける」の意味
 *   downtown … 訳「中心街へ」は副詞的。形容詞54%と差も小さい
 */
const KEPT_ON_PURPOSE = ["desert", "orient", "downtown"];

const file = path.join(process.cwd(), "src/data/vocabulary.ts");
const source = fs.readFileSync(file, "utf8");

const start = source.indexOf("[{");
const end = source.indexOf("}];") + 2;
if (start < 0 || end < 2) {
  console.error("vocabulary.ts の単語配列を見つけられませんでした");
  process.exit(1);
}

const words: any[] = JSON.parse(source.slice(start, end));
const changed: string[] = [];
const targets: any[] = [];

for (const w of words) {
  const want = POS_FIXES[String(w.word).toLowerCase()];
  if (!want) continue;
  targets.push(w);
  if (w.pos === want) continue;
  changed.push(`${w.word}: ${w.pos} → ${want}`);
  w.pos = want;
}

if (targets.length === 0) {
  console.log("対象の語が見つかりませんでした。");
  process.exit(1);
}

/*
 * 作り直すのは直した語だけでは足りない。
 * 直した語は他の語の誤答としても使われており、
 * 品詞が変わった時点でその語の四択に別の品詞が混ざる
 * （例: onion(名詞) の誤答に「〜である」(am) が残る）。
 * 直した語を誤答に含む語も一緒に作り直す。
 */
const fixedWords = new Set(targets.map(w => String(w.word)));
const fixedTranslations = new Set(targets.map(w => String(w.translation)));
const rebuild = words.filter(w =>
  fixedWords.has(String(w.word))
  || (Array.isArray(w.options) && w.options.some((o: string) => fixedTranslations.has(o)))
  || (Array.isArray(w.sentenceOptions) && w.sentenceOptions.some((o: string) => fixedWords.has(o)))
);

const candidates: Candidate[] = words.map(w => ({
  word: w.word,
  translation: w.translation,
  level: w.level,
  pos: w.pos
}));
for (const w of rebuild) {
  const target: Candidate = { word: w.word, translation: w.translation, level: w.level, pos: w.pos };
  const pool = candidates.filter(c => c.pos === target.pos);
  w.options = shuffle([w.translation, ...pickDistractors(target, pool, 3, "translation")]);
  w.sentenceOptions = shuffle([w.word, ...pickDistractors(target, pool, 3, "word")]);
}

fs.writeFileSync(file, source.slice(0, start) + JSON.stringify(words) + source.slice(end), "utf8");

/*
 * 品詞を変えると、品詞に結び付いた他のデータも合わなくなる。
 *   語義(senses.ts) … 「教材が教えている品詞の語義には用例を付けない」
 *                     （単語データ側に例文があるため）という決まりに引っかかる
 *   語法(wordUsage.ts) … 文型は動詞として教えている語にだけ付ける。
 *                        動詞でなくなった語に文型が残ると、名詞に動詞の語法が出る
 * どちらも生成し直すには通信と .cache が要るので、ここで該当箇所だけ落とす。
 */
const fixedIds = new Set(targets.map(w => String(w.id)));
const fixedPos = new Map(targets.map(w => [String(w.id), String(w.pos)]));

const sensesFile = path.join(process.cwd(), "src/data/senses.ts");
const sensesSrc = fs.readFileSync(sensesFile, "utf8");
const sStart = sensesSrc.indexOf("{", sensesSrc.indexOf("wordSenses"));
const sEnd = sensesSrc.lastIndexOf("};") + 1;
const senses: Record<string, any[]> = JSON.parse(sensesSrc.slice(sStart, sEnd));
let droppedUsage = 0;
for (const [id, list] of Object.entries(senses)) {
  const pos = fixedPos.get(id);
  if (!pos || !Array.isArray(list)) continue;
  for (const sense of list) {
    if (sense.usage && sense.pos === pos) { delete sense.usage; droppedUsage++; }
  }
}
if (droppedUsage > 0) {
  fs.writeFileSync(sensesFile, sensesSrc.slice(0, sStart) + JSON.stringify(senses) + sensesSrc.slice(sEnd), "utf8");
}

const usageFile = path.join(process.cwd(), "src/data/wordUsage.ts");
const usageSrc = fs.readFileSync(usageFile, "utf8");
const uStart = usageSrc.indexOf("{", usageSrc.indexOf("wordUsage"));
const uEnd = usageSrc.lastIndexOf("};") + 1;
const usage: Record<string, any> = JSON.parse(usageSrc.slice(uStart, uEnd));
let droppedPatterns = 0;
for (const id of Object.keys(usage)) {
  if (!fixedIds.has(id)) continue;
  if (fixedPos.get(id) === "verb") continue;
  if (usage[id]?.patterns?.length) { delete usage[id].patterns; droppedPatterns++; }
  if (Object.keys(usage[id]).length === 0) delete usage[id];
}
if (droppedPatterns > 0) {
  fs.writeFileSync(usageFile, usageSrc.slice(0, uStart) + JSON.stringify(usage) + usageSrc.slice(uEnd), "utf8");
}
console.log(`語義の用例を${droppedUsage}件、動詞でなくなった語の文型を${droppedPatterns}件外しました`);
console.log(`${changed.length}語の品詞を直し、${rebuild.length}語の四択を作り直しました`);
console.log(`（訳と食い違うため意図的に変えなかった語: ${KEPT_ON_PURPOSE.join(", ")}）`);
for (const line of changed) console.log("  " + line);
