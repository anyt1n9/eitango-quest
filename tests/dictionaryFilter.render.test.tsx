import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dictionary from "../src/components/Dictionary";
import { makeWord } from "./fixtures";
import { Word } from "../src/types";

/**
 * 辞書の品詞での絞り込み。
 *
 * 7,730語をレベルと検索だけで探していたので、
 * 「動詞だけまとめて見たい」ができなかった。
 *
 * 品詞は語ごとに焼き込んであるが、外れている語もある。
 * 絞り込みを付けたことで am / is / are が名詞に並ぶのが見えるようになり、
 * scripts/fix_pos.ts で直した（この層ではなく tests/vocabulary.data.test.ts が守る）。
 */

const WORDS: Word[] = [
  makeWord({ id: "n1", word: "library", translation: "図書館", pos: "noun" }),
  makeWord({ id: "n2", word: "station", translation: "駅", pos: "noun" }),
  makeWord({ id: "v1", word: "run", translation: "走る", pos: "verb" }),
  makeWord({ id: "a1", word: "beautiful", translation: "美しい", pos: "adjective" }),
  makeWord({ id: "d1", word: "quickly", translation: "すばやく", pos: "adverb" }),
  makeWord({ id: "o1", word: "how many ~?", translation: "いくつの", pos: "other" })
];

function renderDictionary() {
  render(
    <Dictionary
      vocabulary={WORDS}
      wrongWords={[]}
      solvedHistory={{}}
      srsData={{}}
      onBackToDashboard={vi.fn()}
    />
  );
}

/** 一覧に出ている見出し語 */
function listedWords(): string[] {
  const list = document.getElementById("dictionary_words_container")!;
  return WORDS.map(w => w.word).filter(w =>
    within(list).queryAllByText(w, { exact: true }).length > 0
  );
}

describe("単語の詳細", () => {
  it("四択の選択肢は出さない", async () => {
    // 誤答は出題のための材料で、単語そのものの情報ではない。
    // 辞書で先に見えると、出題されたときの手がかりになってしまう
    const user = userEvent.setup();
    renderDictionary();
    await user.click(screen.getByText("beautiful"));

    expect(screen.queryByText(/四択選択肢/)).not.toBeInTheDocument();
    expect(screen.queryByText(/英語スペル選択肢/)).not.toBeInTheDocument();
    // 誤答そのものも出ていない（makeWord の options / sentenceOptions）
    for (const wrong of ["重い", "静かな", "危険な", "careful", "powerful", "peaceful"]) {
      expect(screen.queryByText(wrong), wrong).not.toBeInTheDocument();
    }
  });

  it("その単語自身の情報は出す", async () => {
    const user = userEvent.setup();
    renderDictionary();
    await user.click(screen.getByText("beautiful"));
    expect(screen.getAllByText("美しい").length).toBeGreaterThan(0);
  });
});

describe("品詞での絞り込み", () => {
  it("品詞ごとの件数を並べる", () => {
    renderDictionary();
    const filter = screen.getByTestId("pos_filter");
    for (const label of ["すべて", "名詞", "動詞", "形容詞", "副詞", "その他"]) {
      expect(within(filter).getByText(label), label).toBeInTheDocument();
    }
    // 名詞は2語、動詞は1語
    expect(document.getElementById("pos_filter_noun")).toHaveTextContent("2");
    expect(document.getElementById("pos_filter_verb")).toHaveTextContent("1");
  });

  it("既定ではすべて出す", () => {
    renderDictionary();
    expect(document.getElementById("pos_filter_all")).toHaveAttribute("aria-pressed", "true");
    expect(listedWords()).toHaveLength(WORDS.length);
  });

  it("名詞だけに絞れる", async () => {
    const user = userEvent.setup();
    renderDictionary();
    await user.click(document.getElementById("pos_filter_noun")!);
    expect(listedWords().sort()).toEqual(["library", "station"]);
  });

  it("動詞・形容詞・副詞にも絞れる", async () => {
    const user = userEvent.setup();
    renderDictionary();
    for (const [id, word] of [["verb", "run"], ["adjective", "beautiful"], ["adverb", "quickly"]]) {
      await user.click(document.getElementById(`pos_filter_${id}`)!);
      expect(listedWords(), id).toEqual([word]);
    }
  });

  it("どの品詞にも入らない語は「その他」で見つかる", async () => {
    // 前置詞・接続詞・イディオムの受け皿。出さないと辿り着けない語ができる
    const user = userEvent.setup();
    renderDictionary();
    await user.click(document.getElementById("pos_filter_other")!);
    expect(listedWords()).toEqual(["how many ~?"]);
  });

  it("すべてに戻せる", async () => {
    const user = userEvent.setup();
    renderDictionary();
    await user.click(document.getElementById("pos_filter_verb")!);
    await user.click(document.getElementById("pos_filter_all")!);
    expect(listedWords()).toHaveLength(WORDS.length);
  });

  it("検索と組み合わせて効く", async () => {
    const user = userEvent.setup();
    renderDictionary();
    await user.click(document.getElementById("pos_filter_noun")!);
    await user.type(screen.getByPlaceholderText(/検索/), "library");
    expect(listedWords()).toEqual(["library"]);
  });

  it("該当が無ければ空になる（別の品詞が漏れてこない）", async () => {
    const user = userEvent.setup();
    renderDictionary();
    await user.click(document.getElementById("pos_filter_adverb")!);
    await user.type(screen.getByPlaceholderText(/検索/), "library");
    expect(listedWords()).toEqual([]);
  });
});
