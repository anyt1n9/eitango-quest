import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

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

const created: { setActive: ReturnType<typeof vi.fn>; setMotion: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; motion: boolean }[] = [];
let failCreate = false;
vi.mock("../src/ocean/oceanScene", () => ({
  createOceanScene: (_canvas: HTMLCanvasElement, opts: { motion: boolean }) => {
    if (failCreate) throw new Error("Error creating WebGL context.");
    const s = { setActive: vi.fn(), setMotion: vi.fn(), dispose: vi.fn(), motion: opts.motion };
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
    render(<OceanBackground active={true} motion={true} />);
    const el = screen.getByTestId("background_scene");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.className).toContain("bg-scene");
    expect(el.dataset.kind).toBe("ocean");
    expect(created).toHaveLength(1);
  });

  it("出題中は隠して止めるが、作り直さない", async () => {
    const OceanBackground = await load();
    const { rerender, container } = render(<OceanBackground active={true} motion={true} />);
    rerender(<OceanBackground active={false} motion={true} />);
    expect(created).toHaveLength(1);
    expect(created[0].setActive).toHaveBeenLastCalledWith(false);
    // 出していない扱いにする（「出題中は背景を出さない」の決まりと同じ印）
    expect(screen.queryByTestId("background_scene")).toBeNull();
    expect((container.firstChild as HTMLElement).dataset.active).toBe("false");
    rerender(<OceanBackground active={true} motion={true} />);
    expect(created).toHaveLength(1);
    expect(created[0].setActive).toHaveBeenLastCalledWith(true);
  });

  it("メニューの「背景の動き」をオフにすると止める", async () => {
    const OceanBackground = await load();
    const { rerender } = render(<OceanBackground active={true} motion={true} />);
    rerender(<OceanBackground active={true} motion={false} />);
    expect(created[0].setMotion).toHaveBeenLastCalledWith(false);
  });

  it("端末の「視差効果を減らす」がオンなら、はじめから止めた状態で作る", async () => {
    reduced = true;
    const OceanBackground = await load();
    render(<OceanBackground active={true} motion={true} />);
    expect(created[0].motion).toBe(false);
    expect(created[0].setMotion).toHaveBeenLastCalledWith(false);
  });

  it("画面から外したら片付ける", async () => {
    const OceanBackground = await load();
    const { unmount } = render(<OceanBackground active={true} motion={true} />);
    unmount();
    expect(created[0].dispose).toHaveBeenCalledTimes(1);
  });

  it("WebGL が使えない端末では、海の色の地に切り替える（画面は落とさない）", async () => {
    failCreate = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const OceanBackground = await load();
    render(<OceanBackground active={true} motion={true} />);
    const el = await screen.findByTestId("background_scene");
    expect(el.dataset.kind).toBe("ocean-fallback");
    expect(el.querySelector("canvas")).toBeNull();
    warn.mockRestore();
  });
});
