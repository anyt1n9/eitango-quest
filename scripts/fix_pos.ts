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
  alone: "adverb"
};

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
console.log(`${changed.length}語の品詞を直し、${rebuild.length}語の四択を作り直しました:`);
for (const line of changed) console.log("  " + line);
