/**
 * ページ送りに並べるページ番号。いまのページを中心に最大 size 個で、端では寄せる。
 *
 * 以前は、端に寄せる計算が「全体が size ページ以上ある」ことを前提にしていた。
 * 3〜4ページしかないときに最後のページへ移ると、並ぶのが「1」だけ（4ページなら 1〜3）になり、
 * いま開いているページも、その手前のページも番号から選べなくなっていた。
 */
export function pageWindow(current: number, total: number, size = 5): number[] {
  const count = Math.min(size, Math.max(total, 0));
  const start = Math.min(Math.max(current - Math.floor(size / 2), 1), Math.max(total - count + 1, 1));
  return Array.from({ length: count }, (_, i) => start + i);
}
