import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
      { meaning: "腕時計", pos: "noun", share: 9, important: true },
      { meaning: "見る、見張る", pos: "verb", share: 91, usage: "watch a basketball game", important: true },
      { meaning: "懐中時計", pos: "noun", share: 9 },
      { meaning: "見張り番", pos: "noun", share: 9 }
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
    // beautiful は SemCor で名詞として一度も現れない（実測 0%）
    w_beautiful: [
      { meaning: "美しい,きれいな", pos: "adjective", share: 100, important: true },
      { meaning: "美しい人たち", pos: "noun", share: 0 }
    ],
    // 実測データがまったく無い語
    w_nodata: [
      { meaning: "羊皮紙", pos: "noun" },
      { meaning: "羊皮紙に書く", pos: "verb" }
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

  it("すべての語義を品詞ごとにまとめて並べる", async () => {
    render(<WordSenses wordId="w_watch" ownTranslation="腕時計" />);
    await findSense("腕時計");
    expect(screen.getByText("見る、見張る")).toBeInTheDocument();
    expect(screen.getByText("名詞")).toBeInTheDocument();
    expect(screen.getByText("動詞")).toBeInTheDocument();
    expect(screen.getByText(/この単語の他の意味（4件）/)).toBeInTheDocument();

    const noun = screen.getByTestId("sense_group_noun");
    expect(within(noun).getAllByRole("listitem")).toHaveLength(3);
    expect(within(noun).getByText("3件")).toBeInTheDocument();
  });

  it("割合は品詞のまとまりに1回だけ出す（意味ごとの頻度と誤解させない）", async () => {
    render(<WordSenses wordId="w_watch" ownTranslation="腕時計" />);
    await findSense("腕時計");
    // 名詞の語義は3つあるが、9% は見出しに1回だけ
    expect(screen.getAllByText("9%")).toHaveLength(1);
    expect(screen.getAllByText("91%")).toHaveLength(1);
    // 割合は語義の行の中には無い
    const items = within(screen.getByTestId("sense_group_noun")).getAllByRole("listitem");
    for (const li of items) expect(li.textContent).not.toMatch(/%/);
  });

  it("品詞の並びは元の順序を保つ（教材が教えている品詞が先頭）", async () => {
    render(<WordSenses wordId="w_watch" ownTranslation="腕時計" />);
    await findSense("腕時計");
    const order = Array.from(
      screen.getByTestId("sense_groups").children,
      el => el.getAttribute("data-testid")
    );
    expect(order).toEqual(["sense_group_noun", "sense_group_verb"]);
  });

  it("辞書が重要と示す語義に印を付ける", async () => {
    render(<WordSenses wordId="w_watch" ownTranslation="腕時計" />);
    await findSense("腕時計");
    // 4語義のうち重要印は2つ（凡例の「重要」を数えないよう一覧の中だけを見る）
    expect(within(screen.getByTestId("sense_groups")).getAllByText("重要")).toHaveLength(2);
    expect(screen.getByText(/英和辞書がとくに覚えるべきとしている意味/)).toBeInTheDocument();
  });

  it("実測で見つからなかった品詞は 0% と示す", async () => {
    render(<WordSenses wordId="w_beautiful" ownTranslation="美しい" />);
    await findSense("美しい人たち");
    expect(within(screen.getByTestId("sense_group_noun")).getByText("0%")).toBeInTheDocument();
    expect(screen.getByText(/実測で見つからなかった/)).toBeInTheDocument();
  });

  it("実測データが無い語は 0% ではなくその旨を示す", async () => {
    render(<WordSenses wordId="w_nodata" ownTranslation="羊皮紙" />);
    await findSense("羊皮紙に書く");
    expect(screen.getAllByText("割合の実測なし")).toHaveLength(2);
    expect(screen.queryByText("0%")).toBeNull();
    // 割合の説明も出さない（出す数字が無いため）
    expect(screen.queryByText(/SemCor/)).toBeNull();
  });

  it("教材が教えている語義に印を付ける", async () => {
    render(<WordSenses wordId="w_watch" ownTranslation="腕時計" />);
    await findSense("腕時計");
    expect(screen.getByText("← 学習中")).toBeInTheDocument();
  });

  it("品詞が違う語義には学習中の印を付けない", async () => {
    // beautiful の名詞「美しい人たち」は、訳語「美しい」を文字として含むが別の意味
    render(<WordSenses wordId="w_beautiful" ownTranslation="美しい" ownPos="adjective" />);
    await findSense("美しい人たち");
    const noun = screen.getByTestId("sense_group_noun");
    expect(within(noun).queryByText("← 学習中")).toBeNull();
    const adj = screen.getByTestId("sense_group_adjective");
    expect(within(adj).getByText("← 学習中")).toBeInTheDocument();
  });

  it("英英辞典の用例を添える", async () => {
    render(<WordSenses wordId="w_watch" ownTranslation="腕時計" />);
    expect(await findSense("watch a basketball game")).toBeInTheDocument();
  });

  it("割合が品詞単位であることを断る", async () => {
    render(<WordSenses wordId="w_watch" ownTranslation="腕時計" />);
    await findSense("腕時計");
    expect(screen.getByText(/品詞のまとまりごとの割合で、意味ごとの頻度ではありません/)).toBeInTheDocument();
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
