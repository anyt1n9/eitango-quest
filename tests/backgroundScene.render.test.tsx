import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BackgroundScene from "../src/components/BackgroundScene";

/**
 * 背景の飾り（明るいテーマ＝ジャングル／暗いテーマ＝海）。
 *
 * 飾りなので、画面の中身に触れないことがいちばん大事になる。
 * 押せなくなる・読み上げに混ざる・文字が読みにくくなる、のどれかが起きると
 * 学習の邪魔になるので、そこを固定する。
 */
describe("背景の飾り", () => {
  it("読み上げから外し、押す操作も奪わない", () => {
    render(<BackgroundScene motion={true} />);
    const scene = screen.getByTestId("background_scene");
    expect(scene.getAttribute("aria-hidden")).toBe("true");
    // pointer-events は CSS 側（.bg-scene）で切る。クラス名で確かめる
    expect(scene.className).toContain("bg-scene");
  });

  it("ジャングルと海の両方を持ち、テーマで出し分ける", () => {
    const { container } = render(<BackgroundScene motion={true} />);
    expect(container.querySelector(".bg-jungle"), "ジャングルが無い").not.toBeNull();
    expect(container.querySelector(".bg-ocean"), "海が無い").not.toBeNull();
    // ジャングルの中身（葉・つる・木漏れ日）と海の中身（エイ・泡）
    expect(container.querySelectorAll(".bg-frond").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".bg-vine").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".bg-leaf").length).toBeGreaterThan(4);
    expect(container.querySelectorAll(".bg-ray").length).toBe(3);
  });

  it("動きを止められる", () => {
    // 動くものが視界にあると落ち着かない人がいる。
    // 端末の設定（prefers-reduced-motion）は CSS で常に効くが、
    // アプリの中でも切れるようにしてある
    const { rerender } = render(<BackgroundScene motion={true} />);
    expect(screen.getByTestId("background_scene").dataset.motion).toBe("on");
    rerender(<BackgroundScene motion={false} />);
    expect(screen.getByTestId("background_scene").dataset.motion).toBe("off");
  });

  it("画像を使わず、図形だけで描く", () => {
    // 画像を足すと最初の読み込みが増える。飾りのために遅くしない
    const { container } = render(<BackgroundScene motion={true} />);
    expect(container.querySelectorAll("img").length).toBe(0);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(5);
  });
});
