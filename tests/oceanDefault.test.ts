import { describe, it, expect, beforeEach } from "vitest";
import { initialOcean, saveOceanChoice } from "../src/oceanSetting";

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
