import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OceanGuide from "../src/components/OceanGuide";
import { ART_IDS } from "../src/components/OceanGuideArt";
import { OCEAN_GUIDE } from "../src/ocean/guide";
import { OCEAN_GUIDE_TEXT } from "../src/data/oceanGuide";
import { DEPTH_STAGES } from "../src/ocean/depth";
import { todayStr } from "../src/srs";
import { makeWord } from "./fixtures";

/**
 * 海の図鑑の画面（src/components/OceanGuide.tsx）。
 *
 *   - 潜った深さで出会った生き物だけ名前と中身を見せ、まだの生き物は伏せる（URL で直接開かれても）
 *   - 出会った生き物は、英語の名前・発音・説明・例文・一緒に覚えたい単語を見せる
 *   - 記録の「海の深さ」から開け、URL（/ocean-guide/<id>）で開き直せる
 */

const TURTLE_WORDS = OCEAN_GUIDE_TEXT["sea-turtle"].words;
const VOCAB = [
  makeWord({ id: TURTLE_WORDS[0], word: "turtle", translation: "カメ、ウミガメ" }),
  makeWord({ id: TURTLE_WORDS[1], word: "shell", translation: "貝殻、殻" }),
  makeWord({ id: TURTLE_WORDS[2], word: "surface", translation: "表面，水面" }),
  // 4語目（breathe）は収録に無いものとして扱う（収録から外れた語は出さない）
];

function renderGuide(props: Partial<ComponentProps<typeof OceanGuide>> = {}) {
  const all: ComponentProps<typeof OceanGuide> = {
    vocabulary: VOCAB,
    solvedHistory: {},
    srsData: {},
    mastered: 4,
    reached: 0,
    oceanOn: true,
    initialCreatureId: null,
    onOpenCreatureChange: vi.fn(),
    onBack: vi.fn(),
    onOpenBackground: vi.fn(),
    ...props
  };
  const r = render(<OceanGuide {...all} />);
  return { ...all, ...r };
}

afterEach(() => cleanup());

describe("一覧", () => {
  it("潜った深さで出会った生き物の数と、次の深さで出会える数を出す", () => {
    renderGuide();
    expect(document.getElementById("ocean_guide_met")).toHaveTextContent(`4 / ${OCEAN_GUIDE.length}種`);
    expect(document.getElementById("ocean_guide_next")).toHaveTextContent(
      `あと${DEPTH_STAGES[1].minMastered - 4}語覚えて水深${DEPTH_STAGES[1].depth}mの「${DEPTH_STAGES[1].name}」へ潜ると、4種に出会えます。`
    );
  });

  it("出会った生き物は英語と日本語の名前を出し、まだの生き物は名前を伏せる", () => {
    renderGuide({ reached: 0 });
    for (const c of OCEAN_GUIDE) {
      const button = document.getElementById(`guide_entry_${c.id}`);
      if (c.stage === "shallows") {
        expect(button, c.id).not.toBeNull();
        expect(button).toHaveTextContent(c.name);
        expect(button).toHaveTextContent(c.ja);
      } else {
        expect(button, c.id).toBeNull();
        expect(document.querySelector(`[data-locked="${c.id}"]`), c.id).toHaveTextContent("まだ出会っていません");
      }
    }
    // 伏せた生き物の名前は、画面のどこにも出さない
    const page = document.getElementById("ocean_guide_screen")!;
    expect(page).not.toHaveTextContent("whale shark");
    expect(page).not.toHaveTextContent("ジンベエザメ");
    // まだ潜っていない段は、何語で潜れるかを書く
    const deep = screen.getByRole("region", { name: /深海/ });
    expect(deep).toHaveTextContent(`覚えた語${DEPTH_STAGES[5].minMastered.toLocaleString()}語で潜れます`);
  });

  it("いちばん深い段まで潜ったら、すべての生き物に出会っている", () => {
    renderGuide({ reached: DEPTH_STAGES.length - 1, mastered: 4000 });
    expect(document.getElementById("ocean_guide_met")).toHaveTextContent(`${OCEAN_GUIDE.length} / ${OCEAN_GUIDE.length}種`);
    expect(document.getElementById("ocean_guide_next")).toHaveTextContent("図鑑の生き物すべてに出会いました");
    expect(document.querySelectorAll("[data-locked]")).toHaveLength(0);
  });

  it("どの生き物にも絵がある", () => {
    expect([...ART_IDS].sort()).toEqual(OCEAN_GUIDE.map(c => c.id).sort());
    renderGuide({ reached: DEPTH_STAGES.length - 1 });
    for (const c of OCEAN_GUIDE) {
      const art = document.querySelector(`#guide_entry_${c.id} svg[data-art="${c.id}"]`);
      expect(art, c.id).not.toBeNull();
      expect(art!.querySelectorAll("path, circle").length, c.id).toBeGreaterThan(1);
      expect(art).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("海の3D背景を使っていない人には、使うと泳ぐ姿が見られることを伝え、背景の設定へ案内する", async () => {
    const user = userEvent.setup();
    const { onOpenBackground } = renderGuide({ oceanOn: false });
    await user.click(document.getElementById("btn_ocean_guide_background")!);
    expect(onOpenBackground).toHaveBeenCalledTimes(1);
    cleanup();
    renderGuide({ oceanOn: true });
    expect(document.getElementById("ocean_guide_ocean_off")).toBeNull();
  });
});

describe("1種ずつの説明", () => {
  beforeEach(() => vi.mocked(window.speechSynthesis.speak).mockClear());

  it("押すと開き、名前・出会う深さ・説明・例文・一緒に覚えたい単語を出す。戻ると一覧へ", async () => {
    const user = userEvent.setup();
    const { onOpenCreatureChange } = renderGuide({
      srsData: { [TURTLE_WORDS[1]]: { box: 3, dueDate: "2099-01-01", lastReview: todayStr(), reps: 3, lapses: 0 } }
    });
    await user.click(document.getElementById("guide_entry_sea-turtle")!);

    expect(screen.getByRole("heading", { name: "sea turtle" })).toBeInTheDocument();
    expect(document.getElementById("ocean_guide_detail")).toHaveTextContent("ウミガメ");
    expect(document.getElementById("ocean_guide_where")).toHaveTextContent("浅瀬（水深3m）で出会う");
    expect(document.getElementById("ocean_guide_about")).toHaveTextContent(OCEAN_GUIDE_TEXT["sea-turtle"].about);
    expect(document.getElementById("ocean_guide_example")).toHaveTextContent(OCEAN_GUIDE_TEXT["sea-turtle"].example[0]);
    expect(onOpenCreatureChange).toHaveBeenLastCalledWith("sea-turtle");

    // 一緒に覚えたい単語は収録にある語だけ。覚えた語には印を付ける
    const rows = within(document.getElementById("ocean_guide_words")!).getAllByRole("listitem");
    expect(rows.map(r => r.querySelector("[lang=en]")!.textContent)).toEqual(["turtle", "shell", "surface"]);
    expect(rows[0]).toHaveTextContent("カメ、ウミガメ");
    expect(rows[0]).not.toHaveTextContent("覚えた");
    expect(rows[1]).toHaveTextContent("覚えた");

    await user.click(screen.getByRole("button", { name: "図鑑の一覧に戻る" }));
    expect(document.getElementById("ocean_guide_screen")).not.toBeNull();
    expect(onOpenCreatureChange).toHaveBeenLastCalledWith(null);
  });

  it("名前と例文を読み上げる", async () => {
    const user = userEvent.setup();
    renderGuide({ initialCreatureId: "manta-ray" });
    await user.click(screen.getByRole("button", { name: "manta ray の発音を聴く" }));
    await user.click(screen.getByRole("button", { name: "例文を読み上げる" }));
    const spoken = vi.mocked(window.speechSynthesis.speak).mock.calls.map(c => (c[0] as unknown as { text: string }).text);
    expect(spoken).toEqual(["manta ray", OCEAN_GUIDE_TEXT["manta-ray"].example[0]]);
  });

  it("まだ出会っていない生き物は、URL で直接開かれても中身を見せない（一覧を出す）", () => {
    const { onOpenCreatureChange } = renderGuide({ reached: 1, initialCreatureId: "anglerfish" });
    expect(document.getElementById("ocean_guide_detail")).toBeNull();
    expect(document.getElementById("ocean_guide_screen")).not.toHaveTextContent("anglerfish");
    expect(onOpenCreatureChange).toHaveBeenLastCalledWith(null);
  });

  it("知らない ID でも白い画面にしない（一覧を出す）", () => {
    renderGuide({ initialCreatureId: "kraken" });
    expect(document.getElementById("ocean_guide_screen")).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ App で通しで */

vi.mock("../src/vocabulary", () => ({
  loadVocabulary: () => Promise.resolve(APP_WORDS),
  loadedVocabulary: () => null
}));

const APP_WORDS = Array.from({ length: 30 }, (_, i) => ({
  id: `s${i}`, word: `word${i}`, translation: `訳${i}`, level: "senior",
  sentence: "I like [_____].", sentenceTranslation: "好きです。",
  pos: "noun", options: [`訳${i}`, "小さい", "重い", "速い"], sentenceOptions: [`word${i}`, "small", "heavy", "fast"]
}));

async function renderApp(path: string) {
  window.history.pushState({}, "", path);
  const { default: App } = await import("../src/App");
  render(<App />);
  await waitFor(() => expect(document.getElementById("vocabulary_loading_screen")).toBeNull());
}

describe("App から", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("quest_stats", JSON.stringify({ score: 0, currentStreak: 1, lastLoginDate: todayStr(), completedQuestions: 0, correctAnswers: 0 }));
    localStorage.setItem("quest_ocean_reached", "reef");
  });

  it("記録の「海の深さ」から開き、生き物を開くと URL に持ち、戻ると記録へ帰る", async () => {
    const user = userEvent.setup();
    await renderApp("/records");
    const open = await screen.findByRole("button", { name: /^海の図鑑/ });
    expect(open).toHaveTextContent(`8 / ${OCEAN_GUIDE.length}種`);
    await user.click(open);

    await screen.findByRole("heading", { name: "海の図鑑", level: 1 });
    expect(window.location.pathname).toBe("/ocean-guide");
    // 下の階層の画面なので、開いた「記録」のタブを光らせる
    expect(document.querySelector("[aria-current='page']")).toHaveTextContent("記録");

    await user.click(document.getElementById("guide_entry_coral")!);
    expect(screen.getByRole("heading", { name: "coral" })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/ocean-guide/coral"));

    await user.click(screen.getByRole("button", { name: "図鑑の一覧に戻る" }));
    await waitFor(() => expect(window.location.pathname).toBe("/ocean-guide"));
    await user.click(document.getElementById("btn_ocean_guide_back")!);
    await waitFor(() => expect(window.location.pathname).toBe("/records"));
  });

  it("URL で生き物を開ける。まだ出会っていない生き物の URL は一覧に直す", async () => {
    await renderApp("/ocean-guide/butterflyfish");
    expect(await screen.findByRole("heading", { name: "butterflyfish" })).toBeInTheDocument();
    cleanup();

    await renderApp("/ocean-guide/whale-shark");
    await screen.findByRole("heading", { name: "海の図鑑", level: 1 });
    expect(document.getElementById("ocean_guide_detail")).toBeNull();
    await waitFor(() => expect(window.location.pathname).toBe("/ocean-guide"));
  });
});
