import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
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

/**
 * 解析やAIの応答を待っているあいだに、別の取り込みで同じ語が単語帳に入ることがある。
 * 単語帳への追加は関数形で重複を弾くが、件数とボーナスを始めた時点の単語帳で数えていると、
 * 足されなかった語まで「N件登録しました」と出てスコアも入る。
 */
describe("待っているあいだに単語帳へ入った語", () => {
  const EVALUATE = { word: "evaluate", translation: "評価する", level: "senior" };
  const STATION = { word: "station", translation: "駅", level: "junior" };
  const PDF_FILE = new File(["%PDF-1.4"], "doc.pdf", { type: "application/pdf" });
  const scoreOf = (setStats: ReturnType<typeof vi.fn>) =>
    setStats.mock.calls.reduce((s, [update]) => update(s), { score: 0 } as any).score;

  async function openPdfTab() {
    const user = userEvent.setup();
    await user.click(document.getElementById("btn_toggle_import_panel")!);
    await user.click(screen.getByRole("button", { name: "PDFからAI抽出" }));
    return user;
  }

  it("画面が描き直されたあとなら、新しい単語帳で数える", async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    globalThis.fetch = vi.fn(() => new Promise(r => { resolveFetch = r; })) as unknown as typeof fetch;
    const setVocabulary = vi.fn();
    const setStats = vi.fn();
    const props = { setVocabulary, setStats, setRanking: vi.fn() };
    const { rerender } = render(<WordImport vocabulary={VOCAB} {...props} />);
    const user = await openPdfTab();
    await user.upload(document.getElementById("pdf_file_input") as HTMLInputElement, PDF_FILE);
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    // 解析中に、別の取り込みで Evaluate が入った
    const withEvaluate = [...VOCAB, makeWord({ id: "ai_e", word: "Evaluate", level: "senior" })];
    rerender(<WordImport vocabulary={withEvaluate} {...props} />);
    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ words: [EVALUATE, STATION] }) });
    });

    expect(await screen.findByText(/1件 の重要単語/)).toBeInTheDocument();
    expect(screen.getByText(/重複スキップ: 1件/)).toBeInTheDocument();
    const updater = setVocabulary.mock.calls[0][0] as (prev: Word[]) => Word[];
    expect(updater(withEvaluate).map(w => w.word)).toEqual(["beautiful", "Evaluate", "station"]);
    expect(scoreOf(setStats)).toBe(25);
  });

  it("描き直す前に2つの取り込みが続けて終わっても、同じ語を2度数えない", async () => {
    let resolveAi: (v: unknown) => void = () => {};
    let resolvePdf: (v: unknown) => void = () => {};
    globalThis.fetch = vi.fn((url: string) => new Promise(r => {
      if (String(url).includes("parse-pdf")) resolvePdf = r; else resolveAi = r;
    })) as unknown as typeof fetch;
    let latest: Word[] = VOCAB;
    const setStats = vi.fn();
    function Harness() {
      const [vocabulary, setVocabulary] = useState<Word[]>(VOCAB);
      latest = vocabulary;
      return <WordImport vocabulary={vocabulary} setVocabulary={setVocabulary} setStats={setStats} setRanking={vi.fn()} />;
    }
    render(<Harness />);
    const user = await openPdfTab();
    await user.type(document.getElementById("input_new_word")!, "evaluate");
    await user.keyboard("{Enter}");
    await user.upload(document.getElementById("pdf_file_input") as HTMLInputElement, PDF_FILE);
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));

    // 同じ act の中で両方を返す（あいだに再描画が入らない）
    await act(async () => {
      resolveAi({
        ok: true,
        json: async () => ({
          ...EVALUATE, pos: "verb",
          options: ["評価する", "拒否する", "記録する", "観察する"],
          sentence: "We must [_____] the plan.", sentenceTranslation: "その計画を評価しなければならない。",
          sentenceOptions: ["evaluate", "refuse", "record", "observe"]
        })
      });
      resolvePdf({ ok: true, json: async () => ({ words: [EVALUATE, STATION] }) });
    });

    expect(await screen.findByText(/1件 の重要単語/)).toBeInTheDocument();
    expect(latest.map(w => w.word)).toEqual(["beautiful", "evaluate", "station"]);
    // AI で1語（+50）、PDF で1語（+25）
    expect(scoreOf(setStats)).toBe(75);
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
