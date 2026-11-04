import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 画面の決まり（A案）。CLAUDE.md の「画面の決まり」を、ソースの上で機械的に確かめる。
 *
 * 以前は 12px 未満の文字が186か所、極太（800・900）が318か所、角の丸みが6種類あった。
 * 1か所ずつ見て直すと、新しい画面を足したときにまた混ざっても気づけない。
 */

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const FILES = sources(join(__dirname, "..", "src")).filter(f => !f.includes(`${join("src", "data")}`));

function offenders(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const f of FILES) {
    readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      if (pattern.test(line)) found.push(`${f.split("src")[1]}:${i + 1}`);
    });
  }
  return found;
}

describe("画面の決まり", () => {
  it("12px 未満の文字を使わない", () => {
    expect(offenders(/\btext-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/)).toEqual([]);
  });

  it("文字の太さは 400 / 500 / 700 の3段階だけ", () => {
    expect(offenders(/\bfont-(?:black|extrabold|semibold|thin|extralight|light)\b/)).toEqual([]);
  });

  it("角の丸みは 10px / 14px / 丸の3段階（rounded-3xl を使わない）", () => {
    expect(offenders(/\brounded-3xl\b/)).toEqual([]);
  });

  it("英語の札を大文字・字間の飾りで作らない（開発ツールのような印象になる）", () => {
    expect(offenders(/\b(?:uppercase|tracking-wider|tracking-widest)\b/).filter(l => !l.includes("SpellingQuiz"))).toEqual([]);
  });

  it("等幅フォントは、発音記号・綴りクイズ・CSVの見本・エラーの文面にだけ使う", () => {
    const allowed = ["Phonetic.tsx", "SpellingQuiz.tsx", "WordImport.tsx", "ErrorBoundary.tsx"];
    expect(offenders(/\bfont-mono\b/).filter(l => !allowed.some(a => l.includes(a)))).toEqual([]);
  });

  it("グラデーションと強い影を使わない（どこを読めばよいのかが色と影で分からなくなる）", () => {
    // 海の3D背景の地（index.css）はコンポーネントの外なので対象外
    expect(offenders(/\bbg-gradient-to-/)).toEqual([]);
    // カードとボタンに影を付けない。例外は、ほかの画面の上に重ねて出すもの
    // （長文の重要語の欄は狭い画面で本文の上に重ねる。確認の窓は shadow-2xl で浮かせる）と、
    // ガチャの当たりの光（レアの演出）
    expect(offenders(/\bshadow-(?:md|lg)\b/).filter(l => !l.includes("GachaShop.tsx"))).toEqual([]);
  });

  it("下の階層の画面の「戻る」は共通の部品（BackButton）を使う", () => {
    // 以前は画面ごとに書いていて、文字の大きさ・色・枠の有無が少なくとも7通りあった
    expect(offenders(/<ArrowLeft\b/)).toEqual([]);
  });

  it("出題中の上の帯は共通の部品を使う（「Q: 1 / 10」のような英語の札を書かない）", () => {
    expect(offenders(/Q: \{/)).toEqual([]);
    expect(offenders(/中断して戻る<\/span>/)).toEqual([]);
  });
});
