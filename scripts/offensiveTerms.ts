/**
 * 教材に出さない語・表現（露骨な性的表現・罵倒語・差別語）。
 *
 * 単語データ・語義・語法は辞書（EJDict / WordNet）から機械的に作っているため、
 * 辞書が載せている俗語や差別語がそのまま画面に出ていた
 * （辞書のいちばん最初の語 a のコロケーションに "son of a bitch いけ好かないやつ"、
 *  suck の語義に「フェラチオをする」、mad の語義に「気違いの」など）。
 *
 * ここを1か所の決まりにして、次の3つが同じものを見る。
 *   - scripts/remove_offensive.ts … 今あるデータから取り除く
 *   - scripts/bake_senses.ts / bake_usage.ts … 作り直したときに再び入れない
 *   - tests/offensive.data.test.ts … すべてのデータを検査する（再混入を見張る）
 *
 * 暴力・死・病気・犯罪を表す語（murder / suicide / corpse / slavery など）は、
 * ニュースや入試の英文に普通に出てくる語なので対象にしない。
 * 対象は「その語そのものが露骨・侮蔑的で、教材として教える理由が無いもの」に限る。
 */

/**
 * 見出し語から外した語と理由。
 * 語義の一部が不適切なだけの語は外さず、語義のほうを直す（下の cleanSenseMeaning）。
 */
export const REMOVED_HEADWORDS: Record<string, string> = {
  carnal: "訳「肉欲の」、例文も「肉欲を克服しようとした」。性的な意味が中心の語",
  idiot: "人をののしる語。辞書の語義も差別語（「白痴」）",
  dumb: "訳「口のきけない」は、話せない人を指す差別的な用法",
  freak: "訳「奇形の／変わり者」。人に向けると差別・侮辱になる"
};

/**
 * 出さない英語（見出し・例文・語義の用例・コロケーション・語族）。
 * 綴りの一部が当たるだけの語（cocktail / Dickens / scrape）は単語境界で避ける。
 */
export const OFFENSIVE_EN = new RegExp(
  "\\b(" + [
    // dick は人名（"Tom and Dick were both heroes"）にも当たるので句で持つ
    "fuck\\w*", "shit\\w*", "bitch\\w*", "bastards?", "cunts?", "clever dick", "cock", "cocks",
    "pussy", "assholes?", "arse", "sluts?", "whores?", "hookers?", "prostitut\\w*", "porn\\w*",
    "sexy", "sex appeal", "sex symbol", "sex change", "make love", "wet dream",
    "intercourse", "erection", "horny", "dishy", "nude", "nudity", "penis", "vagina", "genitals?",
    "orgasm\\w*", "erotic\\w*", "masturbat\\w*", "rape", "raped", "rapist", "molest\\w*",
    "fag", "faggot", "nigger\\w*", "piss", "pissed", "wank\\w*", "twat", "turds?",
    "private parts", "indecent exposure", "night soil", "skin flick", "kept woman",
    "fancy (?:man|woman)", "white slave", "venereal", "mental deficiency",
    // 外した見出し語とその派生形（dumbfounded「唖然とした」のような別の語には当たらない）
    ...Object.keys(REMOVED_HEADWORDS).map(w => `${w}(?:s|ic|ly|ness|er|est)?`),
    "dumb show"
  ].join("|") + ")\\b",
  "i"
);

/**
 * 出さない日本語（訳・例文の和訳・語義・コロケーションや語族の訳）。
 * 熟語の一部として現れる無害な語（理性的・不具合・病原体）は当たらないようにしてある。
 */
export const OFFENSIVE_JA = new RegExp([
  // 性的な表現
  "性交", "性行為", "強姦", "〈女性〉に暴行", "肉欲", "色欲", "情欲", "好色", "勃起", "射精", "精液",
  "陰部", "陰茎", "フェラチオ", "わいせつ", "みだら", "春画", "わい談", "売春", "密通", "私通",
  "妾", "愛人", "情婦", "情夫", "ポルノ", "セクシー", "セックス",
  // 「理性的に」「女性的な」のような熟語には当たらないよう、前の字を見る
  "(?<![理知女男感個属中定])性的(?:魅力|欲望|に|な夢)", "性病(?!原)", "避妊用",
  // 排泄・下品な語
  "糞", "大便", "肛門", "尻", "ゲロ", "金玉", "いけ好かない",
  // 差別語
  "気違い", "かたわ", "片輪", "不具(?!合)", "びっこ", "白痴", "低能", "精神薄弱", "こじき", "乞食", "部落"
].join("|"));

/**
 * 語義の中の差別的な言い回しの言い換え（意味は残す）。
 * 置き換えたあとで、なお OFFENSIVE_JA に当たる断片は落とす。
 */
export const SENSE_REWRITES: [string, string][] = [
  ["びっこを引くこと", "足を引きずること"],
  ["びっこを引く", "足を引きずる"],
  ["をかたわにする", "の手足を不自由にする"],
  ["…を不具にする", "…の体を不自由にする"],
  ["身体障害の不具の", "身体に障害のある"],
  ["(こじきなどに与える)", "(困っている人に与える)"],
  ["(乞食・巡礼などの)", "(巡礼などの)"],
  ["部落", "集落"],
  // 辞書の誤字（「プロフィール」）。読むと「ゲロ」なので直す
  ["ゲロフィール", "プロフィール"]
];

/** 語義を区切りで分ける。かっこの中の区切り（「(知的・精神的に対して)」）では分けない */
function splitSense(meaning: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const c of meaning) {
    if ("(（〈《[".includes(c)) depth++;
    if (")）〉》]".includes(c)) depth = Math.max(0, depth - 1);
    if (depth === 0 && ",;、；・".includes(c)) {
      parts.push(cur);
      parts.push(c);
      cur = "";
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

/**
 * 語義を整える。差別的な言い回しは言い換え、露骨な断片は区切りごと落とす。
 * 何も残らなければ null（その語義ごと出さない）。
 *
 *   「気が狂った,気違いの」         → 「気が狂った」
 *   「吸うこと,吸収・フェラチオをする」→ 「吸うこと,吸収」
 *   「色欲,肉欲」                   → null
 */
export function cleanSenseMeaning(meaning: string): string | null {
  let m = meaning;
  for (const [from, to] of SENSE_REWRITES) m = m.split(from).join(to);
  if (!OFFENSIVE_JA.test(m)) return m;

  const parts = splitSense(m);
  const kept: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const text = parts[i];
    if (OFFENSIVE_JA.test(text)) continue;
    // 区切りは「残した断片の間」にだけ置く（前の断片に付いていた区切りを使う）
    if (kept.length > 0) kept.push(parts[i - 1] ?? ",");
    kept.push(text);
  }
  const out = kept.join("").trim();
  return out === "" ? null : out;
}

/** コロケーション・語族の1件を出してよいか */
export function isOffensiveEntry(english: string, japanese: string): boolean {
  return OFFENSIVE_EN.test(english) || OFFENSIVE_JA.test(japanese);
}
