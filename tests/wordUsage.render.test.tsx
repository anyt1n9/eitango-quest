import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WordUsageInfo from "../src/components/WordUsage";

/**
 * 語法・コロケーション・語族の表示。
 *
 * 収録データ（700KB超）をそのまま読むとテストが遅く、
 * どの語に何が入っているかに結果が左右されるので差し替える。
 */
vi.mock("../src/data/wordUsage", () => ({
  wordUsage: {
    w_tell: {
      patterns: [2, 8, 14, 26],
      family: [{ word: "teller", meaning: "話し手", pos: "noun" }],
      collocations: [{ phrase: "tell apart", meaning: "見分ける" }]
    },
    // 目的語をとる形しか無い動詞
    w_borrow: { patterns: [8, 16] },
    // 目的語をとらない形しか無い動詞
    w_happen: { patterns: [1] },
    // 名詞。文型は持たない
    w_station: {
      collocations: [
        { phrase: "gas station", meaning: "ガソリンスタンド" },
        { phrase: "fire station", meaning: "消防署" }
      ]
    },
    w_decide: {
      family: [
        { word: "decision", meaning: "決定", pos: "noun" },
        { word: "decisive", meaning: "決定的な", pos: "adjective" }
      ]
    },
    // WordNet の版が変わって知らない番号が入った場合
    w_unknown_pattern: { patterns: [999] }
  }
}));

describe("文の形", () => {
  it("読み込み中はその旨を出す", () => {
    render(<WordUsageInfo wordId="w_tell" />);
    expect(screen.getByText("使い方を読み込んでいます…")).toBeInTheDocument();
  });

  it("日本語の説明と英語の型を並べて出す", async () => {
    render(<WordUsageInfo wordId="w_tell" />);
    expect(await screen.findByText("人＋もの の順に2つ目的語をとる（SVOO）")).toBeInTheDocument();
    expect(screen.getByText("Somebody ----s somebody something")).toBeInTheDocument();
    expect(screen.getByText("that節 が続く")).toBeInTheDocument();
    expect(screen.getByText("Somebody ----s that CLAUSE")).toBeInTheDocument();
  });

  it("自動詞か他動詞かを1行で言い切る", async () => {
    render(<WordUsageInfo wordId="w_borrow" />);
    expect(await screen.findByText("他動詞（目的語が要る）")).toBeInTheDocument();
  });

  it("目的語をとらない動詞は自動詞と示す", async () => {
    render(<WordUsageInfo wordId="w_happen" />);
    expect(await screen.findByText("自動詞（目的語をとらない）")).toBeInTheDocument();
  });

  it("すべての意味をまとめた一覧であることを断る", async () => {
    render(<WordUsageInfo wordId="w_tell" />);
    await screen.findByText("that節 が続く");
    expect(screen.getByText(/すべての意味をまとめた一覧/)).toBeInTheDocument();
  });

  it("知らない型の番号しか無ければ文の形を出さない", async () => {
    const { container } = render(<WordUsageInfo wordId="w_unknown_pattern" />);
    await vi.waitFor(() => expect(screen.queryByText("使い方を読み込んでいます…")).toBeNull());
    expect(container).toBeEmptyDOMElement();
  });

  it("文型が無い語には文の形の欄を出さない", async () => {
    render(<WordUsageInfo wordId="w_station" />);
    await screen.findByText("gas station");
    expect(screen.queryByTestId("usage_patterns")).toBeNull();
  });
});

describe("よく組んで使う語", () => {
  it("句と和訳を並べる", async () => {
    render(<WordUsageInfo wordId="w_station" />);
    const box = await screen.findByTestId("usage_collocations");
    expect(within(box).getByText("gas station")).toBeInTheDocument();
    expect(within(box).getByText("ガソリンスタンド")).toBeInTheDocument();
    expect(within(box).getByText("fire station")).toBeInTheDocument();
  });
});

describe("同じ語源の語", () => {
  it("語・品詞・和訳を並べる", async () => {
    render(<WordUsageInfo wordId="w_decide" />);
    const box = await screen.findByTestId("usage_family");
    expect(within(box).getByText("decision")).toBeInTheDocument();
    expect(within(box).getByText("名詞")).toBeInTheDocument();
    expect(within(box).getByText("決定")).toBeInTheDocument();
    expect(within(box).getByText("decisive")).toBeInTheDocument();
    expect(within(box).getByText("形容詞")).toBeInTheDocument();
  });

  it("語族が無い語には欄を出さない", async () => {
    render(<WordUsageInfo wordId="w_station" />);
    await screen.findByText("gas station");
    expect(screen.queryByTestId("usage_family")).toBeNull();
  });
});

describe("データが無いとき", () => {
  it("何も出さない", async () => {
    const { container } = render(<WordUsageInfo wordId="w_none" />);
    await vi.waitFor(() => expect(screen.queryByText("使い方を読み込んでいます…")).toBeNull());
    expect(container).toBeEmptyDOMElement();
  });
});

describe("文法の解説への導線", () => {
  /** 文型14(SVOO)・26 を扱う項目が収録データにあることを前提にする */
  it("その文型を扱う文法項目を出す", async () => {
    const onOpenGrammar = vi.fn();
    render(<WordUsageInfo wordId="w_tell" onOpenGrammar={onOpenGrammar} />);
    const links = await screen.findByTestId("usage_grammar_links");
    expect(within(links).getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("押すとその項目を開こうとする", async () => {
    const user = userEvent.setup();
    const onOpenGrammar = vi.fn();
    render(<WordUsageInfo wordId="w_tell" onOpenGrammar={onOpenGrammar} />);
    const links = await screen.findByTestId("usage_grammar_links");
    await user.click(within(links).getAllByRole("button")[0]);
    expect(onOpenGrammar).toHaveBeenCalledTimes(1);
    expect(String(onOpenGrammar.mock.calls[0][0])).toMatch(/^g_/);
  });

  it("移動先が無ければ出さない", async () => {
    // 辞書以外の場所から使うときは導線を出さない（行き先が無いため）
    render(<WordUsageInfo wordId="w_tell" />);
    expect(await screen.findByTestId("word_usage")).toBeInTheDocument();
    expect(screen.queryByTestId("usage_grammar_links")).toBeNull();
  });

  it("文型を持たない語には出さない", async () => {
    render(<WordUsageInfo wordId="w_station" onOpenGrammar={vi.fn()} />);
    expect(await screen.findByTestId("word_usage")).toBeInTheDocument();
    expect(screen.queryByTestId("usage_grammar_links")).toBeNull();
  });
});
