import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WordImport from "../src/components/WordImport";
import { makeWord } from "./fixtures";
import { Word } from "../src/types";
import { OFFENSIVE_WORD_MESSAGE } from "../src/offensiveTerms";

/**
 * 利用者が足す単語（AI・CSV・PDF）で、露骨な表現・罵倒語・差別語を断る。
 *
 * 収録データからは外したが（tests/offensive.data.test.ts）、単語を増やす機能から
 * 同じ語をまた入れられると、クイズや辞書に出てしまう。
 * 決まりは収録データと同じ src/offensiveTerms.ts を使う。
 */

const VOCAB = [makeWord({ id: "j1", word: "beautiful", level: "junior" })];

function renderImport() {
  const setVocabulary = vi.fn();
  render(<WordImport vocabulary={VOCAB} setVocabulary={setVocabulary} setStats={vi.fn()} setRanking={vi.fn()} />);
  return { setVocabulary };
}

/** 保存された単語（setVocabulary に渡した更新関数を今の単語帳に当てた結果） */
function saved(setVocabulary: ReturnType<typeof vi.fn>): Word[] {
  const updater = setVocabulary.mock.calls[0][0];
  return typeof updater === "function" ? updater(VOCAB) : updater;
}

async function openPanel() {
  const user = userEvent.setup();
  await user.click(document.getElementById("btn_toggle_import_panel")!);
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AIで1語ずつ追加", () => {
  it("不適切な語は、AIに問い合わせる前に断る", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { setVocabulary } = renderImport();
    const user = await openPanel();
    await user.type(document.getElementById("input_new_word")!, "bitch");
    await user.keyboard("{Enter}");
    expect(await screen.findByText(OFFENSIVE_WORD_MESSAGE)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setVocabulary).not.toHaveBeenCalled();
  });

  it("収録データから外した語（idiot など）も断る", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    renderImport();
    const user = await openPanel();
    await user.type(document.getElementById("input_new_word")!, "idiot");
    await user.keyboard("{Enter}");
    expect(await screen.findByText(OFFENSIVE_WORD_MESSAGE)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("綴りは普通でも、AIが露骨な訳を付けて返したら登録しない", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        word: "lay", translation: "セックスする", level: "senior", pos: "verb",
        options: ["セックスする", "置く", "走る", "見る"],
        sentence: "Please [_____] the book on the desk.", sentenceTranslation: "机の上に本を置いてください。",
        sentenceOptions: ["lay", "run", "see", "eat"]
      })
    })) as unknown as typeof fetch;
    const { setVocabulary } = renderImport();
    const user = await openPanel();
    await user.type(document.getElementById("input_new_word")!, "lay");
    await user.keyboard("{Enter}");
    expect(await screen.findByText(OFFENSIVE_WORD_MESSAGE)).toBeInTheDocument();
    expect(setVocabulary).not.toHaveBeenCalled();
  });
});

describe("CSVの取り込み", () => {
  async function uploadCsv(csv: string) {
    const r = renderImport();
    const user = await openPanel();
    await user.upload(document.getElementById("csv_file_input") as HTMLInputElement, new File([csv], "words.csv", { type: "text/csv" }));
    return r;
  }

  it("不適切な行だけを除いて取り込み、除いた数を伝える", async () => {
    // 見出しは普通の語でも、例文が不適切なら除く
    const { setVocabulary } = await uploadCsv([
      "library,図書館,junior,I went to the library.,図書館に行った。",
      "bitch,いけ好かないやつ,senior",
      "station,駅,junior,The station was full of shit.,駅は汚かった。"
    ].join("\n"));
    await vi.waitFor(() => expect(setVocabulary).toHaveBeenCalled());
    expect(saved(setVocabulary).map(w => w.word)).toEqual(["beautiful", "library"]);
    expect(await screen.findByText(/不適切な表現を含むため 2件を除外しました/)).toBeInTheDocument();
  });

  it("すべて不適切なら何も登録せず、理由を出す", async () => {
    const { setVocabulary } = await uploadCsv("bitch,いけ好かないやつ,senior");
    expect(await screen.findByText(new RegExp(OFFENSIVE_WORD_MESSAGE))).toBeInTheDocument();
    expect(setVocabulary).not.toHaveBeenCalled();
  });
});

describe("PDFからの抽出", () => {
  it("抽出結果に不適切な語が混ざっていても登録しない", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        words: [
          { word: "evaluate", translation: "評価する", level: "senior" },
          { word: "porn", translation: "ポルノ", level: "senior" }
        ]
      })
    })) as unknown as typeof fetch;
    const { setVocabulary } = renderImport();
    const user = await openPanel();
    await user.click(screen.getByRole("button", { name: "PDFからAI抽出" }));
    await user.upload(
      document.getElementById("pdf_file_input") as HTMLInputElement,
      new File(["%PDF-1.4"], "doc.pdf", { type: "application/pdf" })
    );
    await vi.waitFor(() => expect(setVocabulary).toHaveBeenCalled());
    expect(saved(setVocabulary).map(w => w.word)).toEqual(["beautiful", "evaluate"]);
    expect(await screen.findByText(/不適切な表現を含むため 1件を除外しました/)).toBeInTheDocument();
  });
});
