import { describe, it, expect, afterEach, vi } from "vitest";
import { speechAvailability, canUseSpeech, speak, stopSpeaking, onVoicesChanged } from "../src/speech";

/**
 * 読み上げの可否判定。
 *
 * リスニング形式は綴りを隠して再生ボタンだけを見せるので、
 * 読み上げが使えない端末では手がかりの無い四択になり、答えようがなくなる。
 * 形式を選ぶ画面でも塞がれず、入ってから初めて詰んでいた。
 *
 * 逆に「使えないと決めつける」誤りも避けたい。音声の一覧は
 * ブラウザによっては後から埋まるため、空の一覧を根拠に塞ぐと
 * 実際には鳴る端末でリスニングを取り上げてしまう。
 */

/** window の読み上げAPIを差し替える。voices を null にすると API 自体を消す */
function stubSpeech(voices: { lang: string }[] | null) {
  const listeners: (() => void)[] = [];
  const synth = voices === null ? undefined : {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: () => voices,
    addEventListener: (_: string, fn: () => void) => { listeners.push(fn); },
    removeEventListener: (_: string, fn: () => void) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    }
  };
  (globalThis as any).window = {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: voices === null ? undefined : class {
      text: string; lang = ""; rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(t = "") { this.text = t; }
    }
  };
  (globalThis as any).SpeechSynthesisUtterance = (globalThis as any).window.SpeechSynthesisUtterance;
  return { synth, listeners };
}

afterEach(() => {
  delete (globalThis as any).window;
  delete (globalThis as any).SpeechSynthesisUtterance;
});

describe("読み上げが使えるかの判定", () => {
  it("APIが無ければ使えない", () => {
    stubSpeech(null);
    expect(speechAvailability()).toBe("unavailable");
    expect(canUseSpeech()).toBe(false);
  });

  it("英語の音声があれば使える", () => {
    stubSpeech([{ lang: "ja-JP" }, { lang: "en-US" }]);
    expect(speechAvailability()).toBe("ok");
    expect(canUseSpeech()).toBe(true);
  });

  it("英語の音声がひとつも無ければ使えない", () => {
    // 日本語の音声しか入っていない端末。英単語を読ませられない
    stubSpeech([{ lang: "ja-JP" }, { lang: "zh-CN" }]);
    expect(speechAvailability()).toBe("unavailable");
    expect(canUseSpeech()).toBe(false);
  });

  it("音声の一覧が空なら「分からない」とし、塞がない", () => {
    // 多くのブラウザは最初の呼び出しで空を返し、あとから埋める。
    // ここを「使えない」と断じると、実際には鳴る端末で
    // リスニングを取り上げてしまう
    stubSpeech([]);
    expect(speechAvailability()).toBe("unknown");
    expect(canUseSpeech()).toBe(true);
  });

  it("一覧の取得が例外を投げても落ちない", () => {
    (globalThis as any).window = {
      speechSynthesis: { getVoices: () => { throw new Error("boom"); } },
      SpeechSynthesisUtterance: class {}
    };
    expect(speechAvailability()).toBe("unknown");
  });

  it("en だけの言語表記も英語として扱う", () => {
    stubSpeech([{ lang: "en" }]);
    expect(speechAvailability()).toBe("ok");
  });

  it("en で始まる別の言語を英語と誤らない", () => {
    // "eng" のような表記は無いが、前方一致だけで見ると
    // 将来 "enm"(中英語) のような値を拾いかねない
    stubSpeech([{ lang: "enm-x-test" }]);
    expect(speechAvailability()).toBe("unavailable");
  });
});

describe("読み上げの実行", () => {
  it("使える環境では読み上げる", () => {
    const { synth } = stubSpeech([{ lang: "en-US" }]);
    expect(speak("beautiful")).toBe(true);
    expect(synth!.speak).toHaveBeenCalledTimes(1);
  });

  it("空文字は読み上げない", () => {
    const { synth } = stubSpeech([{ lang: "en-US" }]);
    expect(speak("   ")).toBe(false);
    expect(synth!.speak).not.toHaveBeenCalled();
  });

  it("APIが無ければ何もせず false を返す", () => {
    stubSpeech(null);
    expect(speak("beautiful")).toBe(false);
  });

  it("既定では直前の読み上げを止める", () => {
    const { synth } = stubSpeech([{ lang: "en-US" }]);
    speak("one");
    expect(synth!.cancel).toHaveBeenCalledTimes(1);
  });

  it("止めないよう指定できる（続けて読ませたいとき）", () => {
    const { synth } = stubSpeech([{ lang: "en-US" }]);
    speak("one", { cancelPrevious: false });
    expect(synth!.cancel).not.toHaveBeenCalled();
  });

  it("読み上げの失敗でも終了の通知が来る", () => {
    // onerror で通知しないと「読み上げ中」の表示が消えなくなる
    const { synth } = stubSpeech([{ lang: "en-US" }]);
    const onEnd = vi.fn();
    speak("beautiful", { onEnd });
    const utterance = (synth!.speak as any).mock.calls[0][0];
    expect(typeof utterance.onerror).toBe("function");
    utterance.onerror();
    expect(onEnd).toHaveBeenCalled();
  });

  it("停止はAPIが無くても落ちない", () => {
    stubSpeech(null);
    expect(() => stopSpeaking()).not.toThrow();
  });
});

describe("音声一覧の変化の購読", () => {
  it("購読して解除できる", () => {
    const { listeners } = stubSpeech([]);
    const fn = vi.fn();
    const off = onVoicesChanged(fn);
    expect(listeners.length).toBe(1);
    off();
    expect(listeners.length).toBe(0);
  });

  it("APIが無くても購読解除を呼べる", () => {
    stubSpeech(null);
    const off = onVoicesChanged(() => {});
    expect(() => off()).not.toThrow();
  });
});
