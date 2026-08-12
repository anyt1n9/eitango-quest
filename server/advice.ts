/**
 * 学習アドバイスの組み立て。
 *
 * この機能は「AIパーソナル学習アドバイザリー」と名乗りながら、
 * APIキーが無いときは習得状況によらず同じ固定文を返していた。
 * 実測すると、全レベル9割超の学習者と1語も習得していない初学者とで
 * 文面が1バイトも違わず、初級を1語も覚えていない人にも
 * 「中学生レベルは習得度高め」と表示されていた（docs/advice-behavior.md）。
 *
 * ここでは受け取った数値から実際に状況を読み取り、
 *   - AIを呼べるときは、この分析をプロンプトに添えて根拠のある文章を書かせる
 *   - 呼べないときは、この分析からアプリ内で文章を組み立てる
 * のどちらでも、学習者の状態に合った内容が出るようにする。
 *
 * 弱点分析（buildFallbackWeaknessAnalysis）が実際の誤答から品詞分布を数えているのと
 * 同じ考え方で、こちらも手元の数字だけで言えることに限る。
 * 手元で分からないことは書かない。
 */

export interface LevelStat {
  /** 画面に出す名前（「中学生」など） */
  label: string;
  correct: number;
  total: number;
  rate: number;
}

export interface AdviceInput {
  /** 学習順に並べた5レベル */
  levels: LevelStat[];
  wrongWordsCount: number;
}

/** そのレベルを「ひととおり終えた」とみなす習得率 */
export const CLEARED_RATE = 80;
/** AI英語日記が解放される習得語数 */
export const DIARY_THRESHOLD = 200;

export type LearningStage = "未開始" | "序盤" | "進行中" | "仕上げ";

export interface AdviceAnalysis {
  masteredTotal: number;
  overallTotal: number;
  overallRate: number;
  stage: LearningStage;
  /** いま取り組むべきレベル。全レベルを終えていれば null */
  focus: LevelStat | null;
  /** 最も習得が進んでいるレベル。1語も習得していなければ null */
  strongest: LevelStat | null;
  /** まだ1語も習得していないレベル */
  untouched: LevelStat[];
  wrongWordsCount: number;
  /** 日記モード解放まであと何語か。解放済みなら 0 */
  diaryRemaining: number;
}

/**
 * 数値から学習状況を読み取る。
 * ここで判断できることだけを返し、文章の組み立てとは分けておく
 * （AIに渡すときも、アプリ内で書くときも同じ分析を使うため）。
 */
export function analyzeProgress(input: AdviceInput): AdviceAnalysis {
  const levels = input.levels;
  const masteredTotal = levels.reduce((n, l) => n + l.correct, 0);
  const overallTotal = levels.reduce((n, l) => n + l.total, 0);
  const overallRate = overallTotal > 0 ? Math.round((masteredTotal / overallTotal) * 100) : 0;

  // 学習順に見て、まだ終えていない最初のレベルが「いま取り組むところ」
  const focus = levels.find(l => l.rate < CLEARED_RATE) ?? null;
  const withProgress = levels.filter(l => l.correct > 0);
  const strongest = withProgress.length > 0
    ? withProgress.reduce((a, b) => (b.rate > a.rate ? b : a))
    : null;
  const untouched = levels.filter(l => l.correct === 0);

  const stage: LearningStage =
    masteredTotal === 0 ? "未開始"
      : focus === null ? "仕上げ"
        : masteredTotal < DIARY_THRESHOLD ? "序盤"
          : "進行中";

  return {
    masteredTotal,
    overallTotal,
    overallRate,
    stage,
    focus,
    strongest,
    untouched,
    wrongWordsCount: input.wrongWordsCount,
    diaryRemaining: Math.max(0, DIARY_THRESHOLD - masteredTotal)
  };
}

/** 苦手単語の量に応じて、次に取るべき行動を1行で返す */
export function reviewAdvice(count: number): string {
  if (count === 0) {
    return "苦手単語は0語です。この状態を保てているうちは、新しい単語をどんどん増やしていける時期です。";
  }
  if (count <= 20) {
    return `苦手単語は${count}語。1回の復習で片づく量なので、新しい単語に進む前に今日中に空にしてしまいましょう。`;
  }
  if (count <= 100) {
    return `苦手単語が${count}語たまっています。新規と復習を半々にして、まず半分に減らすことを当面の目標にしてください。`;
  }
  return `苦手単語が${count}語あります。ここまで増えると新規を足すほど取りこぼしが増えるので、しばらく新規を止めて復習だけに絞るのが近道です。`;
}

/** 学習の段階に応じた、現状の要約と次の一手 */
function stageAdvice(a: AdviceAnalysis): { summary: string; next: string } {
  switch (a.stage) {
    case "未開始":
      return {
        summary: `まだ習得済みの単語がありません。ここが出発点です。`,
        next: `${a.focus?.label ?? "初級"}レベルの4択クイズを1日10問から始めてください。同じ語に2回正解すると習得済みになります。`
      };
    case "序盤":
      return {
        summary: `習得済みは${a.masteredTotal}語（全体の${a.overallRate}%）。${a.strongest ? `${a.strongest.label}レベルが${a.strongest.rate}%で最も進んでいます。` : ""}`,
        next: `${a.focus!.label}レベル（現在${a.focus!.rate}%・${a.focus!.correct}/${a.focus!.total}語）を続けましょう。あと${a.diaryRemaining}語でAI英語日記が解放されます。`
      };
    case "進行中":
      return {
        summary: `習得済みは${a.masteredTotal}語（全体の${a.overallRate}%）。${a.strongest!.label}レベルは${a.strongest!.rate}%まで来ています。`,
        next: `次は${a.focus!.label}レベルです（現在${a.focus!.rate}%・${a.focus!.correct}/${a.focus!.total}語）。ここを${CLEARED_RATE}%まで上げると、上のレベルの長文がぐっと読みやすくなります。`
      };
    case "仕上げ":
      return {
        summary: `全レベルが${CLEARED_RATE}%を超えました（習得済み${a.masteredTotal}語・全体の${a.overallRate}%）。単語の暗記としては仕上げの段階です。`,
        next: `残りは取りこぼしの回収です。綴りや日→英の形式で復習すると、「選べるが書けない」語が見つかります。長文読解と文法ガイドに時間を移す頃合いです。`
      };
  }
}

/**
 * アプリ内でアドバイスを組み立てる（AIを呼べないとき）。
 *
 * AIが書いたかのように見せないため、末尾に出どころを書く。
 * 語義や長文でも「機械で作ったものをAIの分析と偽らない」方針をとっている。
 */
export function buildLocalAdvice(input: AdviceInput): string {
  const a = analyzeProgress(input);
  const { summary, next } = stageAdvice(a);

  const lines: string[] = [];
  lines.push("### 今の学習状況");
  lines.push("");
  lines.push(summary);
  lines.push("");
  lines.push("**次にやること**");
  lines.push("");
  lines.push(`- ${next}`);
  lines.push(`- ${reviewAdvice(a.wrongWordsCount)}`);

  // まだ手を付けていないレベルがあるなら、飛ばさないよう伝える
  if (a.untouched.length > 0 && a.stage !== "未開始") {
    // 「大学生・社会人」のようにレベル名自体が「・」を含むので、区切りは読点にする
    const names = a.untouched.map(l => l.label).join("、");
    lines.push(`- ${names}レベルはまだ1語も習得していません。今のレベルを${CLEARED_RATE}%まで固めてから進むほうが、結局は早く到達できます。`);
  }

  if (a.diaryRemaining === 0 && a.stage !== "未開始") {
    lines.push(`- 習得${DIARY_THRESHOLD}語を超えているので、AI英語日記で覚えた単語を実際に書いて使ってみてください。`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("_この文章は、AIではなくアプリが学習記録から組み立てています（Gemini APIキーが未設定のため）。_");

  return lines.join("\n");
}

/**
 * AIに渡す分析。数値の羅列だけを渡すと一般論しか返ってこないので、
 * 何が読み取れるかまでこちらで書いて渡す。
 */
export function buildAnalysisForPrompt(input: AdviceInput): string {
  const a = analyzeProgress(input);
  const lines = [
    `- 学習の段階: ${a.stage}`,
    `- 習得済み: ${a.masteredTotal}語 / 全${a.overallTotal}語（${a.overallRate}%）`,
    a.strongest
      ? `- 最も進んでいるレベル: ${a.strongest.label}（${a.strongest.rate}%・${a.strongest.correct}/${a.strongest.total}語）`
      : `- 最も進んでいるレベル: なし（まだ1語も習得していない）`,
    a.focus
      ? `- いま取り組むべきレベル: ${a.focus.label}（${a.focus.rate}%・${a.focus.correct}/${a.focus.total}語）`
      : `- いま取り組むべきレベル: なし（全レベルが${CLEARED_RATE}%以上）`,
    a.untouched.length > 0
      ? `- まだ1語も習得していないレベル: ${a.untouched.map(l => l.label).join("、")}`
      : `- まだ1語も習得していないレベル: なし`,
    `- 苦手単語: ${a.wrongWordsCount}語`,
    a.diaryRemaining > 0
      ? `- AI英語日記の解放まで: あと${a.diaryRemaining}語`
      : `- AI英語日記: 解放済み`
  ];
  return lines.join("\n");
}
