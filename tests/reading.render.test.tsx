import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Reading from "../src/components/Reading";
import { passages } from "../src/data/passages";
import { makeWord, makeStats } from "./fixtures";
import { Word } from "../src/types";

/**
 * 長文読解の画面。
 *
 * 足りていなかったのは3つ。
 *   - まとまった英文を耳で追う場所がここしか無いのに、音読が無かった
 *   - 読んで出会った語も、設問を間違えたことも、復習の輪に入らなかった
 *   - 文法の題名は並ぶが、解説へ跳べず自分で探しに行くしかなかった
 */

/** 本文に出てくる語を収録語として用意する（どの長文が来ても引けるように） */
const TARGET = passages[0].vocabularyHighlight[0];
const VOCAB: Word[] = [makeWord({ id: "v1", word: TARGET.word, translation: TARGET.translation })];

function setVoices(voices: { lang: string }[]) {
  (window.speechSynthesis as any).getVoices = () => voices;
}

function renderReading(props: Partial<Parameters<typeof Reading>[0]> = {}) {
  const setWrongWords = vi.fn();
  const onOpenGrammar = vi.fn();
  render(
    <Reading
      stats={makeStats()}
      setStats={vi.fn()}
      onBackToDashboard={vi.fn()}
      updateRankingScore={vi.fn()}
      vocabulary={VOCAB}
      wrongWords={[]}
      setWrongWords={setWrongWords}
      onOpenGrammar={onOpenGrammar}
      {...props}
    />
  );
  return { setWrongWords, onOpenGrammar };
}

/** 一覧から最初の長文を開く */
async function openFirstPassage(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText(passages[0].title));
}

beforeEach(() => {
  setVoices([{ lang: "en-US" }]);
  (window.speechSynthesis.speak as any).mockClear?.();
});

describe("音読", () => {
  it("本文を最初から読み上げられる", async () => {
    const user = userEvent.setup();
    renderReading();
    await openFirstPassage(user);

    await user.click(document.getElementById("btn_passage_read_all")!);
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
    const utterance = (window.speechSynthesis.speak as any).mock.calls[0][0];
    expect(utterance.text).toBe(passages[0].englishParagraphs[0]);
    expect(utterance.lang).toBe("en-US");
  });

  it("読み上げ中は止められる", async () => {
    const user = userEvent.setup();
    renderReading();
    await openFirstPassage(user);

    await user.click(document.getElementById("btn_passage_read_all")!);
    const stop = document.getElementById("btn_passage_stop_reading");
    expect(stop).toBeInTheDocument();
    expect(stop).toHaveTextContent("1段落目");

    await user.click(stop!);
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(document.getElementById("btn_passage_read_all")).toBeInTheDocument();
  });

  it("段落だけを聞き直せる", async () => {
    const user = userEvent.setup();
    renderReading();
    await openFirstPassage(user);

    await user.click(document.getElementById("btn_passage_read_1")!);
    const calls = (window.speechSynthesis.speak as any).mock.calls;
    expect(calls[calls.length - 1][0].text).toBe(passages[0].englishParagraphs[1]);
  });

  it("読み終えたら次の段落へ進む", async () => {
    const user = userEvent.setup();
    renderReading();
    await openFirstPassage(user);

    await user.click(document.getElementById("btn_passage_read_all")!);
    const first = (window.speechSynthesis.speak as any).mock.calls[0][0];
    first.onend();

    const calls = (window.speechSynthesis.speak as any).mock.calls;
    expect(calls[calls.length - 1][0].text).toBe(passages[0].englishParagraphs[1]);
  });

  it("段落だけを聞いたときは次へ進まない", async () => {
    const user = userEvent.setup();
    renderReading();
    await openFirstPassage(user);

    await user.click(document.getElementById("btn_passage_read_0")!);
    const before = (window.speechSynthesis.speak as any).mock.calls.length;
    (window.speechSynthesis.speak as any).mock.calls[before - 1][0].onend();
    expect((window.speechSynthesis.speak as any).mock.calls.length).toBe(before);
  });

  it("音声が使えない端末では音読を出さない", async () => {
    setVoices([{ lang: "ja-JP" }]);
    const user = userEvent.setup();
    renderReading();
    await openFirstPassage(user);
    expect(screen.queryByTestId("passage_audio")).toBeNull();
    expect(document.getElementById("btn_passage_read_0")).toBeNull();
  });
});

describe("復習への繋がり", () => {
  it("意味を確かめた語を苦手単語に入れられる", async () => {
    const user = userEvent.setup();
    const { setWrongWords } = renderReading();
    await openFirstPassage(user);

    // 右側の重要語リストから語を選ぶ
    await user.click(screen.getAllByText(TARGET.word)[0]);
    await user.click(document.getElementById("btn_reading_add_wrong")!);

    expect(setWrongWords).toHaveBeenCalled();
    const updater = setWrongWords.mock.calls[0][0] as (prev: string[]) => string[];
    expect(updater([])).toEqual(["v1"]);
  });

  it("既に苦手単語に入っていれば、そう伝えて二重に足さない", async () => {
    const user = userEvent.setup();
    renderReading({ wrongWords: ["v1"] });
    await openFirstPassage(user);

    await user.click(screen.getAllByText(TARGET.word)[0]);
    expect(screen.getByText("苦手単語に入っています")).toBeInTheDocument();
    expect(document.getElementById("btn_reading_add_wrong")).toBeNull();
  });

  it("収録されていない語は追加できないと伝える", async () => {
    const user = userEvent.setup();
    renderReading({ vocabulary: [] });
    await openFirstPassage(user);

    await user.click(screen.getAllByText(TARGET.word)[0]);
    expect(
      screen.getByText("この語は単語データに収録されていないため、復習には追加できません。")
    ).toBeInTheDocument();
  });

  it("設問を間違えた長文に印が残る", async () => {
    const user = userEvent.setup();
    renderReading();
    await openFirstPassage(user);

    const section = document.getElementById("passage_comprehension_section")!;
    const q = passages[0].questions![0];
    // 選択肢はシャッフルされるので、正解の文言以外を押す
    const wrongOption = q.options.find((_, i) => i !== q.correctIndex)!;
    await user.click(within(section).getByText(wrongOption));

    // 一覧へ戻ると印が付いている
    await user.click(document.getElementById("back_to_passages_list_btn")!);
    expect(screen.getByTestId(`passage_wrong_${passages[0].id}`)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("quest_reading_wrong") || "[]"))
      .toContain(passages[0].id);
  });

  it("正解した長文には印を付けない", async () => {
    const user = userEvent.setup();
    renderReading();
    await openFirstPassage(user);

    const section = document.getElementById("passage_comprehension_section")!;
    const q = passages[0].questions![0];
    await user.click(within(section).getByText(q.options[q.correctIndex]));

    await user.click(document.getElementById("back_to_passages_list_btn")!);
    expect(screen.queryByTestId(`passage_wrong_${passages[0].id}`)).toBeNull();
  });
});

describe("文法ガイドへの導線", () => {
  it("長文に付いた文法を押すと、その項目を開こうとする", async () => {
    const user = userEvent.setup();
    const { onOpenGrammar } = renderReading();
    await openFirstPassage(user);

    const focus = passages[0].grammarFocus![0];
    await user.click(document.getElementById(`btn_passage_grammar_${focus}`)!);
    expect(onOpenGrammar).toHaveBeenCalledWith(focus);
  });

  it("移動先が無いときは押せる見た目にしない", async () => {
    const user = userEvent.setup();
    renderReading({ onOpenGrammar: undefined });
    await openFirstPassage(user);

    const focus = passages[0].grammarFocus![0];
    expect(document.getElementById(`btn_passage_grammar_${focus}`)).toBeNull();
    expect(screen.getByTestId("passage_grammar")).toBeInTheDocument();
  });
});

/**
 * 「AIで長文を書き下ろす」の連打。
 *
 * isGenerating（＝ボタンの disabled）が効くのは再描画のあとなので、
 * ダブルクリックでは生成が2本走る。どちらも成功すると同じような長文が
 * 一覧に2本並び、AIの呼び出しも1回ぶん無駄になる
 * （長文の生成はいちばん重い呼び出しで、1時間あたりの上限を他の機能と分け合っている）。
 */
describe("AI長文の生成の連打", () => {
  const GENERATED = {
    id: "aip_x1",
    level: "senior",
    title: "The Lighthouse",
    englishParagraphs: ["The lighthouse stood alone.", "Nobody had visited it for years."],
    japaneseParagraphs: ["灯台はひとりで立っていた。", "何年も誰も訪れていなかった。"],
    vocabularyHighlight: [{ word: "lighthouse", translation: "灯台" }],
    description: "静かな灯台の話",
    pointReward: 150,
    questions: [{ question: "灯台はどうなっていましたか。", options: ["孤立していた", "壊れていた"], correctIndex: 0 }]
  };

  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...GENERATED }) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("2回続けて押しても、AIの呼び出しは1回だけ", async () => {
    renderReading();
    const btn = document.getElementById("btn_generate_passage")!;
    // 再描画を挟まずに2回押す（fireEvent を並べると2回目は disabled になり再現にならない）
    act(() => {
      btn.click();
      btn.click();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("一覧に増える長文も1本だけ", async () => {
    renderReading();
    const btn = document.getElementById("btn_generate_passage")!;
    act(() => {
      btn.click();
      btn.click();
    });
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("quest_custom_passages") || "[]");
      expect(saved.length).toBeGreaterThan(0);
    });
    const saved = JSON.parse(localStorage.getItem("quest_custom_passages") || "[]");
    expect(saved).toHaveLength(1);
  });
});
