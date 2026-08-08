import { describe, it, expect } from "vitest";
import { passages } from "../src/data/passages";

/**
 * 長文読解データの検査。
 * 英文と和訳の対応、設問の整合、ハイライト語が本文に実在するかを見る。
 */

const LEVELS = ["junior", "senior", "senior2", "senior3", "advanced"];
const wordCount = (p: typeof passages[number]) =>
  p.englishParagraphs.join(" ").split(/\s+/).filter(Boolean).length;

describe("長文の構成", () => {
  it("全レベルに3本ずつある", () => {
    for (const level of LEVELS) {
      expect(passages.filter(p => p.level === level)).toHaveLength(3);
    }
  });

  it("id が重複していない", () => {
    expect(new Set(passages.map(p => p.id)).size).toBe(passages.length);
  });

  it("level が定義済みの値", () => {
    expect(passages.filter(p => !LEVELS.includes(p.level)).map(p => p.id)).toEqual([]);
  });

  it("タイトルと説明が空でない", () => {
    expect(passages.filter(p => !p.title.trim() || !p.description.trim()).map(p => p.id)).toEqual([]);
  });

  it("獲得ポイントが正の数", () => {
    expect(passages.filter(p => !(p.pointReward > 0)).map(p => p.id)).toEqual([]);
  });
});

describe("本文", () => {
  it("英文と和訳の段落数が一致する", () => {
    expect(passages
      .filter(p => p.englishParagraphs.length !== p.japaneseParagraphs.length)
      .map(p => `${p.id}: en=${p.englishParagraphs.length} ja=${p.japaneseParagraphs.length}`)
    ).toEqual([]);
  });

  it("読み物として十分な分量がある", () => {
    // 以前は63〜112語しかなく、単語を詰め込んだだけの断片だった
    expect(passages.filter(p => wordCount(p) < 200).map(p => `${p.id}:${wordCount(p)}`)).toEqual([]);
  });

  it("段落が空でない", () => {
    expect(passages
      .filter(p => p.englishParagraphs.some(s => !s.trim()) || p.japaneseParagraphs.some(s => !s.trim()))
      .map(p => p.id)
    ).toEqual([]);
  });

  it("英文に非ASCII文字が混ざっていない", () => {
    // 編集中に紛れ込んだキリル文字や全角ダッシュを検出する
    const bad = passages.flatMap(p =>
      p.englishParagraphs.flatMap(s => (s.match(/[^\x20-\x7e]/g) || []).map(c => `${p.id}:${c}`))
    );
    expect([...new Set(bad)]).toEqual([]);
  });

  it("和訳が日本語で書かれている", () => {
    expect(passages
      .filter(p => p.japaneseParagraphs.some(s => !/[ぁ-んァ-ヶ一-鿿]/.test(s)))
      .map(p => p.id)
    ).toEqual([]);
  });
});

describe("ハイライト語", () => {
  it("各長文にハイライト語がある", () => {
    expect(passages.filter(p => p.vocabularyHighlight.length === 0).map(p => p.id)).toEqual([]);
  });

  it("ハイライト語が本文に実在する", () => {
    // 語形変化（studies / studied）を許すため語幹で照合する
    const missing: string[] = [];
    for (const p of passages) {
      const text = p.englishParagraphs.join(" ").toLowerCase();
      for (const h of p.vocabularyHighlight) {
        const w = h.word.toLowerCase();
        const stem = w.slice(0, Math.max(3, w.length - 2));
        if (!text.includes(stem)) missing.push(`${p.id}:${h.word}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("ハイライト語に訳が付いている", () => {
    expect(passages
      .flatMap(p => p.vocabularyHighlight.filter(h => !h.translation.trim()).map(h => `${p.id}:${h.word}`))
    ).toEqual([]);
  });

  it("同じ長文内でハイライト語が重複していない", () => {
    expect(passages
      .filter(p => new Set(p.vocabularyHighlight.map(h => h.word.toLowerCase())).size
        !== p.vocabularyHighlight.length)
      .map(p => p.id)
    ).toEqual([]);
  });
});

describe("理解度チェックの設問", () => {
  it("全ての長文に設問がある", () => {
    expect(passages.filter(p => !p.questions || p.questions.length === 0).map(p => p.id)).toEqual([]);
  });

  it("選択肢がちょうど4つある", () => {
    expect(passages
      .flatMap(p => (p.questions || []).filter(q => q.options.length !== 4).map(q => `${p.id}:${q.question}`))
    ).toEqual([]);
  });

  it("正解のインデックスが選択肢の範囲に収まる", () => {
    expect(passages
      .flatMap(p => (p.questions || [])
        .filter(q => !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length)
        .map(q => `${p.id}:${q.question}`))
    ).toEqual([]);
  });

  it("選択肢が重複していない・空でない", () => {
    expect(passages
      .flatMap(p => (p.questions || [])
        .filter(q => new Set(q.options).size !== q.options.length || q.options.some(o => !o.trim()))
        .map(q => `${p.id}:${q.question}`))
    ).toEqual([]);
  });

  it("設問文が日本語で書かれている", () => {
    expect(passages
      .flatMap(p => (p.questions || [])
        .filter(q => !/[ぁ-んァ-ヶ一-鿿]/.test(q.question))
        .map(q => `${p.id}:${q.question}`))
    ).toEqual([]);
  });

  it("データ上は正解が先頭に固定されている（表示時のシャッフルが必須である裏付け）", () => {
    // 70問すべてが correctIndex 0 で書かれている。
    // つまり shuffleQuestion を外すと「常に1番目」で全問正解できてしまう。
    // この事実を明示しておき、readingQuiz.test.ts でシャッフルを検証する。
    const counts = [0, 0, 0, 0];
    for (const p of passages) for (const q of p.questions || []) counts[q.correctIndex]++;
    expect(counts.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(counts[0]).toBe(counts.reduce((a, b) => a + b, 0));
  });
});
