import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * 画面の描画テスト（tests/*.test.tsx）の共通準備。
 *
 * jsdom はブラウザではないので、この教材が使っている
 * 読み上げ(SpeechSynthesis)・アニメーション・スクロールは存在しない。
 * 無いまま描画すると本題と関係ない TypeError で落ちるため、最小限を埋める。
 */

// 読み上げ。実際に音は出せないので、呼ばれたことだけ記録できる形にする
class FakeUtterance {
  text: string;
  lang = "";
  rate = 1;
  pitch = 1;
  volume = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text = "") {
    this.text = text;
  }
}

Object.defineProperty(window, "SpeechSynthesisUtterance", {
  writable: true,
  value: FakeUtterance
});

Object.defineProperty(window, "speechSynthesis", {
  writable: true,
  value: {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [],
    speaking: false,
    paused: false,
    pending: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
});

// jsdom には無いブラウザAPI
window.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  })) as unknown as typeof window.matchMedia;
}

// motion（framer-motion 系）が使う。jsdom には実装が無い
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// テスト間で描画結果を持ち越さない
afterEach(() => {
  cleanup();
  localStorage.clear();
});
