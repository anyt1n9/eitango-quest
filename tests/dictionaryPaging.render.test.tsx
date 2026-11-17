import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
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

/**
 * 一覧が縮んだとき（#150）。苦手な単語で絞り込み、最後のページに1語だけ残っているときにその語を苦手から外すと、
 * ページを1へ戻す効果は検索・絞り込みの変化しか見ていなかったので「2 / 1」の空のページに取り残され、
 * ページ送りも出ないので戻れなかった。
 */
describe("一覧が縮んで、いまのページが無くなったとき", () => {
  function Harness({ words, initialWrong }: { words: ReturnType<typeof makeWord>[]; initialWrong: string[] }) {
    const [wrongWords, setWrongWords] = useState(initialWrong);
    return <Dictionary vocabulary={words} wrongWords={wrongWords} setWrongWords={setWrongWords} solvedHistory={{}} srsData={{}} />;
  }

  it("最後のページの最後の1語を苦手から外すと、残ったページを出す", async () => {
    const words = Array.from({ length: 51 }, (_, i) =>
      makeWord({ id: `w${i}`, word: `word${String(i).padStart(3, "0")}`, level: "junior" })
    );
    render(<Harness words={words} initialWrong={words.map(w => w.id)} />);
    const user = userEvent.setup();
    await user.click(document.getElementById("btn_toggle_dictionary_filters")!);
    await user.click(screen.getByRole("button", { name: /苦手な単語のみ/ }));
    await user.click(screen.getByRole("button", { name: ">>" }));
    expect(document.body.textContent).toContain("ページ：2 / 2");

    // 2ページ目に残った1語を苦手から外す
    const last = document.querySelector<HTMLButtonElement>('[id^="btn_toggle_weak_"]')!;
    await user.click(last);

    expect(document.body.textContent).toContain("ページ：1 / 1");
    expect(document.body.textContent).not.toContain("該当する単語は見つかりませんでした");
    expect(document.querySelectorAll('[id^="btn_toggle_weak_"]').length).toBe(50);
  });
});
