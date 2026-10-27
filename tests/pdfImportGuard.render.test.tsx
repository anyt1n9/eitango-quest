import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WordImport from "../src/components/WordImport";
import { makeWord } from "./fixtures";
import { Word } from "../src/types";

/**
 * PDF の取り込みを解析中にもう一度受け付けない（issue #107）。
 *
 * クリックでの選択は解析中は止めていたが、ドロップには歯止めが無く、
 * 解析中に同じ PDF をもう一度落とすと処理が2本並んで走った。
 * どちらも始めた時点の単語帳で重複を確かめるので、同じ語が別の ID で2件登録され、
 * ボーナスも二重に入った。
 */

const VOCAB = [makeWord({ id: "j1", word: "beautiful", level: "junior" })];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(window, "alert").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PDFの取り込み中", () => {
  it("2回続けて落としても、解析と登録は1回だけ", async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    const fetchMock = vi.fn(() => new Promise(r => { resolveFetch = r; }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const setVocabulary = vi.fn();
    const setStats = vi.fn();
    render(<WordImport vocabulary={VOCAB} setVocabulary={setVocabulary} setStats={setStats} setRanking={vi.fn()} />);

    const user = userEvent.setup();
    await user.click(document.getElementById("btn_toggle_import_panel")!);
    await user.click(screen.getByRole("button", { name: "PDFからAI抽出" }));

    const zone = document.getElementById("pdf_drop_zone")!;
    const file = new File(["%PDF-1.4"], "doc.pdf", { type: "application/pdf" });
    const drop = () => {
      const ev = new Event("drop", { bubbles: true }) as any;
      ev.dataTransfer = { files: [file] };
      zone.dispatchEvent(ev);
    };
    // 再描画を挟まずに2回落とす（挟むと見た目の「解析中」で止まり、再現にならない）
    act(() => { drop(); drop(); });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ words: [{ word: "evaluate", translation: "評価する", level: "senior" }] }) });
    });
    await vi.waitFor(() => expect(setVocabulary).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setVocabulary).toHaveBeenCalledTimes(1);
    const updater = setVocabulary.mock.calls[0][0] as (prev: Word[]) => Word[];
    expect(updater(VOCAB).map(w => w.word)).toEqual(["beautiful", "evaluate"]);
  });

  it("解析が終われば、次の PDF をまた受け付ける（印を消し忘れない）", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ words: [{ word: "evaluate", translation: "評価する" }] }) }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<WordImport vocabulary={VOCAB} setVocabulary={vi.fn()} setStats={vi.fn()} setRanking={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(document.getElementById("btn_toggle_import_panel")!);
    await user.click(screen.getByRole("button", { name: "PDFからAI抽出" }));
    const input = () => document.getElementById("pdf_file_input") as HTMLInputElement;
    await user.upload(input(), new File(["%PDF-1.4"], "a.pdf", { type: "application/pdf" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(input()).not.toBeDisabled());
    await user.upload(input(), new File(["%PDF-1.4"], "b.pdf", { type: "application/pdf" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

describe("サーバーが HTML で答えたとき（issue #108）", () => {
  it("「Unexpected token」ではなく、日本語の文を出す", async () => {
    globalThis.fetch = vi.fn(async () => new Response("<html>Bad Gateway</html>", {
      status: 502, headers: { "Content-Type": "text/html" }
    })) as unknown as typeof fetch;
    render(<WordImport vocabulary={VOCAB} setVocabulary={vi.fn()} setStats={vi.fn()} setRanking={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(document.getElementById("btn_toggle_import_panel")!);
    await user.type(document.getElementById("input_new_word")!, "evaluate");
    await user.keyboard("{Enter}");
    expect(await screen.findByText("サーバーとの通信に失敗しました（502）。時間をおいて再度お試しください。")).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected token/)).toBeNull();
  });
});
