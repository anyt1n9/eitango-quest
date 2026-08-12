import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import QuizFormatPicker from "../src/components/QuizFormatPicker";
import Quiz from "../src/components/Quiz";
import { makeWord } from "./fixtures";

/**
 * 読み上げが使えない端末でのリスニング。
 *
 * リスニングは綴りを隠して再生ボタンだけを見せる。
 * 音声が無い端末（英語の音声が入っていない、APIが無い）では
 * 手がかりが何も無い四択になり、当てずっぽうでしか答えられない。
 * しかも形式を選ぶ画面では他と同じように選べてしまうので、
 * 入ってから初めて詰む。
 *
 * ここでは「選ばせない」ことと、それでも入ってしまったときに
 * 「綴りを見せて答えられる形にする」ことを固定する。
 */

/** 音声の一覧を差し替える。[] は「まだ読み込まれていない」を意味する */
function setVoices(voices: { lang: string }[]) {
  (window.speechSynthesis as any).getVoices = () => voices;
}

afterEach(() => {
  setVoices([]);
});

const WORDS = [makeWord({ id: "w1", word: "beautiful" }), makeWord({ id: "w2", word: "quiet" })];

describe("形式の選択", () => {
  it("英語の音声が無ければリスニングを選べない", () => {
    setVoices([{ lang: "ja-JP" }]);
    render(<QuizFormatPicker words={WORDS} onSelect={vi.fn()} />);
    expect(document.getElementById("review_format_listening")).toBeDisabled();
    expect(screen.getByText("この端末では音声を再生できません")).toBeInTheDocument();
  });

  it("英語の音声があれば選べる", () => {
    setVoices([{ lang: "en-US" }]);
    render(<QuizFormatPicker words={WORDS} onSelect={vi.fn()} />);
    expect(document.getElementById("review_format_listening")).not.toBeDisabled();
  });

  it("一覧がまだ空のうちは塞がない", () => {
    // 多くのブラウザは最初の呼び出しで空を返す。
    // ここで塞ぐと、実際には鳴る端末からリスニングを取り上げてしまう
    setVoices([]);
    render(<QuizFormatPicker words={WORDS} onSelect={vi.fn()} />);
    expect(document.getElementById("review_format_listening")).not.toBeDisabled();
  });

  it("音声が無くても他の形式は選べる", () => {
    setVoices([{ lang: "ja-JP" }]);
    render(<QuizFormatPicker words={WORDS} onSelect={vi.fn()} />);
    expect(document.getElementById("review_format_word")).not.toBeDisabled();
    expect(document.getElementById("review_format_spelling")).not.toBeDisabled();
  });
});

/** リスニングとして Quiz を描画する */
function renderListening() {
  render(
    <Quiz
      level="junior"
      vocabulary={WORDS}
      customWords={WORDS}
      questionCount={1}
      listeningMode
      wrongWords={[]}
      setWrongWords={vi.fn()}
      solvedHistory={{}}
      setSolvedHistory={vi.fn()}
      setStats={vi.fn()}
      onBackToDashboard={vi.fn()}
      updateRankingScore={vi.fn()}
      recordAnswer={vi.fn()}
      srsData={{}}
    />
  );
}

describe("出題中の代替", () => {
  it("音声が使えないときは綴りを見せる", () => {
    setVoices([{ lang: "ja-JP" }]);
    renderListening();
    expect(document.getElementById("listening_no_speech")).toBeInTheDocument();
    expect(
      screen.getByText("この端末では英語の音声を再生できないため、綴りを表示しています")
    ).toBeInTheDocument();
    // 出題語のどちらかの綴りが読める状態になっている
    const shown = document.getElementById("listening_no_speech")!.textContent || "";
    expect(WORDS.some(w => shown.includes(w.word))).toBe(true);
  });

  it("音声が使えるときは綴りを隠して再生ボタンを出す", () => {
    setVoices([{ lang: "en-US" }]);
    renderListening();
    expect(document.getElementById("listening_replay_btn")).toBeInTheDocument();
    expect(document.getElementById("listening_no_speech")).toBeNull();
  });
});
