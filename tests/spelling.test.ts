import { describe, it, expect } from "vitest";
import { isSpellingCorrect, diffChars } from "../src/spelling";

describe("isSpellingCorrect", () => {
  it("完全一致は正解", () => {
    expect(isSpellingCorrect("library", "library")).toBe(true);
  });

  it("大文字小文字の違いは許容する", () => {
    expect(isSpellingCorrect("Library", "library")).toBe(true);
    expect(isSpellingCorrect("LIBRARY", "library")).toBe(true);
    expect(isSpellingCorrect("english", "English")).toBe(true);
  });

  it("前後の空白は無視する", () => {
    expect(isSpellingCorrect("  library  ", "library")).toBe(true);
  });

  it("熟語の連続スペースは1つにまとめて比べる", () => {
    expect(isSpellingCorrect("as  soon   as", "as soon as")).toBe(true);
  });

  it("アポストロフィの種類の違いを許容する", () => {
    expect(isSpellingCorrect("don’t", "don't")).toBe(true);
    expect(isSpellingCorrect("don't", "don’t")).toBe(true);
  });

  it("綴り違いは不正解", () => {
    expect(isSpellingCorrect("libary", "library")).toBe(false);
    expect(isSpellingCorrect("librari", "library")).toBe(false);
    expect(isSpellingCorrect("", "library")).toBe(false);
    expect(isSpellingCorrect("librarys", "library")).toBe(false);
  });

  it("語中のスペースの有無は区別する（別語になるため）", () => {
    expect(isSpellingCorrect("assoonas", "as soon as")).toBe(false);
  });
});

describe("diffChars", () => {
  it("全部合っていれば全て ok", () => {
    expect(diffChars("cat", "cat").every(c => c.ok)).toBe(true);
  });

  it("間違えた位置だけ ok=false になる", () => {
    const d = diffChars("libary", "library");
    expect(d.map(c => c.ch).join("")).toBe("libary");
    expect(d.slice(0, 3).every(c => c.ok)).toBe(true); // l i b
    expect(d[3].ok).toBe(false);                        // a ≠ r
  });

  it("正解より長く入力しても落ちない（余った文字は不一致）", () => {
    const d = diffChars("catalog", "cat");
    expect(d).toHaveLength(7);
    expect(d.slice(3).every(c => c.ok)).toBe(false);
  });

  it("大文字小文字は一致とみなす", () => {
    expect(diffChars("Cat", "cat").every(c => c.ok)).toBe(true);
  });

  it("前後の空白は除いてから比べる", () => {
    expect(diffChars("  cat ", "cat").map(c => c.ch).join("")).toBe("cat");
  });

  it("空入力は空配列", () => {
    expect(diffChars("", "cat")).toEqual([]);
  });
});
