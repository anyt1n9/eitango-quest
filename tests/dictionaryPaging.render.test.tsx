import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dictionary from "../src/components/Dictionary";
import { makeWord } from "./fixtures";

/**
 * 辞書のページ送り。苦手な単語や追加した単語で絞ると 3〜4 ページになることがあり、
 * 最後のページへ移るとページ番号が「1」だけになっていた。
 */
describe("辞書のページ送り", () => {
  it("3ページのとき、最後のページでも 1〜3 を並べる", async () => {
    const words = Array.from({ length: 150 }, (_, i) =>
      makeWord({ id: `w${i}`, word: `word${String(i).padStart(3, "0")}`, level: "junior" })
    );
    render(
      <Dictionary vocabulary={words} wrongWords={[]} setWrongWords={vi.fn()} solvedHistory={{}} srsData={{}} />
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: ">>" }));

    expect(document.body.textContent).toContain("ページ：3 / 3");
    for (const n of ["1", "2", "3"]) {
      expect(screen.getByRole("button", { name: n }), `ページ ${n} の番号が無い`).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "2" }));
    expect(document.body.textContent).toContain("ページ：2 / 3");
  });
});
