import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MapAndPuzzle from "../src/components/MapAndPuzzle";
import { makeStats } from "./fixtures";

/**
 * AIつながりマップ・派生語パズル。
 *
 * この画面だけは表示するデータをその場でAIから受け取る。
 * AIの応答は必ずしも決めた形とは限らないので、
 * 形を確かめずに描くと data.puzzle.filter で例外が投げられ、
 * アプリ全体が真っ白になる（エラーバウンダリを入れた直接のきっかけ）。
 *
 * ここで固定するのは「壊れた応答が来たときに画面が壊れないこと」と、
 * 「答えの並び順から正解が読めないこと」。
 */

// サーバーが返す形に合わせる（server.ts の connection-map のスキーマ）
const OK_RESPONSE = {
  focusWord: "construct",
  connections: [
    { word: "construct", type: "動詞", meaning: "建設する", connectionReason: "基本形" },
    { word: "structure", type: "名詞", meaning: "構造", connectionReason: "同じ語根" }
  ],
  puzzle: [
    { word: "construct", partOfSpeech: "動詞", meaning: "建設する", masked: false },
    { word: "construction", partOfSpeech: "名詞", meaning: "建設", masked: true },
    { word: "constructive", partOfSpeech: "形容詞", meaning: "建設的な", masked: true }
  ],
  distractors: ["destruction", "instructive"],
  explanation: "con（共に）+ struct（積む）"
};

function mockFetch(body: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    json: async () => body
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function renderMap() {
  const onBackToDashboard = vi.fn();
  const updateRankingScore = vi.fn();
  const setStats = vi.fn();
  render(
    <MapAndPuzzle
      onBackToDashboard={onBackToDashboard}
      updateRankingScore={updateRankingScore}
      setStats={setStats}
      stats={makeStats()}
    />
  );
  return { onBackToDashboard, updateRankingScore, setStats };
}

/** 単語を調べる */
async function search(word = "construct") {
  const user = userEvent.setup();
  await user.type(document.getElementById("input_map_search_word")!, word);
  await user.click(document.getElementById("btn_map_search_submit")!);
}

/** 答えの候補カードに書かれている語 */
function choiceLabels(): string[] {
  const drawer = document.getElementById("choices_drawer_container")!;
  return within(drawer).getAllByRole("button").map(b => (b.textContent || "").trim());
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("最初の画面", () => {
  it("調べる前は入口だけを出す", () => {
    mockFetch(OK_RESPONSE);
    renderMap();
    expect(document.getElementById("map_intro_splash")).toBeInTheDocument();
    expect(document.getElementById("map_puzzle_results_container")).toBeNull();
  });

  it("空欄では調べに行かない", async () => {
    const fetchMock = mockFetch(OK_RESPONSE);
    renderMap();
    const user = userEvent.setup();
    await user.click(document.getElementById("btn_map_search_submit")!);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AIの応答", () => {
  it("正しい形なら、つながりとパズルを出す", async () => {
    mockFetch(OK_RESPONSE);
    renderMap();
    await search();

    expect(await screen.findByText("structure")).toBeInTheDocument();
    expect(document.getElementById("puzzle_game_board")).toBeInTheDocument();
  });

  it("配列でない応答が来ても、画面を壊さず理由を出す", async () => {
    // puzzle が配列でないと data.puzzle.filter で例外になる
    mockFetch({ connections: [], puzzle: null, distractors: [] });
    renderMap();
    await search();

    expect(await screen.findByText(/AIの応答を解釈できませんでした/)).toBeInTheDocument();
    expect(document.getElementById("puzzle_game_board")).toBeNull();
  });

  it("項目がまるごと欠けていても落ちない", async () => {
    mockFetch({});
    renderMap();
    await search();
    expect(await screen.findByText(/AIの応答を解釈できませんでした/)).toBeInTheDocument();
  });

  it("サーバーが断ったら、その理由をそのまま伝える", async () => {
    // APIキーが無いときは 503 と理由が返る。機械で代用して「AIの分析」を騙らない
    mockFetch({ error: "AI機能は現在利用できません（APIキー未設定）" }, false);
    renderMap();
    await search();
    expect(await screen.findByText(/APIキー未設定/)).toBeInTheDocument();
  });

  it("通信そのものが失敗しても伝える", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ネットワークに接続できません"));
    renderMap();
    await search();
    expect(await screen.findByText(/ネットワークに接続できません/)).toBeInTheDocument();
  });
});

describe("壊れた応答から画面を守る", () => {
  it("パズルの要素に word が無ければ断る", async () => {
    // 配列であることだけ見ていたので、要素が欠けていると
    // 答え合わせの data.puzzle[idx].word.trim() で落ちていた
    mockFetch({
      ...OK_RESPONSE,
      puzzle: [
        { word: "construct", partOfSpeech: "動詞", meaning: "建設する", masked: false },
        { partOfSpeech: "名詞", meaning: "建設", masked: true }
      ]
    });
    renderMap();
    await search();
    expect(await screen.findByText(/AIの応答を解釈できませんでした/)).toBeInTheDocument();
    expect(document.getElementById("puzzle_game_board")).toBeNull();
  });

  it("つながりの要素に meaning が無ければ断る", async () => {
    mockFetch({ ...OK_RESPONSE, connections: [{ word: "structure" }] });
    renderMap();
    await search();
    expect(await screen.findByText(/AIの応答を解釈できませんでした/)).toBeInTheDocument();
  });

  it("ひっかけ語に文字列でないものが混ざれば断る", async () => {
    mockFetch({ ...OK_RESPONSE, distractors: ["destruction", null] });
    renderMap();
    await search();
    expect(await screen.findByText(/AIの応答を解釈できませんでした/)).toBeInTheDocument();
  });
});

describe("続けて調べたとき", () => {
  it("取得中はおすすめの語を押せない", async () => {
    // 押せると2つ目の取得が並行して走り、応答の順番次第で
    // 検索欄の語と画面の中身が食い違う
    let resolve: (v: unknown) => void = () => {};
    globalThis.fetch = vi.fn().mockImplementation(
      () => new Promise(r => { resolve = r; })
    ) as unknown as typeof fetch;
    renderMap();
    await search();

    const preset = screen.getByRole("button", { name: "act" });
    expect(preset).toBeDisabled();

    resolve({ ok: true, json: async () => OK_RESPONSE });
  });

  it("取得中は2つ目の取得を投げない", async () => {
    // 2つ並行して走ると、先に投げたほうが後から返ったときに上書きされ、
    // 検索欄の語と画面の中身が食い違う。
    // （念のため、応答側でも取得の番号を見て古いものは捨てている）
    let resolve: (v: unknown) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(
      () => new Promise(r => { resolve = r; })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    renderMap();
    await search("construct");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 取得中に別の語を入れて押しても、2つ目は飛ばない
    await user.clear(document.getElementById("input_map_search_word")!);
    await user.type(document.getElementById("input_map_search_word")!, "press");
    await user.click(document.getElementById("btn_map_search_submit")!);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolve({ ok: true, json: async () => OK_RESPONSE });
  });
});

describe("初回正解ボーナス", () => {
  /**
   * 「同じパズルの再回答では加算しない」という作りだったが、
   * 判定を画面の中の state だけで持っていた。同じ語で「AI探査」を
   * やり直すと新しいパズルが作られて state が戻るため、
   * 同じ語で何度でも +100 を取れた。語ごとに端末に残して1回にする。
   */
  /** 候補を押すと空いている空欄に順に入る。正しい順で2つ入れて答え合わせする */
  async function solveCorrectly() {
    const user = userEvent.setup();
    await screen.findByText("structure");
    for (const word of ["construction", "constructive"]) {
      await user.click(screen.getByRole("button", { name: word }));
    }
    await user.click(document.getElementById("btn_submit_puzzle_answers")!);
  }

  it("同じ語を調べ直しても、ボーナスは1回だけ", async () => {
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockFetch(OK_RESPONSE);
    const { updateRankingScore, setStats } = renderMap();

    await search("construct");
    await solveCorrectly();
    expect(updateRankingScore).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("quest_puzzle_rewarded_words")).toContain("construct");

    // 同じ語をもう一度調べて、もう一度解く
    const user = userEvent.setup();
    await user.clear(document.getElementById("input_map_search_word")!);
    await user.type(document.getElementById("input_map_search_word")!, "construct");
    await user.click(document.getElementById("btn_map_search_submit")!);
    await solveCorrectly();

    expect(updateRankingScore, "同じ語で2回もらえてしまう").toHaveBeenCalledTimes(1);
    expect(setStats).toHaveBeenCalledTimes(1);
  });

  it("覚えているのは語ごと（別の語なら受け取れる）", async () => {
    vi.spyOn(window, "alert").mockImplementation(() => {});
    localStorage.setItem("quest_puzzle_rewarded_words", JSON.stringify(["press"]));
    mockFetch(OK_RESPONSE);
    const { updateRankingScore } = renderMap();

    await search("construct");
    await solveCorrectly();
    expect(updateRankingScore).toHaveBeenCalledTimes(1);
  });
});

describe("派生語パズル", () => {
  it("隠した語とひっかけ語を候補に並べる", async () => {
    mockFetch(OK_RESPONSE);
    renderMap();
    await search();
    await screen.findByText("structure");

    const labels = choiceLabels();
    // 隠されている2語＋ひっかけ2語
    expect(labels.sort()).toEqual(
      ["constructive", "construction", "destruction", "instructive"].sort()
    );
  });

  it("候補の並びは触っても変わらない", async () => {
    // 並べ替えるたびに位置が動くと、選んだつもりの隣を選ばされる。
    // 取得時に1回だけシャッフルして固定する
    mockFetch(OK_RESPONSE);
    renderMap();
    await search();
    await screen.findByText("structure");

    const before = choiceLabels();
    const user = userEvent.setup();
    await user.click(within(document.getElementById("choices_drawer_container")!)
      .getAllByRole("button")[0]);
    expect(choiceLabels()).toEqual(before);
  });

  it("隠していない語は答えとして盤面に出す", async () => {
    mockFetch(OK_RESPONSE);
    renderMap();
    await search();
    await screen.findByText("structure");

    const board = document.getElementById("puzzle_steps_flex")!;
    expect(within(board).getByText("construct")).toBeInTheDocument();
    // 隠した語は盤面に出さない（出したら答えが見える）
    expect(within(board).queryByText("construction")).not.toBeInTheDocument();
  });
});
