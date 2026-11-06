import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { todayStr } from "../src/srs";
import { __resetNoticesForTest, getNotices } from "../src/notice";
import { DEPTH_STAGES } from "../src/ocean/depth";
import OceanDepthCard from "../src/components/OceanDepthCard";

/**
 * 海の深さ（段階③）を App で通しで見る。
 *
 *   - 覚えた語が段の語数に届いたら潜る。知らせは出題を終えてから出す（解いている最中の画面に重ねない）
 *   - 一度潜った深さは、覚えた語数が下がっても戻さない（復習で間違えるとボックスが下がるため）
 *   - 潜ったことのある深さなら、背景の設定で浅い方も選べる。まだ潜っていない深さは選べない
 *
 * jsdom には WebGL が無いので、海は「海の色の地」（.bg-ocean3d）になる。地も深さの色にするので、
 * いま出している深さは地の data-depth で分かる。
 */

vi.mock("../src/vocabulary", () => ({
  loadVocabulary: () => Promise.resolve(WORDS),
  loadedVocabulary: () => null
}));

const word = (id: string, w: string, t: string, level: string) => ({
  id, word: w, translation: t, level,
  sentence: "I like [_____].", sentenceTranslation: "好きです。",
  pos: "noun", options: [t, "小さい", "重い", "速い"], sentenceOptions: [w, "small", "heavy", "fast"]
});
// 出題するのは初級の1語（apple）だけ。ほかの29語は上の級で、どれも覚えた語にしておく
const WORDS = [
  word("j1", "apple", "りんご", "junior"),
  ...Array.from({ length: 29 }, (_, i) => word(`s${i}`, `word${i}`, `訳${i}`, "senior"))
];
const REEF = DEPTH_STAGES[1];

function seedSrs(masteredSenior: number, appleBox: number) {
  const today = todayStr();
  const srs: Record<string, unknown> = {};
  for (let i = 0; i < masteredSenior; i++) srs[`s${i}`] = { box: 2, dueDate: "2099-01-01", lastReview: today, reps: 2, lapses: 0 };
  if (appleBox > 0) srs.j1 = { box: appleBox, dueDate: today, lastReview: today, reps: 1, lapses: 0 };
  localStorage.setItem("quest_srs", JSON.stringify(srs));
}

async function renderApp(path = "/") {
  window.history.pushState({}, "", path);
  const { default: App } = await import("../src/App");
  render(<App />);
  await waitFor(() => expect(document.getElementById("vocabulary_loading_screen")).toBeNull());
}

const oceanDepth = () => document.querySelector<HTMLElement>(".bg-ocean3d")?.dataset.depth;
const depthNotices = () => getNotices().filter(n => n.message.includes("水深"));

beforeEach(() => {
  localStorage.clear();
  __resetNoticesForTest();
  // 起動時に出るボーナスの知らせなどと混ざらないよう、今日は受け取り済みにしておく
  localStorage.setItem("quest_stats", JSON.stringify({ score: 0, currentStreak: 1, lastLoginDate: todayStr(), completedQuestions: 0, correctAnswers: 0 }));
});
afterEach(() => cleanup());

describe("海の深さ", () => {
  it("覚えた語が段の語数に届いたら潜る。知らせは出題を終えてから出す", async () => {
    // 29語を覚えていて、apple はあと1回の正解で覚えた語に入る（30語＝サンゴ礁）
    seedSrs(29, 1);
    await renderApp();
    expect(oceanDepth()).toBe(String(DEPTH_STAGES[0].depth));

    const user = userEvent.setup();
    await user.click(document.getElementById("btn_junior_word")!);
    await user.click(within(document.getElementById("quiz_options_container")!).getByText("りんご"));
    // 解いている最中（出題中）には出さない
    expect(localStorage.getItem("quest_ocean_reached")).toBe(REEF.id);
    expect(depthNotices()).toHaveLength(0);

    // 正解すると少しして結果の画面になる。そこから戻ると知らせが出る
    const back = await screen.findByRole("button", { name: "戻る" }, { timeout: 4000 });
    expect(depthNotices()).toHaveLength(0);
    await user.click(back);
    await waitFor(() => expect(depthNotices()).toHaveLength(1));
    expect(depthNotices()[0].message).toContain(`水深${REEF.depth}mの「${REEF.name}」`);
    expect(oceanDepth()).toBe(String(REEF.depth));
  });

  it("はじめて開いたとき（潜った記録が無い）は、いまの覚えた語数の深さにして、そう知らせる", async () => {
    seedSrs(29, 2);
    await renderApp();
    await waitFor(() => expect(oceanDepth()).toBe(String(REEF.depth)));
    expect(localStorage.getItem("quest_ocean_reached")).toBe(REEF.id);
    expect(depthNotices()).toHaveLength(1);
  });

  it("一度潜った深さは、覚えた語数が下がっても戻さない（知らせも出さない）", async () => {
    seedSrs(0, 0);
    localStorage.setItem("quest_ocean_reached", "slope");
    await renderApp();
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(oceanDepth()).toBe(String(DEPTH_STAGES[2].depth));
    expect(localStorage.getItem("quest_ocean_reached")).toBe("slope");
    expect(depthNotices()).toHaveLength(0);
  });

  it("海の3D背景を使っていない人には知らせない（潜った記録は残す）。記録の画面にも深さの欄を出さない", async () => {
    localStorage.setItem("quest_bg_ocean_choice", "off");
    seedSrs(29, 2);
    await renderApp("/records");
    await waitFor(() => expect(localStorage.getItem("quest_ocean_reached")).toBe(REEF.id));
    expect(depthNotices()).toHaveLength(0);
    expect(document.getElementById("ocean_depth_section")).toBeNull();
  });

  it("記録の画面に、いまの深さと次の深さまでの語数を出す", async () => {
    seedSrs(29, 2);
    localStorage.setItem("quest_ocean_reached", REEF.id);
    await renderApp("/records");
    const card = await screen.findByRole("region", { name: "海の深さ" });
    expect(card).toHaveTextContent(`水深 ${REEF.depth}m`);
    expect(card).toHaveTextContent(REEF.name);
    expect(card).toHaveTextContent("覚えた語 30語");
    const next = DEPTH_STAGES[2];
    expect(card).toHaveTextContent(`あと${next.minMastered - 30}語覚えると、水深${next.depth}mの「${next.name}」まで潜れます。`);
    expect(within(card).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("背景の設定で、潜ったことのある浅い深さを選べる。まだ潜っていない深さは選べない", async () => {
    seedSrs(0, 0);
    localStorage.setItem("quest_ocean_reached", "offshore");
    await renderApp("/records");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "背景に出す深さを選ぶ" }));

    const picker = await screen.findByRole("group", { name: "海の深さ" });
    expect(within(picker).getByRole("button", { name: /^いちばん深いところ/ })).toHaveAttribute("aria-pressed", "true");
    const twilight = document.getElementById("btn_depth_twilight") as HTMLButtonElement;
    expect(twilight.disabled).toBe(true);
    expect(twilight).toHaveTextContent(`覚えた語が${DEPTH_STAGES[4].minMastered.toLocaleString()}語になると潜れます`);

    await user.click(document.getElementById("btn_depth_reef")!);
    expect(document.getElementById("btn_depth_reef")).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("quest_bg_ocean_depth")).toBe("reef");
    expect(oceanDepth()).toBe(String(REEF.depth));

    // 記録の画面には、潜った深さと、背景に出している深さの両方が分かるように出す
    await user.click(screen.getByRole("button", { name: /戻る/ }));
    const card = await screen.findByRole("region", { name: "海の深さ" });
    expect(card).toHaveTextContent(`水深 ${DEPTH_STAGES[3].depth}m`);
    expect(card).toHaveTextContent(`背景には、水深${REEF.depth}mの「${REEF.name}」を出しています。`);
  });

  it("まだ潜っていない深さが保存されていても（バックアップの復元・手での編集）、潜った深さまでしか出さない", async () => {
    seedSrs(0, 0);
    localStorage.setItem("quest_ocean_reached", "reef");
    localStorage.setItem("quest_bg_ocean_depth", "deep");
    await renderApp();
    expect(oceanDepth()).toBe(String(REEF.depth));
  });

  it("いちばん深い段まで潜ったら、次の深さの代わりにそう書く", () => {
    render(<OceanDepthCard info={{ mastered: 4000, reached: DEPTH_STAGES.length - 1, shown: DEPTH_STAGES.length - 1 }} onOpenBackground={() => {}} />);
    const card = screen.getByRole("region", { name: "海の深さ" });
    expect(card).toHaveTextContent("いちばん深い海まで潜りました。");
    expect(within(card).queryByRole("progressbar")).toBeNull();
  });
});
