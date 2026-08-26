import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  BG_IMAGE_KEY, MAX_FILE_BYTES, MAX_EDGE, MAX_STORED_CHARS,
  checkFile, fitSize, readBackgroundImage, saveBackgroundImage, clearBackgroundImage
} from "../src/backgroundImage";

/**
 * 背景に使う画像。
 *
 * 写真は数MBあるのに、localStorage は多くのブラウザで5MB前後しかない。
 * そのまま入れると学習の記録（quest_srs や quest_solved_history）の保存まで
 * 巻き添えで失敗するので、受け取る前と保存する前の2か所で歯止めをかける。
 */

/** localStorage の最小実装（node 環境には存在しないため） */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
}
const store = new MemoryStorage();
(globalThis as any).localStorage = store;
afterAll(() => { delete (globalThis as any).localStorage; });
beforeEach(() => store.clear());

describe("選ばれたファイルの門番", () => {
  it("画像でないものは断る", () => {
    expect(checkFile({ type: "application/pdf", size: 1000 })).toMatch(/形式/);
    expect(checkFile({ type: "text/plain", size: 10 })).toMatch(/形式/);
    expect(checkFile(null)).toMatch(/選ばれていません/);
  });

  it("大きすぎるファイルは、読み込む前に断る", () => {
    // 読み込んでから断ると、その間に端末のメモリを食う
    expect(checkFile({ type: "image/jpeg", size: MAX_FILE_BYTES + 1 })).toMatch(/大きすぎます/);
    expect(checkFile({ type: "image/jpeg", size: MAX_FILE_BYTES })).toBeNull();
  });

  it("よくある画像の形式は通す", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(checkFile({ type, size: 1024 }), type).toBeNull();
    }
  });
});

describe("縮小後の大きさ", () => {
  it("長辺を上限に合わせ、縦横の比は変えない", () => {
    const r = fitSize(4000, 3000);
    expect(r.width).toBe(MAX_EDGE);
    expect(r.height).toBe(Math.round(3000 * (MAX_EDGE / 4000)));
    const tall = fitSize(1000, 5000);
    expect(tall.height).toBe(MAX_EDGE);
  });

  it("もともと小さい画像は引き伸ばさない", () => {
    expect(fitSize(320, 240)).toEqual({ width: 320, height: 240 });
  });
});

describe("保存と読み出し", () => {
  const tiny = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

  it("保存したものを読み出せる", () => {
    expect(saveBackgroundImage(tiny).ok).toBe(true);
    expect(readBackgroundImage()).toBe(tiny);
  });

  it("消すと、もとの飾りに戻る（null になる）", () => {
    saveBackgroundImage(tiny);
    clearBackgroundImage();
    expect(readBackgroundImage()).toBeNull();
  });

  it("画像以外が保存されていたら無視する", () => {
    // 手で書き換えられたときに、背景として読み込ませない
    store.setItem(BG_IMAGE_KEY, "javascript:alert(1)");
    expect(readBackgroundImage()).toBeNull();
    store.setItem(BG_IMAGE_KEY, "https://example.com/a.png");
    expect(readBackgroundImage()).toBeNull();
  });

  it("大きすぎる画像は保存しない", () => {
    const huge = "data:image/jpeg;base64," + "A".repeat(MAX_STORED_CHARS);
    const r = saveBackgroundImage(huge);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/大きすぎ/);
    expect(store.getItem(BG_IMAGE_KEY), "断ったのに保存している").toBeNull();
  });

  it("画像として読めない文字列は保存しない", () => {
    expect(saveBackgroundImage("data:text/html,<script>").ok).toBe(false);
  });
});
