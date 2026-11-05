import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NoticeHost, { NOTICE_MS } from "../src/components/NoticeHost";
import { MAX_NOTICES, __resetNoticesForTest, getNotices, notify } from "../src/notice";

/**
 * 画面の中に出す知らせ（src/notice.ts・NoticeHost）。
 *
 * 以前はログインボーナス・長文の読破・AI長文・つながりパズル・単語の追加をブラウザの確認窓（alert）で
 * 知らせていた。確認窓は「OK」を押すまで画面全体を止め、文面には絵文字（🎉 ✨）が混ざっていた。
 */

beforeEach(() => {
  __resetNoticesForTest();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("画面の中の知らせ", () => {
  it("読み上げに伝わる入れ物に出す（入れ物は知らせが無いときも置いておく）", () => {
    render(<NoticeHost aboveTabBar />);
    const host = document.getElementById("notice_host")!;
    expect(host.getAttribute("aria-live")).toBe("polite");
    // 出題画面の正誤（role="status"）と並ばないよう、status にはしない
    expect(screen.queryByRole("status")).toBeNull();
    act(() => { notify("ログインボーナス 1日目：+100 P を受け取りました。", "success"); });
    expect(host).toHaveTextContent("+100 P を受け取りました");
    expect(screen.getByTestId("notice").dataset.tone).toBe("success");
  });

  it("少しすると消え、閉じるボタンでもすぐ消せる", async () => {
    vi.useFakeTimers();
    render(<NoticeHost aboveTabBar />);
    act(() => { notify("ひとつめ"); });
    act(() => { vi.advanceTimersByTime(NOTICE_MS - 100); });
    expect(screen.queryByText("ひとつめ")).not.toBeNull();
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByText("ひとつめ")).toBeNull();

    vi.useRealTimers();
    act(() => { notify("ふたつめ"); });
    await userEvent.click(screen.getByRole("button", { name: "知らせを閉じる" }));
    expect(screen.queryByText("ふたつめ")).toBeNull();
    expect(getNotices()).toHaveLength(0);
  });

  it("続けて出しても、並べるのは新しいものから決まった数まで", () => {
    render(<NoticeHost aboveTabBar />);
    act(() => { for (let i = 1; i <= MAX_NOTICES + 2; i++) notify(`知らせ${i}`); });
    expect(screen.getAllByTestId("notice")).toHaveLength(MAX_NOTICES);
    expect(screen.queryByText("知らせ1")).toBeNull();
    expect(screen.queryByText(`知らせ${MAX_NOTICES + 2}`)).not.toBeNull();
  });

  it("画面下のタブが無い画面では、画面の下端に寄せる", () => {
    const { rerender } = render(<NoticeHost aboveTabBar />);
    expect(document.getElementById("notice_host")!.className).toContain("5rem");
    rerender(<NoticeHost aboveTabBar={false} />);
    expect(document.getElementById("notice_host")!.className).not.toContain("5rem");
  });
});
