import { describe, it, expect } from "vitest";
import {
  conjugate, regularPast, regularIng, classifyPattern, buildVerbTable,
  IRREGULAR_VERBS, PATTERN_NOTES
} from "../src/verbForms";
import { initialVocabulary } from "../src/data/vocabulary";

/**
 * 動詞の活用表。
 *
 * 綴りの規則は例外が多く、間違えると学習者が誤った形を覚えてしまう。
 * 特に「語末の子音を重ねるか」は強勢の位置で決まり、綴りからは分からない
 * （prefer → preferred だが offer → offered）。
 */

describe("regularPast", () => {
  it("そのまま -ed を付ける", () => {
    expect(regularPast("play")).toBe("played");
    expect(regularPast("watch")).toBe("watched");
    expect(regularPast("open")).toBe("opened");
    expect(regularPast("visit")).toBe("visited");
  });

  it("e で終わる語は d だけ足す", () => {
    expect(regularPast("like")).toBe("liked");
    expect(regularPast("agree")).toBe("agreed");
    expect(regularPast("die")).toBe("died");
  });

  it("子音 + y は y を i に変える", () => {
    expect(regularPast("study")).toBe("studied");
    expect(regularPast("carry")).toBe("carried");
  });

  it("母音 + y はそのまま", () => {
    expect(regularPast("play")).toBe("played");
    expect(regularPast("enjoy")).toBe("enjoyed");
  });

  it("短母音 + 子音1つの1音節語は子音を重ねる", () => {
    expect(regularPast("stop")).toBe("stopped");
    expect(regularPast("plan")).toBe("planned");
    expect(regularPast("drop")).toBe("dropped");
  });

  it("w・x・y で終わる語は重ねない", () => {
    expect(regularPast("fix")).toBe("fixed");
    expect(regularPast("show")).toBe("showed");
  });

  it("長母音・二重母音の語は重ねない", () => {
    expect(regularPast("rain")).toBe("rained");
    expect(regularPast("need")).toBe("needed");
    expect(regularPast("look")).toBe("looked");
  });

  it("c で終わる語は k を補う", () => {
    expect(regularPast("panic")).toBe("panicked");
  });

  it("語末に強勢がある2音節語は子音を重ねる", () => {
    // 強勢の位置は綴りから分からないため一覧で持っている
    expect(regularPast("prefer")).toBe("preferred");
    expect(regularPast("occur")).toBe("occurred");
    expect(regularPast("admit")).toBe("admitted");
    expect(regularPast("control")).toBe("controlled");
    expect(regularPast("permit")).toBe("permitted");
  });

  it("語頭に強勢がある2音節語は重ねない", () => {
    expect(regularPast("offer")).toBe("offered");
    expect(regularPast("visit")).toBe("visited");
    expect(regularPast("listen")).toBe("listened");
    // travel は米つづりに揃えている（英つづりでは travelled）
    expect(regularPast("travel")).toBe("traveled");
  });
});

describe("regularIng", () => {
  it("そのまま -ing を付ける", () => {
    expect(regularIng("play")).toBe("playing");
    expect(regularIng("open")).toBe("opening");
  });

  it("e で終わる語は e を落とす", () => {
    expect(regularIng("like")).toBe("liking");
    expect(regularIng("write")).toBe("writing");
  });

  it("ee で終わる語は e を残す", () => {
    expect(regularIng("see")).toBe("seeing");
    expect(regularIng("agree")).toBe("agreeing");
  });

  it("ie で終わる語は ying にする", () => {
    expect(regularIng("die")).toBe("dying");
    expect(regularIng("lie")).toBe("lying");
  });

  it("子音を重ねる語は ing でも重ねる", () => {
    expect(regularIng("stop")).toBe("stopping");
    expect(regularIng("run")).toBe("running");
    expect(regularIng("begin")).toBe("beginning");
    expect(regularIng("prefer")).toBe("preferring");
    expect(regularIng("forget")).toBe("forgetting");
  });

  it("c で終わる語は k を補う", () => {
    expect(regularIng("panic")).toBe("panicking");
  });
});

describe("classifyPattern", () => {
  it("3つとも同じなら AAA", () => {
    expect(classifyPattern("cut", "cut", "cut")).toBe("AAA");
  });
  it("原形と過去分詞が同じなら ABA", () => {
    expect(classifyPattern("come", "came", "come")).toBe("ABA");
  });
  it("過去形と過去分詞が同じなら ABB", () => {
    expect(classifyPattern("buy", "bought", "bought")).toBe("ABB");
  });
  it("3つとも違えば ABC", () => {
    expect(classifyPattern("go", "went", "gone")).toBe("ABC");
  });
});

describe("conjugate", () => {
  it("不規則動詞は表から引く", () => {
    expect(conjugate("go")).toMatchObject({ past: "went", participle: "gone", irregular: true, pattern: "ABC" });
    expect(conjugate("buy")).toMatchObject({ past: "bought", participle: "bought", pattern: "ABB" });
    expect(conjugate("cut")).toMatchObject({ past: "cut", participle: "cut", pattern: "AAA" });
    expect(conjugate("become")).toMatchObject({ past: "became", participle: "become", pattern: "ABA" });
  });

  it("規則動詞は過去形と過去分詞が同じ", () => {
    const f = conjugate("play");
    expect(f.past).toBe("played");
    expect(f.participle).toBe("played");
    expect(f.irregular).toBe(false);
    expect(f.pattern).toBe("規則変化");
  });

  it("不規則動詞の ing 形も正しく作る", () => {
    expect(conjugate("begin").ing).toBe("beginning");
    expect(conjugate("run").ing).toBe("running");
    expect(conjugate("write").ing).toBe("writing");
    expect(conjugate("put").ing).toBe("putting");
  });

  it("大文字や前後の空白があっても引ける", () => {
    expect(conjugate(" GO ").past).toBe("went");
  });
});

describe("不規則動詞の表", () => {
  it("十分な数がある", () => {
    expect(IRREGULAR_VERBS.length).toBeGreaterThan(140);
  });

  it("原形が重複していない", () => {
    const bases = IRREGULAR_VERBS.map(([b]) => b);
    expect(new Set(bases).size).toBe(bases.length);
  });

  it("すべて小文字の英字のみ", () => {
    const bad = IRREGULAR_VERBS.filter(fs => fs.some(f => !/^[a-z]+$/.test(f)));
    expect(bad).toEqual([]);
  });

  it("規則変化と同じ形の語を不規則として載せていない", () => {
    // -ed を付けるだけの語を表に入れておく意味は無い
    const useless = IRREGULAR_VERBS
      .filter(([b, p, pp]) => p === regularPast(b) && pp === regularPast(b))
      .map(([b]) => b);
    expect(useless).toEqual([]);
  });

  it("中学で習う基本的な不規則動詞を網羅している", () => {
    const must = ["go", "come", "see", "eat", "get", "give", "take", "make", "know", "think",
      "say", "tell", "find", "buy", "bring", "write", "read", "run", "sing", "swim",
      "begin", "break", "build", "catch", "choose", "cut", "do", "drink", "drive", "fall",
      "feel", "fly", "forget", "have", "hear", "keep", "leave", "lose", "meet", "put",
      "sleep", "speak", "stand", "teach", "wear", "win"];
    const bases = new Set(IRREGULAR_VERBS.map(([b]) => b));
    expect(must.filter(w => !bases.has(w))).toEqual([]);
  });
});

describe("buildVerbTable", () => {
  const table = buildVerbTable(initialVocabulary);

  it("収録されている動詞を並べる", () => {
    expect(table.length).toBeGreaterThan(1000);
  });

  it("動詞以外を含めない", () => {
    expect(table.filter(t => t.word.pos !== "verb")).toEqual([]);
  });

  it("句動詞は除く（活用するのが先頭の語だけで表に収まらないため）", () => {
    expect(table.filter(t => /\s/.test(t.base)).map(t => t.base)).toEqual([]);
  });

  it("同じ原形を重複して載せない", () => {
    const bases = table.map(t => t.base);
    expect(new Set(bases).size).toBe(bases.length);
  });

  it("原形のアルファベット順に並ぶ", () => {
    const bases = table.map(t => t.base);
    expect([...bases].sort((a, b) => a.localeCompare(b))).toEqual(bases);
  });

  it("すべての行に4つの形が入っている", () => {
    const bad = table.filter(t => !t.base || !t.past || !t.participle || !t.ing);
    expect(bad.map(t => t.base)).toEqual([]);
  });

  it("不規則動詞が相応の数だけ含まれる", () => {
    expect(table.filter(t => t.irregular).length).toBeGreaterThan(80);
  });

  it("基本形と重複していた活用形の見出しが消えている", () => {
    // divided / caused などは基本形に集約した
    const removed = ["divided", "caused", "encouraged", "imposed", "proposed",
      "implied", "participated", "anticipated", "embarked", "fastened",
      "imitated", "scattered", "regulated"];
    const present = initialVocabulary
      .filter(w => removed.includes(w.word.toLowerCase()))
      .map(w => w.word);
    expect(present).toEqual([]);
  });

  it("集約先の基本形は残っている", () => {
    const bases = ["divide", "cause", "encourage", "impose", "propose", "imply",
      "participate", "anticipate", "embark", "fasten", "imitate", "scatter", "regulate"];
    const words = new Set(initialVocabulary.map(w => w.word.toLowerCase()));
    expect(bases.filter(b => !words.has(b))).toEqual([]);
  });

  it("分詞形容詞は見出しに残している", () => {
    // tired / determined などは状態を表す独立した語として教える価値がある
    const keep = ["tired", "disappointed", "determined", "convinced", "puzzled", "isolated"];
    const words = new Set(initialVocabulary.map(w => w.word.toLowerCase()));
    expect(keep.filter(k => !words.has(k))).toEqual([]);
  });
});

describe("型の説明", () => {
  it("すべての型に説明がある", () => {
    for (const p of ["AAA", "ABA", "ABB", "ABC", "規則変化"] as const) {
      expect(PATTERN_NOTES[p]).toBeTruthy();
    }
  });
});

/**
 * 綴りの規則が「別の語」を作ってしまう場合。
 *
 * 語末の e を落として ing を付けるのが規則だが（like → liking）、
 * それで**別の語の ing 形**になってしまう語がある。
 * dye（染める）を dying にすると die（死ぬ）の、
 * singe（焦がす）を singing にすると sing（歌う）の ing 形で、
 * 学習者には誤った綴りとして示されることになる。
 *
 * 強勢の位置も綴りからは分からない。prohibit は pro-HIB-it と
 * 中間の音節に強勢があるので語末を重ねない（visit → visited と同じ）。
 */
describe("別の語と衝突する綴り", () => {
  it("e を落とすと別の語になる動詞は e を残す", () => {
    expect(regularIng("dye")).toBe("dyeing");
    expect(regularIng("singe")).toBe("singeing");
    expect(conjugate("dye").ing).toBe("dyeing");
    expect(conjugate("singe").ing).toBe("singeing");
  });

  it("もとの規則（e を落とす）は変わらない", () => {
    expect(regularIng("like")).toBe("liking");
    expect(regularIng("die")).toBe("dying");
    expect(regularIng("lie")).toBe("lying");
    expect(regularIng("sing")).toBe("singing");
    expect(regularIng("see")).toBe("seeing");
  });

  it("過去形は e を残す規則の影響を受けない", () => {
    expect(regularPast("dye")).toBe("dyed");
    expect(regularPast("singe")).toBe("singed");
  });

  it("強勢が語末に無い語は子音を重ねない", () => {
    expect(regularPast("prohibit")).toBe("prohibited");
    expect(regularIng("prohibit")).toBe("prohibiting");
    // 比較: 語末に強勢がある語はこれまでどおり重ねる
    expect(regularPast("prefer")).toBe("preferred");
    expect(regularPast("admit")).toBe("admitted");
    expect(regularPast("stop")).toBe("stopped");
    // 中間に強勢がある語（もともと正しかったもの）
    expect(regularPast("visit")).toBe("visited");
  });
});

/**
 * 収録の動詞すべてを突き合わせる。
 *
 * dye → dying（die の ing形）と singe → singing（sing の ing形）は、
 * 1語ずつ見ていては気づけなかった。綴りの規則が別の語を作ってしまう例は
 * 語を足したときにまた現れるので、1529語を総当たりで確かめる。
 */
describe("収録の動詞どうしで形が重ならない", () => {
  const verbs = [...new Set(
    initialVocabulary
      .filter(w => w.pos === "verb")
      .map(w => String(w.word).toLowerCase())
  )];

  it("ing形が別の動詞と一致しない", () => {
    const byForm = new Map<string, string[]>();
    for (const v of verbs) {
      const ing = conjugate(v).ing;
      byForm.set(ing, [...(byForm.get(ing) || []), v]);
    }
    const collisions = [...byForm.entries()]
      .filter(([, vs]) => vs.length > 1)
      .map(([form, vs]) => `${form} ← ${vs.join(" / ")}`);
    expect(collisions).toEqual([]);
  });

  it("過去形が別の動詞と一致しない", () => {
    const byForm = new Map<string, string[]>();
    for (const v of verbs) {
      const past = conjugate(v).past;
      byForm.set(past, [...(byForm.get(past) || []), v]);
    }
    const collisions = [...byForm.entries()]
      .filter(([, vs]) => vs.length > 1)
      .map(([form, vs]) => `${form} ← ${vs.join(" / ")}`);
    expect(collisions).toEqual([]);
  });
});
