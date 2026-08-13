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

const OK_RESPONSE = {
  connections: [
    { word: "construct", meaning: "建設する", note: "基本形" },
    { word: "structure", meaning: "構造", note: "名詞" }
  ],
  puzzle: [
    { word: "construct", pos: "動詞", masked: false },
    { word: "construction", pos: "名詞", masked: true },
    { word: "constructive", pos: "形容詞", masked: true }
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
