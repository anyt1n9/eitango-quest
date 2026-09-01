import * as fs from "fs";
import * as path from "path";
import { pickDistractors, Candidate } from "../src/distractors";
import { shuffle } from "../src/shuffle";
import { VOCABULARY_FILE, readVocabularyFile, writeVocabularyFile } from "./vocabularyFile";

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
  veritable: "adjective",

  // ------------------------------------------------------------------
  // ここから下は「動詞として教えているのに、WordNet が動詞の文型を
  // 1つも記録していない語」を洗い出して直したもの。
  // 動詞1,626語のうち167語に文型が無く、その大半は WordNet の抜けではなく
  // 品詞の付け間違いだった（形容詞・名詞を動詞として教えていた）。
  //
  // 誤答は同じ品詞から選ばれるので、形容詞が動詞の四択に混ざると
  // 品詞での消去法が効かなくなり、逆に動詞の四択には形容詞が並ぶ。
  //
  // 判断の基準は上と同じで、実測(SemCor)が別の品詞に50%以上偏っていること。
  // ------------------------------------------------------------------
  similar: "adjective",        // 実測 形容詞100% ／ 訳「似ている，類似の」
  certain: "adjective",        // 実測 形容詞100% ／ 訳「ある，確信している」
  bilingual: "adjective",      // 実測 形容詞100%
  historic: "adjective",       // 実測 形容詞100%
  confident: "adjective",      // 実測 形容詞100%
  indeed: "adverb",            // 実測 副詞100%
  dependent: "adjective",      // 実測 形容詞83%
  satisfactory: "adjective",   // 実測 形容詞100%
  pregnant: "adjective",       // 実測 形容詞100%
  aware: "adjective",          // 実測 形容詞100%
  civilized: "adjective",      // 実測 形容詞100%
  multiple: "adjective",       // 実測 形容詞100%（訳も直した。下の TRANSLATION_FIXES）
  increasing: "adjective",     // 実測 形容詞100%
  talented: "adjective",       // 実測 形容詞100%
  solvent: "adjective",        // 実測は名詞100%（溶剤）だが、訳「支払い能力のある」は形容詞
  corresponding: "adjective",  // 実測 形容詞100%
  angular: "adjective",        // 実測 形容詞100%
  deserving: "adjective",      // 実測 形容詞100%
  perennial: "adjective",      // 実測 形容詞100%
  widespread: "adjective",     // 実測 形容詞100%
  trustworthy: "adjective",    // 実測 形容詞100%
  occupied: "adjective",       // 実測 形容詞100%
  considerate: "adjective",    // 実測 形容詞100%
  situated: "adjective",       // 実測 形容詞100%
  ambivalent: "adjective",     // 実測 形容詞100%
  discerning: "adjective",     // 実測 形容詞100%
  disparate: "adjective",      // 実測 形容詞100%
  erudite: "adjective",        // 実測 形容詞100%
  ubiquitous: "adjective",     // 実測 形容詞100%
  popular: "adjective",        // 実測 形容詞100%
  dear: "adjective",           // 実測 形容詞69%
  exciting: "adjective",       // 実測 形容詞100%
  armchair: "noun",            // 実測 名詞75% ／ 訳「ひじ掛けいす」
  dead: "adjective",           // 実測 形容詞89%
  wheelchair: "noun",          // 実測 名詞100%
  challenging: "adjective",    // 実測 形容詞100%
  deadly: "adjective",         // 実測 形容詞100%
  fond: "adjective",           // 実測 形容詞100%
  gifted: "adjective",         // 実測 形容詞100%
  outward: "adjective",        // 実測 形容詞75%
  potential: "adjective",      // 実測 形容詞57%
  proud: "adjective",          // 実測 形容詞100%
  qualified: "adjective",      // 実測 形容詞100%
  shiny: "adjective",          // 実測 形容詞100%
  tiring: "adjective",         // 実測 形容詞100%
  wardrobe: "noun",            // 実測 名詞100%
  worthwhile: "adjective",     // 実測 形容詞100%
  worthy: "adjective",         // 実測 形容詞100%
  drought: "noun",             // 実測 名詞100%
  exhausting: "adjective",     // 実測 形容詞100%
  indebted: "adjective",       // 実測 形容詞100%
  misleading: "adjective",     // 実測 形容詞100%
  motivated: "adjective",      // 実測 形容詞100%
  reflective: "adjective",     // 実測 形容詞100%
  shaky: "adjective",          // 実測 形容詞100%
  successive: "adjective",     // 実測 形容詞100%
  turbulent: "adjective",      // 実測 形容詞100%
  adjoining: "adjective",      // 実測 形容詞100%
  beguiling: "adjective",      // 実測 形容詞100%
  crippling: "adjective",      // 実測 形容詞100%
  elastic: "adjective",        // 実測 形容詞100%
  engrossing: "adjective",     // 実測 形容詞100%
  extant: "adjective",         // 実測 形容詞100%
  hostile: "adjective",        // 実測 形容詞100%
  melancholy: "noun",          // 実測 名詞57% ／ 訳「憂うつ、もの悲しさ」
  privileged: "adjective",     // 実測 形容詞100%
  resounding: "adjective",     // 実測 形容詞100%
  sentient: "adjective",       // 実測 形容詞100%
  symptomatic: "adjective",    // 実測 形容詞100%
  telltale: "adjective",       // 実測 形容詞100%

  // ------------------------------------------------------------------
  // SemCor（1990年代の英文コーパス）に1度も出てこない語。
  // 実測が無いので、**教材が教えている訳**を根拠に1語ずつ直した。
  // どれも訳が形容詞・名詞の形（「〜のある」「〜な」「〜さ」）で、
  // かつ WordNet が動詞の文型を持たない。
  // -ing / -ed の分詞（considering, expecting, fading など）は動詞の活用形
  // なので動詞のまま残す。
  // ------------------------------------------------------------------
  faulty: "adjective",         // 欠点のある
  compelling: "adjective",     // 説得力のある
  cogent: "adjective",         // 説得力のある、適切な
  soporific: "adjective",      // 眠気を誘う、催眠の
  beneficent: "adjective",     // 善を行う、慈善的な
  captious: "adjective",       // あら探しをする、難癖をつける
  cognizant: "adjective",      // 認識している、承知の
  concomitant: "adjective",    // 付随する、共存する
  congenial: "adjective",      // 気の合う、好みに合う
  contrite: "adjective",       // 悔いる、痛悔した
  culpable: "adjective",       // 刑に値する、有罪の
  devoid: "adjective",         // 欠いている、全くない
  resilient: "adjective",      // 回復力のある、弾力的な
  snowy: "adjective",          // 雪の降る、雪の積もった
  caring: "adjective",         // 思いやりのある、世話好きな
  creepy: "adjective",         // ぞっとする、気味の悪い
  grueling: "adjective",       // へとへとに疲れさせる、過酷な
  gutsy: "adjective",          // 勇気のある、ど根性のある
  lackluster: "adjective",     // 精彩を欠く、さえない
  painstaking: "adjective",    // 骨の折れる、入念な
  reminiscent: "adjective",    // （～を）思い出させる
  torrential: "adjective",     // （雨が）激しく降る、奔流の
  traumatic: "adjective",      // 心に深い傷を残す、痛ましい
  unnerving: "adjective",      // 不安にさせる、気味の悪い
  unsettling: "adjective",     // 不安にさせる、落ち着かない
  intrigued: "adjective",      // 興味をそそられた
  platitude: "noun"            // お決まりのせりふ、陳腐な言葉
};

/**
 * 訳そのものが間違っていた語。
 *
 * multiple の訳は「掛け算する」（multiply との取り違え）で、
 * 品詞を形容詞に直しても訳が動詞のままでは画面上で食い違う。
 * 訳を変えると四択の正解も変わるので、ここで直して選択肢を作り直す。
 */
const TRANSLATION_FIXES: Record<string, string> = {
  multiple: "多数の、複数の"
};

/**
 * 実測の割合では別の品詞が優勢だが、**この教材が教えている訳**は別の品詞なので
 * 変えなかった語。割合だけで機械的に寄せると、画面上で訳と品詞が食い違う。
 *   desert   … 訳「砂漠」は名詞。動詞69%は「見捨てる」の意味
 *   orient   … 訳「東洋」は名詞。動詞83%は「方向づける」の意味
 *   downtown … 訳「中心街へ」は副詞的。形容詞54%と差も小さい
 *   solvent  … 訳「支払い能力のある」は形容詞。名詞100%は「溶剤」の意味
 */
const KEPT_ON_PURPOSE = ["desert", "orient", "downtown", "solvent"];

/*
 * 単語配列の範囲は共通処理に任せる。
 * ここだけ `indexOf("[{")` と `indexOf("}];")` でファイル全体を探していたため、
 * 例文や訳の中に同じ並びが現れると境界を取り違え、
 * 誤った範囲を丸ごと書き戻して収録データを壊す恐れがあった。
 */
const file = VOCABULARY_FILE;
const { source, words } = readVocabularyFile(file);
const changed: string[] = [];
const targets: any[] = [];
/** 直す前の訳。訳を書き換えた語を誤答に使っている語も作り直すために控えておく */
const oldTranslations = new Set<string>();

for (const w of words) {
  const key = String(w.word).toLowerCase();
  const want = POS_FIXES[key];
  if (!want) continue;
  targets.push(w);
  const newTranslation = TRANSLATION_FIXES[key];
  if (newTranslation && w.translation !== newTranslation) {
    oldTranslations.add(String(w.translation));
    changed.push(`${w.word}: 訳「${w.translation}」→「${newTranslation}」`);
    w.translation = newTranslation;
  }
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
const fixedTranslations = new Set([...targets.map(w => String(w.translation)), ...oldTranslations]);
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

writeVocabularyFile(source, words, file);

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
