import { describe, it, expect, beforeEach } from "vitest";
import { initialOcean, saveOceanChoice, clearOceanChoice, canRenderOcean } from "../src/oceanSetting";

/**
 * 海の3D背景を使うかどうかの決め方（src/oceanSetting.ts）。
 * node 環境なので localStorage を最小限だけ用意する。
 */
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: k => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: k => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0
  } as Storage;
});

const env = (over: Partial<{ hasImage: boolean; saveData: boolean }> = {}) => ({ hasImage: false, saveData: false, ...over });

describe("海の3D背景の既定", () => {
  it("何も選んでいなければ使う", () => {
    expect(initialOcean(env())).toBe(true);
  });

  it("本人が選んだものがいちばん強い", () => {
    saveOceanChoice(false);
    expect(initialOcean(env())).toBe(false);
    saveOceanChoice(true);
    expect(initialOcean(env({ hasImage: true, saveData: true }))).toBe(true);
  });

  it("試験中の \"off\" は本人の選択とは限らないので読まない。\"on\" は引き継ぐ", () => {
    store.set("quest_bg_ocean", "off");
    expect(initialOcean(env())).toBe(true);
    store.set("quest_bg_ocean", "on");
    expect(initialOcean(env({ hasImage: true }))).toBe(true);
  });

  it("自分の画像を背景にしている人は、画像のまま", () => {
    expect(initialOcean(env({ hasImage: true }))).toBe(false);
  });

  it("データ節約の端末では使わない（約2MBを読むため）", () => {
    expect(initialOcean(env({ saveData: true }))).toBe(false);
  });
});

describe("画像を選んだとき", () => {
  it("「使わない」を保存せず、保存していた選択を消す（あとで画像を消せば既定に戻る）", () => {
    saveOceanChoice(true);
    store.set("quest_bg_ocean", "on");
    clearOceanChoice();
    expect(store.has("quest_bg_ocean_choice")).toBe(false);
    expect(store.has("quest_bg_ocean")).toBe(false);
    expect(initialOcean(env({ hasImage: true })), "画像のある人は画像のまま").toBe(false);
    expect(initialOcean(env()), "画像を消したら既定（使う）").toBe(true);
  });
});

describe("three.js を取りに行く前の下調べ", () => {
  /** getContext だけを持つ偽の document */
  function docWith(gl: unknown, seen: unknown[] = []) {
    return {
      createElement: () => ({
        getContext: (_type: string, attrs: unknown) => { seen.push(attrs); return gl; }
      })
    } as unknown as Document;
  }
  const fakeGl = (name: string | null) => {
    const lost = { called: false };
    return {
      lost,
      gl: {
        getExtension: (ext: string) =>
          ext === "WEBGL_debug_renderer_info" ? (name === null ? null : { UNMASKED_RENDERER_WEBGL: 1 })
            : ext === "WEBGL_lose_context" ? { loseContext: () => { lost.called = true; } } : null,
        getParameter: () => name
      }
    };
  };

  it("GPU で描ける端末は描く。確かめた WebGL はすぐ手放す", () => {
    const seen: unknown[] = [];
    const { gl, lost } = fakeGl("Apple GPU");
    expect(canRenderOcean(docWith(gl, seen))).toBe(true);
    expect(lost.called).toBe(true);
    // CPU での肩代わりしか無い端末で WebGL を作らないよう、ブラウザに頼む
    expect(seen[0]).toMatchObject({ failIfMajorPerformanceCaveat: true });
  });

  it("CPU でしか描けない端末（WebGL を作れない・名前が SwiftShader など）は描かない", () => {
    expect(canRenderOcean(docWith(null))).toBe(false);
    expect(canRenderOcean(docWith(fakeGl("Google SwiftShader").gl))).toBe(false);
  });

  it("名前を隠すブラウザでも、WebGL を作れたなら描く（重ければ画質の自動判定が止める）", () => {
    expect(canRenderOcean(docWith(fakeGl(null).gl))).toBe(true);
  });
});
