import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * 広告枠。AdSense の設定が済んだときだけ出る（未設定の間は何も描かない）。
 * 設定済みの状態は手元では作れないので、設定を差し替えて見る。
 */
vi.mock("../src/adConfig", () => ({
  ADSENSE_CLIENT: "ca-pub-1234567890123456",
  ADSENSE_SLOT_FOOTER: "1234567890",
  ADS_ENABLED: true
}));

describe("広告枠", () => {
  it("広告であることを日本語で、読める濃さで示す", async () => {
    // 以前は英語の「Sponsored」を薄い灰（text-gray-300）で出しており、地の上で読めなかった
    const { default: AdBanner } = await import("../src/components/AdBanner");
    render(<AdBanner />);
    const label = screen.getByText("広告");
    expect(label.className).not.toMatch(/text-gray-(200|300|400)\b/);
    expect(screen.queryByText(/Sponsored/i)).toBeNull();
  });
});
