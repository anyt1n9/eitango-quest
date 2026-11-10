import { describe, it, expect, vi, beforeEach } from "vitest";
import { StrictMode } from "react";
import { render, screen, cleanup, act } from "@testing-library/react";

/**
 * 海の3D背景（OceanBackground）の振る舞い。
 *
 * 3D の描画そのものは jsdom では動かないので、描く部品（createOceanScene）を差し替えて、
 * 「いつ作り・いつ止め・いつ片付けるか」を見る。
 *   - 出題中は描くのをやめて隠す。ただし作り直さない（3Dモデルの準備がやり直しになる）
 *   - 「視差効果を減らす」とメニューの「背景の動き」で止める
 *   - 画面から外したら片付ける（WebGL の資源を手放す）
 *   - WebGL が使えない端末では、海の色の地に切り替えて画面を落とさない
 */

type Fake = {
  setActive: ReturnType<typeof vi.fn>; setMotion: ReturnType<typeof vi.fn>; setDepth: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  motion: boolean; depth?: number; canvas: HTMLCanvasElement; fail: (reason: string) => void;
  modelUrl: string; fishUrls?: Record<string, string>;
};
const created: Fake[] = [];
let failCreate = false;
vi.mock("../src/ocean/oceanScene", () => ({
  createOceanScene: (canvas: HTMLCanvasElement, opts: { modelUrl: string; fishUrls?: Record<string, string>; motion: boolean; depth?: number; onFail?: (r: string) => void }) => {
    if (failCreate) throw new Error("Error creating WebGL context.");
    const s = {
      setActive: vi.fn(), setMotion: vi.fn(), setDepth: vi.fn(), dispose: vi.fn(), motion: opts.motion, depth: opts.depth, canvas,
      modelUrl: opts.modelUrl, fishUrls: opts.fishUrls,
      fail: (reason: string) => opts.onFail?.(reason),
    };
    created.push(s);
    return s;
  },
}));

let reduced = false;
beforeEach(() => {
  created.length = 0;
  failCreate = false;
  reduced = false;
  window.matchMedia = ((q: string) => ({
    matches: q.includes("reduce") ? reduced : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  cleanup();
});

async function load() {
  return (await import("../src/components/OceanBackground")).default;
}

describe("海の3D背景", () => {
  it("読み上げから外し、背景の層として出す", async () => {
    const OceanBackground = await load();
    render(<OceanBackground active={true} motion={true} depth={8} />);
    const el = screen.getByTestId("background_scene");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.className).toContain("bg-scene");
    expect(el.dataset.kind).toBe("ocean");
    // 3Dモデルと、写真から作った魚の形（6種）を渡す。魚の形を渡し忘れると、何も言わずに
    // 群れと熱帯魚は簡単な形に戻り、ナポレオンフィッシュとチョウチンアンコウは出なくなる
    expect(created[0].modelUrl).toMatch(/ocean\.glb/);
    const { PHOTO_FISH_IDS } = await import("../src/ocean/photoFish");
    for (const id of PHOTO_FISH_IDS) expect(created[0].fishUrls?.[id], id).toMatch(new RegExp(`ocean-${id}\\.glb`));
    expect(created).toHaveLength(1);
  });

  it("出題中は隠して止めるが、作り直さない", async () => {
    const OceanBackground = await load();
    const { rerender, container } = render(<OceanBackground active={true} motion={true} depth={8} />);
    rerender(<OceanBackground active={false} motion={true} depth={8} />);
    expect(created).toHaveLength(1);
    expect(created[0].setActive).toHaveBeenLastCalledWith(false);
    // 出していない扱いにする（「出題中は背景を出さない」の決まりと同じ印）
    expect(screen.queryByTestId("background_scene")).toBeNull();
    expect((container.firstChild as HTMLElement).dataset.active).toBe("false");
    rerender(<OceanBackground active={true} motion={true} depth={8} />);
    expect(created).toHaveLength(1);
    expect(created[0].setActive).toHaveBeenLastCalledWith(true);
  });

  it("メニューの「背景の動き」をオフにすると止める", async () => {
    const OceanBackground = await load();
    const { rerender } = render(<OceanBackground active={true} motion={true} depth={8} />);
    rerender(<OceanBackground active={true} motion={false} depth={8} />);
    expect(created[0].setMotion).toHaveBeenLastCalledWith(false);
  });

  it("端末の「視差効果を減らす」がオンなら、はじめから止めた状態で作る", async () => {
    reduced = true;
    const OceanBackground = await load();
    render(<OceanBackground active={true} motion={true} depth={8} />);
    expect(created[0].motion).toBe(false);
    expect(created[0].setMotion).toHaveBeenLastCalledWith(false);
  });

  it("画面から外したら片付ける", async () => {
    const OceanBackground = await load();
    const { unmount } = render(<OceanBackground active={true} motion={true} depth={8} />);
    unmount();
    expect(created[0].dispose).toHaveBeenCalledTimes(1);
  });

  it("描く場所（canvas）は作るたびに新しくする（開発時の StrictMode で、手放した WebGL を使い回さない）", async () => {
    const OceanBackground = await load();
    const { container } = render(<StrictMode><OceanBackground active={true} motion={true} depth={8} /></StrictMode>);
    // StrictMode は「作る→片付ける→作る」と走る
    expect(created.length).toBe(2);
    expect(created[0].dispose).toHaveBeenCalledTimes(1);
    expect(created[1].canvas).not.toBe(created[0].canvas);
    expect(created[0].canvas.isConnected, "片付けた canvas が残っている").toBe(false);
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
  });

  it("3Dモデルを取れない・WebGL を失って戻らないときは、片付けて海の色の地にする", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const OceanBackground = await load();
    const { container } = render(<OceanBackground active={true} motion={true} depth={8} />);
    act(() => created[0].fail("model"));
    expect(screen.getByTestId("background_scene").dataset.kind).toBe("ocean-fallback");
    expect(created[0].dispose).toHaveBeenCalledTimes(1);
    expect(container.querySelector("canvas")).toBeNull();
    expect(created).toHaveLength(1);
    warn.mockRestore();
  });

  it("描けているかを App に伝える（作れたら true、続けられなくなった・外したら false）", async () => {
    // App の「海を眺める」はこれが true のときだけ出す
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const OceanBackground = await load();
    const drawing = vi.fn();
    const { unmount } = render(<OceanBackground active={true} motion={true} depth={8} onDrawingChange={drawing} />);
    expect(drawing).toHaveBeenLastCalledWith(true);
    act(() => created[0].fail("model"));
    expect(drawing).toHaveBeenLastCalledWith(false);

    drawing.mockClear();
    const second = render(<OceanBackground active={true} motion={true} depth={8} onDrawingChange={drawing} />);
    expect(drawing).toHaveBeenLastCalledWith(true);
    second.unmount();
    expect(drawing).toHaveBeenLastCalledWith(false);
    unmount();
    warn.mockRestore();
  });

  it("WebGL を作れなければ、描けているとは伝えない", async () => {
    failCreate = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const OceanBackground = await load();
    const drawing = vi.fn();
    render(<OceanBackground active={true} motion={true} depth={8} onDrawingChange={drawing} />);
    await screen.findByTestId("background_scene");
    expect(drawing).not.toHaveBeenCalledWith(true);
    warn.mockRestore();
  });

  it("WebGL が使えない端末では、海の色の地に切り替える（画面は落とさない）", async () => {
    failCreate = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const OceanBackground = await load();
    render(<OceanBackground active={true} motion={true} depth={8} />);
    const el = await screen.findByTestId("background_scene");
    expect(el.dataset.kind).toBe("ocean-fallback");
    expect(el.querySelector("canvas")).toBeNull();
    warn.mockRestore();
  });

  it("水深が変わったら、作り直さずに潜る（はじめの水深は作るときに渡す）", async () => {
    const OceanBackground = await load();
    const { rerender } = render(<OceanBackground active={true} motion={true} depth={8} />);
    expect(created[0].depth).toBe(8);
    rerender(<OceanBackground active={true} motion={true} depth={18} />);
    expect(created).toHaveLength(1);
    expect(created[0].setDepth).toHaveBeenLastCalledWith(18, true);
    // 出題中に深くなったときも、作り直さずに渡しておく（描きはじめたときに潜る）
    rerender(<OceanBackground active={false} motion={true} depth={35} />);
    expect(created).toHaveLength(1);
    expect(created[0].setDepth).toHaveBeenLastCalledWith(35, true);
  });

  it("3D を描けないときの海の色の地も、いまの深さの色にする", async () => {
    failCreate = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const OceanBackground = await load();
    const { rerender } = render(<OceanBackground active={true} motion={true} depth={3} />);
    const el = await screen.findByTestId("background_scene");
    const shallow = el.style.background;
    expect(shallow).toContain("gradient");
    rerender(<OceanBackground active={true} motion={true} depth={250} />);
    expect(el.style.background).not.toBe(shallow);
    expect(el.dataset.depth).toBe("250");
    warn.mockRestore();
  });
});
