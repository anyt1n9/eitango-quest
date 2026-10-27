import { describe, it, expect } from "vitest";
import fs from "fs";
import { initialVocabulary } from "../src/data/vocabulary";
import { wordSenses } from "../src/data/senses";
import { wordUsage } from "../src/data/wordUsage";
import { grammarTopics } from "../src/data/grammar";
import { passages } from "../src/data/passages";

/**
 * アプリの説明・README・ページの説明文に書いた収録数が、収録データと合っているか。
 *
 * 数字は手で書いているので、データを直しても説明は古いまま残る。不適切な語を収録から
 * 外したあと、辞書には「7,726語」と出るのに、アプリの説明は「7,730語」のままだった
 * （語義・語法の語数と、レベル別の内訳も同じくずれていた）。
 */

const fmt = (n: number) => n.toLocaleString("en-US");
const read = (p: string) => fs.readFileSync(p, "utf8");

const ids = new Set(initialVocabulary.map(w => w.id));
const total = initialVocabulary.length;
const byLevel = (level: string) => initialVocabulary.filter(w => w.level === level).length;
const senses = Object.keys(wordSenses).filter(id => ids.has(id) && wordSenses[id].length > 0).length;
const usage = Object.keys(wordUsage).filter(id => ids.has(id)).length;

describe("アプリの説明（src/components/LegalPages.tsx）", () => {
  const legal = read("src/components/LegalPages.tsx");

  it("収録語数とレベル別の内訳", () => {
    expect(legal).toContain(`英単語 ${fmt(total)}語`);
    expect(legal).toContain(
      `中学${fmt(byLevel("junior"))} / 高1 ${fmt(byLevel("senior"))} / 高2 ${fmt(byLevel("senior2"))}` +
      ` / 高3 ${fmt(byLevel("senior3"))} / 大学・社会人 ${fmt(byLevel("advanced"))}`
    );
    expect(legal).toContain(`全${fmt(total)}語を検索`);
  });

  it("語義・語法・文法・長文の数", () => {
    expect(legal).toContain(`語義 ${fmt(senses)}語ぶん`);
    expect(legal).toContain(`語法 ${fmt(usage)}語ぶん`);
    expect(legal).toContain(`文法 ${grammarTopics.length}項目`);
    expect(legal).toContain(`${grammarTopics.length}項目の解説`);
    expect(legal).toContain(`長文 ${passages.length}本`);
  });
});

describe("ほかの説明", () => {
  it("README の収録語数・文法・長文の数", () => {
    const readme = read("README.md");
    expect(readme).toContain(`収録語は ${fmt(total)} 語`);
    expect(readme).toContain(`文法を${grammarTopics.length}項目`);
    expect(readme).toContain(`長文${passages.length}本`);
  });

  it("教材の画面の文法の項目数", () => {
    expect(read("src/components/LearnHub.tsx")).toContain(`中学〜大学の${grammarTopics.length}項目`);
  });

  it("ページの説明文（index.html）の「約○語」は、100語単位で丸めた収録語数", () => {
    const html = read("index.html");
    const approx = [...html.matchAll(/約([\d,]+)語/g)].map(m => m[1]);
    expect(approx.length).toBeGreaterThan(0);
    for (const n of approx) expect(n, "検索結果やSNSに出る説明文").toBe(fmt(Math.round(total / 100) * 100));
  });

  it("ページの説明文（index.html）のレベル別の語数", () => {
    // 以前は「約1,060 / 1,175 / 1,404 / 1,645 / 2,467」で、合計しても収録数と合わなかった
    const html = read("index.html");
    const levels: [string, string][] = [
      ["初級（中学）", "junior"], ["中級1（高校1年）", "senior"], ["中級2（高校2年）", "senior2"],
      ["中級3（高校3年）", "senior3"], ["上級", "advanced"]
    ];
    for (const [label, level] of levels) {
      expect(html, label).toContain(`<strong>${label}</strong>：${fmt(byLevel(level))}語`);
    }
  });
});
