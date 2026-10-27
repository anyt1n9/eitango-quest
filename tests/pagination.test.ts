import { describe, it, expect } from "vitest";
import { pageWindow } from "../src/pagination";

/**
 * 辞書のページ送りに並べる番号（src/pagination.ts）。
 * 以前は 3〜4 ページしかないときに最後のページへ移ると「1」だけ（4ページなら 1〜3）になり、
 * いま開いているページの番号が消えていた。
 */
describe("ページ番号の並び", () => {
  it("ページが少なければ全部並べる（どのページにいても）", () => {
    for (let current = 1; current <= 3; current++) expect(pageWindow(current, 3)).toEqual([1, 2, 3]);
    for (let current = 1; current <= 4; current++) expect(pageWindow(current, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it("多ければ、いまのページを中心に5つ。端では寄せる", () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(2, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(5, 10)).toEqual([3, 4, 5, 6, 7]);
    expect(pageWindow(9, 10)).toEqual([6, 7, 8, 9, 10]);
    expect(pageWindow(10, 10)).toEqual([6, 7, 8, 9, 10]);
  });

  it("いまのページは必ず含まれる", () => {
    for (let total = 1; total <= 12; total++) {
      for (let current = 1; current <= total; current++) {
        const pages = pageWindow(current, total);
        expect(pages, `${current}/${total}`).toContain(current);
        expect(pages.every(p => p >= 1 && p <= total)).toBe(true);
      }
    }
  });
});
