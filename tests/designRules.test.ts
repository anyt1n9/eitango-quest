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

  it("出題中の上の帯は共通の部品を使う（「Q: 1 / 10」のような英語の札を書かない）", () => {
    expect(offenders(/Q: \{/)).toEqual([]);
    expect(offenders(/中断して戻る<\/span>/)).toEqual([]);
  });
});
