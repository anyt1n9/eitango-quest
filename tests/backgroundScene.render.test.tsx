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

  it("画像を選んでいるときは、その画像を出す（飾りは出さない）", () => {
    const url = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const { container } = render(<BackgroundScene motion={true} image={url} />);
    const photo = container.querySelector(".bg-photo") as HTMLElement;
    expect(photo, "画像の層が無い").not.toBeNull();
    expect(photo.style.backgroundImage).toContain(url);
    expect(container.querySelector(".bg-jungle"), "飾りと画像が二重に出ている").toBeNull();
    expect(container.querySelector(".bg-ocean"), "飾りと画像が二重に出ている").toBeNull();
  });

  it("画像の上には幕をかける", () => {
    // 幕が無いと、カードの外に出ている小さな文字が写真の柄に紛れて読めなくなる
    const { container } = render(
      <BackgroundScene motion={true} image="data:image/png;base64,iVBORw0KGgo=" />
    );
    expect(container.querySelector(".bg-photo-veil"), "幕が無い").not.toBeNull();
  });

  it("幕の濃さを選べる（既定はふつう）", () => {
    // 濃いままだと写真がぼやけて見え、何を選んだのか分からなくなる。
    // 逆に薄すぎると、カードの外の文字が柄に紛れる。利用者が決められるようにする
    const url = "data:image/png;base64,iVBORw0KGgo=";
    const { rerender } = render(<BackgroundScene motion={true} image={url} />);
    expect(screen.getByTestId("background_scene").dataset.veil).toBe("normal");
    rerender(<BackgroundScene motion={true} image={url} veil="light" />);
    expect(screen.getByTestId("background_scene").dataset.veil).toBe("light");
  });

  it("画像を使わず、図形だけで描く", () => {
    // 画像を足すと最初の読み込みが増える。飾りのために遅くしない
    const { container } = render(<BackgroundScene motion={true} />);
    expect(container.querySelectorAll("img").length).toBe(0);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(5);
  });
});
