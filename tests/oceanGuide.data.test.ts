import { describe, it, expect } from "vitest";
import { initialVocabulary as vocabulary } from "../src/data/vocabulary";
import { OCEAN_GUIDE, hasMet, metCount, newlyMet } from "../src/ocean/guide";
import { OCEAN_GUIDE_TEXT } from "../src/data/oceanGuide";
import { DEPTH_STAGES, abundance, stageIndexOf } from "../src/ocean/depth";

/**
 * 海の図鑑（src/ocean/guide.ts と src/data/oceanGuide.ts）。
 *
 * 説明は書き下ろしで、出典で正しさを担保できない。ここでは形の面を固定する
 * （図鑑で知った生き物が、その深さの海に本当にいるか・例文がその生き物の話か・
 * 一緒に覚える語が収録にあるか）。内容そのものは1種ずつ読んで確かめるほかない。
 */

const ids = OCEAN_GUIDE.map(c => c.id);

describe("海の図鑑の生き物", () => {
  it("ID は重ならず、URL に入れられる（「.」と「/」を含まない）", () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id, id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("浅い順に並んでいる", () => {
    const order = OCEAN_GUIDE.map(c => stageIndexOf(c.stage));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("出会う段の海に、その生き物が実際にいる（3Dの海の住む量が 0.5 以上）", () => {
    // 1匹で泳ぐ生き物は、住む量が半分を超える深さでだけ出す（oceanScene.ts）。
    // 図鑑で「ここで出会う」と書いた深さに潜っても見つからない、ということにしない
    for (const c of OCEAN_GUIDE) {
      const stage = DEPTH_STAGES[stageIndexOf(c.stage)];
      expect(abundance(c.dweller, stage.depth), `${c.id}（${stage.name}）`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("どの段に潜っても、新しく出会う生き物がいる", () => {
    for (const s of DEPTH_STAGES) {
      expect(OCEAN_GUIDE.some(c => c.stage === s.id), s.name).toBe(true);
    }
  });

  it("出会ったかどうかは潜った段で決まり、潜るほど増える", () => {
    expect(metCount(0)).toBe(OCEAN_GUIDE.filter(c => c.stage === "shallows").length);
    expect(metCount(DEPTH_STAGES.length - 1)).toBe(OCEAN_GUIDE.length);
    for (let r = 1; r < DEPTH_STAGES.length; r++) expect(metCount(r)).toBeGreaterThan(metCount(r - 1));
    const shark = OCEAN_GUIDE.find(c => c.id === "whale-shark")!;
    expect(hasMet(shark, stageIndexOf("slope"))).toBe(false);
    expect(hasMet(shark, stageIndexOf("offshore"))).toBe(true);
  });

  it("新しく出会う生き物は、前の段より深く、着いた段まで", () => {
    expect(newlyMet(2, 3).map(c => c.id)).toEqual(["whale-shark", "jellyfish"]);
    expect(newlyMet(0, 0)).toEqual([]);
    // 何段も一度に潜ったとき（はじめて数えたとき）は、その間の段の生き物も入る
    expect(newlyMet(0, 2)).toHaveLength(metCount(2) - metCount(0));
  });
});

describe("海の図鑑の説明", () => {
  it("どの生き物にも説明があり、余分な説明は無い", () => {
    expect(Object.keys(OCEAN_GUIDE_TEXT).sort()).toEqual([...ids].sort());
    for (const c of OCEAN_GUIDE) {
      const t = OCEAN_GUIDE_TEXT[c.id];
      expect(t.about.length, c.id).toBeGreaterThan(20);
      expect(t.memo.length, c.id).toBeGreaterThan(20);
      expect(t.example[1].length, c.id).toBeGreaterThan(5);
    }
  });

  it("例文は、その生き物の英語の名前を使っている（複数形でもよい）", () => {
    for (const c of OCEAN_GUIDE) {
      const sentence = OCEAN_GUIDE_TEXT[c.id].example[0].toLowerCase();
      const name = c.name.toLowerCase();
      const plural = name.replace(/y$/, "ies");
      expect(sentence.includes(name) || sentence.includes(plural), c.id).toBe(true);
    }
  });

  it("例文は1文か2文の英語で、日本語や穴埋めの記号が混ざらない", () => {
    for (const c of OCEAN_GUIDE) {
      const [en, ja] = OCEAN_GUIDE_TEXT[c.id].example;
      expect(en, c.id).toMatch(/^[A-Z][A-Za-z ,'-]+[.!?]( [A-Z][A-Za-z ,'-]+[.!?])?$/);
      expect(ja, c.id).toMatch(/[ぁ-ん]/);
      expect(ja, c.id).toMatch(/。$/);
    }
  });

  it("名前の英語のメモは、その名前（またはその一部）に触れている", () => {
    for (const c of OCEAN_GUIDE) {
      const memo = OCEAN_GUIDE_TEXT[c.id].memo.toLowerCase();
      const parts = c.name.toLowerCase().split(" ");
      expect(parts.some(p => memo.includes(p)), c.id).toBe(true);
    }
  });

  it("一緒に覚えたい単語は、どれも収録にあり、1種に3〜4語", () => {
    const byId = new Map(vocabulary.map(w => [w.id, w]));
    for (const c of OCEAN_GUIDE) {
      const words = OCEAN_GUIDE_TEXT[c.id].words;
      expect(words.length, c.id).toBeGreaterThanOrEqual(3);
      expect(words.length, c.id).toBeLessThanOrEqual(4);
      expect(new Set(words).size, c.id).toBe(words.length);
      for (const id of words) expect(byId.has(id), `${c.id} → ${id}`).toBe(true);
    }
  });

  it("一緒に覚えたい単語は、説明・メモ・例文のどこかに出てくる語（その生き物と関係のある語）", () => {
    const byId = new Map(vocabulary.map(w => [w.id, w]));
    for (const c of OCEAN_GUIDE) {
      const t = OCEAN_GUIDE_TEXT[c.id];
      const english = `${c.name} ${t.memo} ${t.example[0]}`.toLowerCase();
      const japanese = `${c.ja} ${t.about} ${t.memo} ${t.example[1]}`;
      for (const id of t.words) {
        const w = byId.get(id)!;
        // 英語に出てくるか（活用形・複数形も見る）、和訳の頭の語が説明に出てくるか
        const stem = w.word.toLowerCase().replace(/e$/, "");
        const inEnglish = new RegExp(`\\b${stem}`).test(english);
        const head = w.translation.split(/[、，,/／（(]/)[0].replace(/^を/, "").trim();
        expect(inEnglish || (head.length > 0 && japanese.includes(head.slice(0, 2))), `${c.id} → ${w.word}（${w.translation}）`).toBe(true);
      }
    }
  });
});
