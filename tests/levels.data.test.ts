import { describe, it, expect } from "vitest";
import { initialVocabulary } from "../src/data/vocabulary";
import { semcorRank } from "./data/semcorRank";
import { LEVEL_FIXES } from "../scripts/fix_levels";
import { Level } from "../src/types";

/**
 * レベル配分。
 *
 * 「初級」から順に解放していく作りなので、レベルの割り当てが崩れると
 * 中学で習う語が最後まで出てこない、という形で学習の順序が壊れる。
 * 実際 seem（実測22位）や rest（376位）が上級に置かれていた。
 *
 * 裏取りには WordNet の SemCor 頻度の順位を使う（tests/data/semcorRank.ts）。
 * ただし頻度は難易度そのものではない。SemCor は1960年代の英文を集めた
 * コーパスなので war / wage / federal のような語が上位に来るし、
 * 逆に the / you のような機能語や onion / carrot のような日常語は
 * 内容語しか数えない集計に出てこない。
 * だからここで見るのは「順位どおりに並んでいるか」ではなく、
 * 「並びが大きく崩れていないか」だけにとどめる。
 */

const V = initialVocabulary;
const LEVELS: Level[] = ["junior", "senior", "senior2", "senior3", "advanced"];

function ranksOf(level: Level): number[] {
  return V.filter(w => w.level === level)
    .map(w => semcorRank[w.id])
    .filter((r): r is number => typeof r === "number");
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

describe("レベルの割り当て", () => {
  it("すべての語が定義済みのレベルを持つ", () => {
    const bad = V.filter(w => !LEVELS.includes(w.level)).map(w => w.word);
    expect(bad).toEqual([]);
  });

  it("どのレベルにも十分な数の語がある", () => {
    for (const l of LEVELS) {
      expect(V.filter(w => w.level === l).length, l).toBeGreaterThan(500);
    }
  });

  it("初級に偏りすぎない（1レベルが全体の半分を超えない）", () => {
    for (const l of LEVELS) {
      expect(V.filter(w => w.level === l).length, l).toBeLessThan(V.length / 2);
    }
  });
});

describe("実測の頻度との整合", () => {
  it("レベルが上がるほど、実際の英文に出てくる頻度が下がる", () => {
    // 順位の中央値。数が大きいほど「出てきにくい語」
    const medians = LEVELS.map(l => median(ranksOf(l)));
    for (let i = 1; i < medians.length; i++) {
      expect(medians[i], `${LEVELS[i - 1]} → ${LEVELS[i]}`).toBeGreaterThan(medians[i - 1]);
    }
  });

  it("どのレベルにも実測のある語が十分にある（判定の土台）", () => {
    for (const l of LEVELS) expect(ranksOf(l).length, l).toBeGreaterThan(400);
  });

  it("上級に、きわめてよく使われる語を置かない", () => {
    // 実測750位以内の語が上級にあると、初級の学習者は最後まで出会えない
    const bad = V.filter(w => w.level === "advanced" && (semcorRank[w.id] ?? Infinity) <= 750)
      .map(w => `${w.word}(${semcorRank[w.id]}位)`);
    expect(bad).toEqual([]);
  });

  it("高3に、最上位の語を置かない", () => {
    const bad = V.filter(w => w.level === "senior3" && (semcorRank[w.id] ?? Infinity) <= 200)
      .map(w => `${w.word}(${semcorRank[w.id]}位)`);
    expect(bad).toEqual([]);
  });

  it("初級には、実測のある語が多く含まれる", () => {
    // 初級が珍しい語ばかりになっていないことの確認。
    // 実測が無い語（機能語・日常語）が多いのは異常ではないので、割合で見る
    const junior = V.filter(w => w.level === "junior");
    const withData = junior.filter(w => typeof semcorRank[w.id] === "number");
    expect(withData.length / junior.length).toBeGreaterThan(0.8);
  });
});

describe("見直した語", () => {
  it("見直しの一覧に載せた語がすべて収録されている", () => {
    const words = new Set(V.map(w => String(w.word).trim().toLowerCase()));
    const missing = Object.keys(LEVEL_FIXES).filter(w => !words.has(w));
    expect(missing).toEqual([]);
  });

  it("見直した語が指定どおりのレベルになっている", () => {
    const bad: string[] = [];
    for (const w of V) {
      const key = String(w.word).trim().toLowerCase();
      const target = LEVEL_FIXES[key];
      if (target && w.level !== target) bad.push(`${key}: ${w.level} ≠ ${target}`);
    }
    expect(bad).toEqual([]);
  });

  it("見直しで初級に語を足していない（初級の分量を変えない）", () => {
    expect(Object.values(LEVEL_FIXES)).not.toContain("junior");
  });
});
