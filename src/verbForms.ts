/**
 * 動詞の活用（原形 → 過去形 → 過去分詞）。
 *
 * この教材は見出し語を原形で持っており、活用形は教えていなかった。
 * 一方で -ed 形が独立した見出しとして13語混ざっており（divided / caused など）、
 * 「同じ語を2回覚えさせる」状態になっていた。その13語は見出しから外し、
 * 活用は表としてまとめて学べるようにしたのがこのモジュールの役割。
 *
 * 不規則動詞は手で表を持ち、それ以外は規則で作る。
 * 規則変化の綴りは英語の正書法どおりに扱う必要がある。
 *   like → liked      (e で終わる語は d だけ足す)
 *   study → studied   (子音 + y は y を i に変える)
 *   stop → stopped    (短母音 + 子音1つで終わる語は子音を重ねる)
 *   panic → panicked  (c で終わる語は k を補う)
 */
import { Word } from "./types";

/** 活用のかたち */
export interface VerbForms {
  base: string;
  past: string;
  participle: string;
  ing: string;
  irregular: boolean;
  /**
   * 変化の型。不規則動詞を覚えるときの定番の分類。
   *   AAA … 3つとも同じ（cut - cut - cut）
   *   ABA … 原形と過去分詞が同じ（come - came - come）
   *   ABB … 過去形と過去分詞が同じ（buy - bought - bought）
   *   ABC … 3つとも違う（go - went - gone）
   */
  pattern: "AAA" | "ABA" | "ABB" | "ABC" | "規則変化";
}

/**
 * 不規則動詞の表。[原形, 過去形, 過去分詞]。
 * 過去形・過去分詞に2通りある語は、英米で一般的な方を採っている。
 */
export const IRREGULAR_VERBS: [base: string, past: string, participle: string][] = [
  // ── 3つとも同じ（AAA）──
  ["cut", "cut", "cut"], ["put", "put", "put"], ["set", "set", "set"],
  ["let", "let", "let"], ["hit", "hit", "hit"], ["shut", "shut", "shut"],
  ["cost", "cost", "cost"], ["hurt", "hurt", "hurt"], ["quit", "quit", "quit"],
  ["spread", "spread", "spread"], ["burst", "burst", "burst"], ["cast", "cast", "cast"],
  ["split", "split", "split"], ["upset", "upset", "upset"], ["bet", "bet", "bet"],
  ["read", "read", "read"], ["rid", "rid", "rid"], ["shed", "shed", "shed"],
  ["thrust", "thrust", "thrust"], ["broadcast", "broadcast", "broadcast"],

  // ── 原形と過去分詞が同じ（ABA）──
  ["come", "came", "come"], ["become", "became", "become"], ["overcome", "overcame", "overcome"],
  ["run", "ran", "run"],

  // ── 過去形と過去分詞が同じ（ABB）──
  ["buy", "bought", "bought"], ["bring", "brought", "brought"], ["think", "thought", "thought"],
  ["fight", "fought", "fought"], ["catch", "caught", "caught"], ["teach", "taught", "taught"],
  ["seek", "sought", "sought"], ["build", "built", "built"], ["send", "sent", "sent"],
  ["spend", "spent", "spent"], ["lend", "lent", "lent"], ["bend", "bent", "bent"],
  ["feel", "felt", "felt"], ["keep", "kept", "kept"], ["sleep", "slept", "slept"],
  ["sweep", "swept", "swept"], ["weep", "wept", "wept"], ["creep", "crept", "crept"],
  ["leave", "left", "left"], ["lose", "lost", "lost"], ["mean", "meant", "meant"],
  ["meet", "met", "met"], ["lead", "led", "led"], ["feed", "fed", "fed"],
  ["bleed", "bled", "bled"], ["breed", "bred", "bred"], ["speed", "sped", "sped"],
  ["hold", "held", "held"], ["sell", "sold", "sold"], ["tell", "told", "told"],
  ["find", "found", "found"], ["bind", "bound", "bound"], ["grind", "ground", "ground"],
  ["wind", "wound", "wound"], ["hear", "heard", "heard"], ["say", "said", "said"],
  ["pay", "paid", "paid"], ["lay", "laid", "laid"], ["make", "made", "made"],
  ["have", "had", "had"], ["stand", "stood", "stood"], ["understand", "understood", "understood"],
  ["sit", "sat", "sat"], ["get", "got", "got"], ["shoot", "shot", "shot"],
  ["win", "won", "won"], ["hang", "hung", "hung"], ["dig", "dug", "dug"],
  ["stick", "stuck", "stuck"], ["strike", "struck", "struck"], ["swing", "swung", "swung"],
  ["cling", "clung", "clung"], ["fling", "flung", "flung"], ["sling", "slung", "slung"],
  ["spin", "spun", "spun"], ["shine", "shone", "shone"], ["light", "lit", "lit"],
  ["leap", "leapt", "leapt"], ["deal", "dealt", "dealt"], ["kneel", "knelt", "knelt"],
  ["burn", "burnt", "burnt"], ["spell", "spelt", "spelt"], ["spill", "spilt", "spilt"],
  ["smell", "smelt", "smelt"], ["lean", "leant", "leant"], ["dream", "dreamt", "dreamt"],
  ["flee", "fled", "fled"], ["shoe", "shod", "shod"], ["slide", "slid", "slid"],
  ["sting", "stung", "stung"], ["strive", "strove", "striven"], ["weave", "wove", "woven"],
  ["wring", "wrung", "wrung"], ["knit", "knit", "knit"], ["sow", "sowed", "sown"],

  // ── 3つとも違う（ABC）──
  ["go", "went", "gone"], ["do", "did", "done"], ["be", "was", "been"],
  ["see", "saw", "seen"], ["eat", "ate", "eaten"], ["give", "gave", "given"],
  ["take", "took", "taken"], ["write", "wrote", "written"], ["drive", "drove", "driven"],
  ["ride", "rode", "ridden"], ["rise", "rose", "risen"], ["speak", "spoke", "spoken"],
  ["break", "broke", "broken"], ["choose", "chose", "chosen"], ["freeze", "froze", "frozen"],
  ["steal", "stole", "stolen"], ["wake", "woke", "woken"], ["draw", "drew", "drawn"],
  ["know", "knew", "known"], ["grow", "grew", "grown"], ["throw", "threw", "thrown"],
  ["blow", "blew", "blown"], ["fly", "flew", "flown"], ["show", "showed", "shown"],
  ["begin", "began", "begun"], ["drink", "drank", "drunk"], ["sing", "sang", "sung"],
  ["swim", "swam", "swum"], ["ring", "rang", "rung"], ["sink", "sank", "sunk"],
  ["shrink", "shrank", "shrunk"], ["spring", "sprang", "sprung"], ["fall", "fell", "fallen"],
  ["forget", "forgot", "forgotten"], ["forgive", "forgave", "forgiven"], ["hide", "hid", "hidden"],
  ["bite", "bit", "bitten"], ["wear", "wore", "worn"], ["tear", "tore", "torn"],
  ["bear", "bore", "borne"], ["swear", "swore", "sworn"], ["shake", "shook", "shaken"],
  ["mistake", "mistook", "mistaken"], ["lie", "lay", "lain"], ["dive", "dove", "dived"],
  ["forbid", "forbade", "forbidden"], ["tread", "trod", "trodden"], ["sew", "sewed", "sewn"],
  ["spit", "spat", "spat"], ["slit", "slit", "slit"], ["arise", "arose", "arisen"],
  ["awake", "awoke", "awoken"], ["withdraw", "withdrew", "withdrawn"]
];

const IRREGULAR = new Map(IRREGULAR_VERBS.map(([b, p, pp]) => [b, { past: p, participle: pp }]));

const VOWELS = "aeiou";
const isVowel = (c: string) => VOWELS.includes(c);

/**
 * 2音節以上で語末に強勢があり、語末の子音を重ねる動詞。
 *
 * 強勢の位置は綴りから分からないため、一覧で持つしかない。
 *   prefer → preferred（語末に強勢）  ⇄  offer → offered（語頭に強勢）
 *   begin  → beginning              ⇄  open  → opening
 * ここに載せないと prefered / begining のような誤った綴りになる。
 *
 * travel / cancel / label のように語頭に強勢がある語は米つづりで l を重ねないため、
 * ここには含めない（英つづりでは travelled となるが、この教材は米つづりに揃えている）。
 */
const DOUBLE_FINAL = new Set([
  "prefer", "refer", "occur", "recur", "concur", "incur", "defer", "infer", "confer",
  "transfer", "deter", "inter", "abhor",
  "admit", "permit", "commit", "omit", "submit", "transmit", "emit", "remit", "acquit",
  "begin", "forget", "forbid", "regret", "upset", "beset", "offset", "reset",
  "control", "patrol", "propel", "compel", "expel", "repel", "excel", "dispel", "extol",
  "equip", "format", "allot", "rebut", "unwrap", "entrap", "outfit", "befit",
  "occurred", "prohibit"
]);

/**
 * 語末の子音を重ねるかどうか。
 * 「短母音 + 子音1つ」で終わり、かつ1音節（または語末に強勢がある）語が対象。
 * 強勢は綴りからは分からないため、1音節の語に限って適用する
 * （visit → visited のように、2音節で語末に強勢が無い語を誤って visitted にしないため）。
 */
function shouldDoubleFinal(base: string): boolean {
  if (base.length < 3) return false;
  const last = base[base.length - 1];
  const mid = base[base.length - 2];
  const first = base[base.length - 3];
  if (!/[a-z]/.test(last) || isVowel(last) || "wxy".includes(last)) return false;
  if (!isVowel(mid) || isVowel(first)) return false;
  if (DOUBLE_FINAL.has(base)) return true;
  // 母音が1つだけなら1音節とみなす
  const vowelCount = [...base].filter(isVowel).length;
  return vowelCount === 1;
}

/** 規則変化の過去形・過去分詞をつくる */
export function regularPast(base: string): string {
  const b = base.toLowerCase();
  if (b.endsWith("e")) return b + "d";                       // like → liked
  if (/[^aeiou]y$/.test(b)) return b.slice(0, -1) + "ied";   // study → studied
  if (b.endsWith("c")) return b + "ked";                     // panic → panicked
  if (shouldDoubleFinal(b)) return b + b[b.length - 1] + "ed"; // stop → stopped
  return b + "ed";
}

/** 規則変化の ing 形をつくる */
export function regularIng(base: string): string {
  const b = base.toLowerCase();
  if (b.endsWith("ie")) return b.slice(0, -2) + "ying";      // lie → lying
  if (b.endsWith("ee")) return b + "ing";                    // see → seeing
  if (b.endsWith("e")) return b.slice(0, -1) + "ing";        // like → liking
  if (b.endsWith("c")) return b + "king";                    // panic → panicking
  if (shouldDoubleFinal(b)) return b + b[b.length - 1] + "ing"; // stop → stopping
  return b + "ing";
}

/** 3つの形から変化の型を判定する */
export function classifyPattern(base: string, past: string, participle: string): VerbForms["pattern"] {
  if (base === past && past === participle) return "AAA";
  if (base === participle && base !== past) return "ABA";
  if (past === participle) return "ABB";
  return "ABC";
}

/** 原形から活用を作る。不規則動詞は表を、それ以外は規則を使う */
export function conjugate(base: string): VerbForms {
  const b = base.trim().toLowerCase();
  const irr = IRREGULAR.get(b);
  if (irr) {
    return {
      base: b,
      past: irr.past,
      participle: irr.participle,
      ing: regularIng(b),
      irregular: true,
      pattern: classifyPattern(b, irr.past, irr.participle)
    };
  }
  const past = regularPast(b);
  return { base: b, past, participle: past, ing: regularIng(b), irregular: false, pattern: "規則変化" };
}

/**
 * 収録語のうち動詞だけを取り出して活用表にする。
 * 見出しに空白を含む句動詞（give up など）は、活用するのが先頭の語だけで
 * 表の形に収まらないため除く。
 */
export function buildVerbTable(vocabulary: Word[]): (VerbForms & { word: Word })[] {
  const seen = new Set<string>();
  const out: (VerbForms & { word: Word })[] = [];
  for (const w of vocabulary) {
    if (w.pos !== "verb" || /\s/.test(w.word.trim())) continue;
    const key = w.word.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...conjugate(w.word), word: w });
  }
  return out.sort((a, b) => a.base.localeCompare(b.base));
}

/** 型の説明（画面の凡例に使う） */
export const PATTERN_NOTES: Record<VerbForms["pattern"], string> = {
  AAA: "3つとも同じ",
  ABA: "原形と過去分詞が同じ",
  ABB: "過去形と過去分詞が同じ",
  ABC: "3つとも違う",
  規則変化: "-ed を付ける"
};
