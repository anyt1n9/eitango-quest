import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import WordSenses, { DominantSenseHint } from "../src/components/WordSenses";

/**
 * 多義語の語義表示。
 *
 * 収録している 1.4MB の語義データをそのまま読むとテストが遅く、
 * どの語にどの語義が入っているかに結果が左右される。
 * 表示の決まりだけを見たいので、語義データは差し替える。
 */
vi.mock("../src/data/senses", () => ({
  wordSenses: {
    w_watch: [
      { meaning: "腕時計", pos: "noun", share: 9 },
      { meaning: "見る、見張る", pos: "verb", share: 91, usage: "watch a basketball game" }
    ],
    w_single: [{ meaning: "ただ1つの", pos: "adjective", share: 100 }],
    w_politely: [
      { meaning: "礼儀正しい", pos: "adjective", from: "polite" },
      { meaning: "上品な", pos: "adjective", from: "polite" }
    ],
    w_order: [
      { meaning: "順序", pos: "noun", share: 52 },
      { meaning: "命令する", pos: "verb", share: 48 }
    ],
    w_empty: []
  }
}));

/** 非同期に読み込まれる語義が出そろうまで待つ */
async function findSense(text: string | RegExp) {
  return screen.findByText(text);
}

describe("語義の一覧", () => {
  it("読み込み中はその旨を出す", () => {
    render(<WordSenses wordId="w_watch" ownTranslation="腕時計" />);
    expect(screen.getByText("意味を読み込んでいます…")).toBeInTheDocument();
  });

  it("すべての語義を品詞と割合つきで並べる", async () => {
    render(<WordSenses wordId="w_watch" ownTranslation="腕時計" />);
    await findSense("腕時計");
    expect(screen.getByText("見る、見張る")).toBeInTheDocument();
    expect(screen.getByText("名詞")).toBeInTheDocument();
    expect(screen.getByText("動詞")).toBeInTheDocument();
    expect(screen.getByText("9%")).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
    expect(screen.getByText(/この単語の他の意味（2件）/)).toBeInTheDocument();
  });

  it("教材が教えている語義に印を付ける", async () => {
    render(<WordSenses wordId="w_watch" ownTranslation="腕時計" />);
    await findSense("腕時計");
    expect(screen.getByText("← 学習中")).toBeInTheDocument();
  });

  it("英英辞典の用例を添える", async () => {
    render(<WordSenses wordId="w_watch" ownTranslation="腕時計" />);
    expect(await findSense("watch a basketball game")).toBeInTheDocument();
  });

  it("割合が品詞単位であることを断る（語義ごとの頻度と誤解させない）", async () => {
    render(<WordSenses wordId="w_watch" ownTranslation="腕時計" />);
    await findSense("腕時計");
    expect(screen.getByText(/意味ごとの頻度ではなく、品詞のまとまりごとの割合です/)).toBeInTheDocument();
  });

  it("基本形から借りた語義はその出どころを示す", async () => {
    render(<WordSenses wordId="w_politely" ownTranslation="礼儀正しく" />);
    await findSense("礼儀正しい");
    expect(screen.getByText("polite")).toBeInTheDocument();
    expect(screen.getByText(/基本形/)).toBeInTheDocument();
  });

  it("語義が1つだけの語には何も出さない（訳語と同じ情報になるため）", async () => {
    const { container } = render(<WordSenses wordId="w_single" ownTranslation="ただ1つの" />);
    await vi.waitFor(() => expect(screen.queryByText("意味を読み込んでいます…")).toBeNull());
    expect(container).toBeEmptyDOMElement();
  });

  it("語義が無い語にも何も出さない", async () => {
    const { container } = render(<WordSenses wordId="w_empty" ownTranslation="なし" />);
    await vi.waitFor(() => expect(screen.queryByText("意味を読み込んでいます…")).toBeNull());
    expect(container).toBeEmptyDOMElement();
  });

  it("語義データに無い語でも落ちない", async () => {
    const { container } = render(<WordSenses wordId="w_unknown" ownTranslation="未知" />);
    await vi.waitFor(() => expect(screen.queryByText("意味を読み込んでいます…")).toBeNull());
    expect(container).toBeEmptyDOMElement();
  });
});

describe("誤答したときの補足", () => {
  it("覚えている品詞よりよく使われる品詞があれば知らせる", async () => {
    render(<DominantSenseHint wordId="w_watch" ownPos="noun" />);
    expect(await findSense("見る、見張る")).toBeInTheDocument();
    expect(screen.getByText("よく使われるのはこちら")).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
  });

  it("覚えている品詞が最頻なら黙っている", async () => {
    const { container } = render(<DominantSenseHint wordId="w_watch" ownPos="verb" />);
    await new Promise(r => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it("差が小さいときは口を出さない（order は名詞52%・動詞48%でどちらも普通に使う）", async () => {
    // 覚えているのは動詞、最頻は名詞。品詞は違うが差が4ポイントしかない
    const { container } = render(<DominantSenseHint wordId="w_order" ownPos="verb" />);
    await new Promise(r => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });
});
