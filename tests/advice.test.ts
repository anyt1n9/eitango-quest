import { describe, it, expect } from "vitest";
import {
  analyzeProgress, buildLocalAdvice, buildAnalysisForPrompt, reviewAdvice,
  AdviceInput, LevelStat, CLEARED_RATE, DIARY_THRESHOLD
} from "../server/advice";

/**
 * 学習アドバイスの組み立て。
 *
 * この機能は「AIパーソナル学習アドバイザリー」と名乗りながら、
 * APIキーが無いときは習得状況によらず同じ固定文を返していた。
 * 全レベル9割超の学習者と1語も習得していない初学者とで文面が1バイトも違わず、
 * 初級を1語も覚えていない人にも「中学生レベルは習得度高め」と出ていた
 * （実測は docs/advice-behavior.md）。
 *
 * ここで固定するのは「習得状況が変われば文面も変わる」ことと、
 * 書かれる数字が実際の記録と一致していること。
 */

const LABELS = ["中学生", "高校1年生", "高校2年生", "高校3年生", "大学生・社会人"];
const TOTALS = [1062, 1189, 1425, 1620, 2434];

/** 各レベルの習得率(%)を並べて入力を作る */
function input(rates: number[], wrongWordsCount = 0): AdviceInput {
  const levels: LevelStat[] = rates.map((rate, i) => ({
    label: LABELS[i],
    total: TOTALS[i],
    correct: Math.round((TOTALS[i] * rate) / 100),
    rate
  }));
  return { levels, wrongWordsCount };
}

const BEGINNER = input([0, 0, 0, 0, 0]);
const EARLY = input([10, 0, 0, 0, 0], 12);
const MIDDLE = input([94, 76, 70, 12, 0], 40);
const NEARLY_DONE = input([99, 97, 95, 93, 90]);

describe("習得状況の読み取り", () => {
  it("習得語数と全体の割合を数える", () => {
    const a = analyzeProgress(MIDDLE);
    expect(a.masteredTotal).toBe(
      MIDDLE.levels.reduce((n, l) => n + l.correct, 0)
    );
    expect(a.overallTotal).toBe(TOTALS.reduce((n, t) => n + t, 0));
    expect(a.overallRate).toBeGreaterThan(0);
    expect(a.overallRate).toBeLessThan(100);
  });

  it("学習順に見て、最初に未達のレベルを次の目標にする", () => {
    // 中学生94% / 高1 76% → 高1がまだ80%未満なので、そこが次
    expect(analyzeProgress(MIDDLE).focus?.label).toBe("高校1年生");
  });

  it("上のレベルが進んでいても、下が未達ならそちらを先に挙げる", () => {
    // 初級0%・上級80%。飛ばさずに初級から固めるべき
    const a = analyzeProgress(input([0, 0, 0, 0, 80]));
    expect(a.focus?.label).toBe("中学生");
  });

  it("全レベルを終えていれば次の目標を出さない", () => {
    expect(analyzeProgress(NEARLY_DONE).focus).toBeNull();
  });

  it("最も進んでいるレベルを見つける", () => {
    expect(analyzeProgress(MIDDLE).strongest?.label).toBe("中学生");
  });

  it("1語も習得していなければ、最も進んでいるレベルは無い", () => {
    expect(analyzeProgress(BEGINNER).strongest).toBeNull();
  });

  it("まだ手を付けていないレベルを挙げる", () => {
    expect(analyzeProgress(MIDDLE).untouched.map(l => l.label)).toEqual(["大学生・社会人"]);
    expect(analyzeProgress(NEARLY_DONE).untouched).toEqual([]);
  });

  it("学習の段階を判定する", () => {
    expect(analyzeProgress(BEGINNER).stage).toBe("未開始");
    expect(analyzeProgress(EARLY).stage).toBe("序盤");     // 106語習得済み（200語未満）
    expect(analyzeProgress(MIDDLE).stage).toBe("進行中");
    expect(analyzeProgress(NEARLY_DONE).stage).toBe("仕上げ");
  });

  it("習得語数が少ないうちは序盤とする", () => {
    const a = analyzeProgress(input([1, 0, 0, 0, 0]));
    expect(a.masteredTotal).toBeLessThan(DIARY_THRESHOLD);
    expect(a.stage).toBe("序盤");
  });

  it("日記モードの解放までの残り語数を出す", () => {
    expect(analyzeProgress(BEGINNER).diaryRemaining).toBe(DIARY_THRESHOLD);
    expect(analyzeProgress(NEARLY_DONE).diaryRemaining).toBe(0);
  });

  it("割合が100%を超えない入力なら、全体の割合も100%を超えない", () => {
    // 入り口（server.ts の toLevel）で correct <= total を保証しているので、
    // 分析側に不合理な割合が渡ることはない
    const a = analyzeProgress(input([100, 100, 100, 100, 100]));
    expect(a.overallRate).toBe(100);
  });

  it("レベルが空でも落ちない", () => {
    const a = analyzeProgress({ levels: [], wrongWordsCount: 0 });
    expect(a.masteredTotal).toBe(0);
    expect(a.overallRate).toBe(0);
    expect(a.focus).toBeNull();
  });
});

describe("苦手単語への助言", () => {
  it("0語なら、増やしていける時期だと伝える", () => {
    expect(reviewAdvice(0)).toContain("0語");
    expect(reviewAdvice(0)).toContain("増やしていける");
  });

  it("少なければ今日中に片づけるよう勧める", () => {
    expect(reviewAdvice(12)).toContain("12語");
    expect(reviewAdvice(12)).toContain("今日中");
  });

  it("中くらいなら新規と復習を半々にするよう勧める", () => {
    expect(reviewAdvice(40)).toContain("40語");
    expect(reviewAdvice(40)).toContain("半々");
  });

  it("多ければ新規を止めるよう勧める", () => {
    expect(reviewAdvice(300)).toContain("300語");
    expect(reviewAdvice(300)).toContain("新規を止めて");
  });

  it("量が違えば助言も違う", () => {
    const outs = [0, 12, 40, 300].map(reviewAdvice);
    expect(new Set(outs).size).toBe(4);
  });
});

describe("アプリが組み立てるアドバイス", () => {
  it("習得状況が違えば文面も違う", () => {
    // 以前はここが全部同じだった
    const texts = [BEGINNER, EARLY, MIDDLE, NEARLY_DONE].map(buildLocalAdvice);
    expect(new Set(texts).size).toBe(4);
  });

  it("初学者と、ほぼ習得済みの学習者で別の文面になる", () => {
    expect(buildLocalAdvice(BEGINNER)).not.toBe(buildLocalAdvice(NEARLY_DONE));
  });

  it("初学者に「習得度が高い」と言わない", () => {
    const text = buildLocalAdvice(BEGINNER);
    expect(text).toContain("まだ習得済みの単語がありません");
    expect(text).not.toContain("習得度高め");
  });

  it("次に取り組むレベルを名前で挙げる", () => {
    expect(buildLocalAdvice(MIDDLE)).toContain("高校1年生");
  });

  it("実際の習得数と割合を書く", () => {
    const a = analyzeProgress(MIDDLE);
    const text = buildLocalAdvice(MIDDLE);
    expect(text).toContain(`${a.masteredTotal}語`);
    expect(text).toContain(`${a.overallRate}%`);
  });

  it("苦手単語の数を実際の値で書く", () => {
    expect(buildLocalAdvice(input([50, 0, 0, 0, 0], 37))).toContain("37語");
  });

  it("仕上げ段階では次の学習先を示す", () => {
    const text = buildLocalAdvice(NEARLY_DONE);
    expect(text).toContain("仕上げ");
    expect(text).toContain("長文読解");
  });

  it("手を付けていないレベルがあれば、飛ばさないよう伝える", () => {
    expect(buildLocalAdvice(MIDDLE)).toContain("大学生・社会人レベルはまだ1語も習得していません");
  });

  it("レベル名の区切りが名前と紛れない", () => {
    // 「大学生・社会人」は名前自体に「・」を含むので、区切りに使うと境目が読めない
    const text = buildLocalAdvice(input([100, 0, 0, 0, 0], 0));
    expect(text).toContain("高校1年生、高校2年生、高校3年生、大学生・社会人レベルはまだ1語も習得していません");
  });

  it("すべて着手済みなら、その注意は出さない", () => {
    expect(buildLocalAdvice(NEARLY_DONE)).not.toContain("まだ1語も習得していません");
  });

  it("AIが書いたように見せない", () => {
    // 手元で作ったものを「AIの分析」と偽らないための断り書き
    expect(buildLocalAdvice(MIDDLE)).toContain("AIではなくアプリが学習記録から組み立てています");
  });

  it("Markdown の見出しと箇条書きで返す", () => {
    const text = buildLocalAdvice(MIDDLE);
    expect(text).toMatch(/^### /m);
    expect(text).toMatch(/^- /m);
  });
});

describe("AIに渡す分析", () => {
  it("段階・習得数・次のレベル・苦手数をすべて含む", () => {
    const text = buildAnalysisForPrompt(MIDDLE);
    expect(text).toContain("学習の段階");
    expect(text).toContain("習得済み");
    expect(text).toContain("いま取り組むべきレベル: 高校1年生");
    expect(text).toContain("苦手単語: 40語");
  });

  it("1語も習得していないことを明示する", () => {
    const text = buildAnalysisForPrompt(BEGINNER);
    expect(text).toContain("まだ1語も習得していない");
  });

  it("全レベル到達済みならその旨を書く", () => {
    expect(buildAnalysisForPrompt(NEARLY_DONE)).toContain(`全レベルが${CLEARED_RATE}%以上`);
  });

  it("習得状況が違えば渡す分析も違う", () => {
    const texts = [BEGINNER, EARLY, MIDDLE, NEARLY_DONE].map(buildAnalysisForPrompt);
    expect(new Set(texts).size).toBe(4);
  });
});
