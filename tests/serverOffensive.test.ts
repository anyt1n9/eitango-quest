import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { OFFENSIVE_WORD_MESSAGE } from "../src/offensiveTerms";

/**
 * 単語追加の API（AI で1語・PDF から抽出）で、露骨な表現・罵倒語・差別語を断る。
 *
 * 画面（src/components/WordImport.tsx）でも断っているが、API を直接呼べば素通りする。
 * 決まりは収録データと同じ src/offensiveTerms.ts。
 *
 * Gemini は呼ばずに SDK を差し替え、返す中身をこちらで決める。
 */

const generateContent = vi.fn();

vi.mock("@google/genai", () => ({
  Type: new Proxy({}, { get: (_t, key) => String(key) }),
  GoogleGenAI: class {
    models = { generateContent };
  }
}));

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.GEMINI_API_KEY = "test-key-not-used";
  app = (await import("../server")).app;
});

beforeEach(() => {
  generateContent.mockReset();
});

const CLEAN_WORD = {
  translation: "置く", level: "senior", pos: "verb",
  options: ["置く", "走る", "見る", "食べる"],
  sentence: "Please [_____] the book on the desk.", sentenceTranslation: "机の上に本を置いてください。",
  sentenceOptions: ["lay", "run", "see", "eat"]
};

describe("AIで1語ずつ追加（/api/gemini/generate-word）", () => {
  it.each(["bitch", "son of a bitch", "idiot", "Porn"])("%s は AI に問い合わせずに断る", async word => {
    const res = await request(app).post("/api/gemini/generate-word").send({ word });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(OFFENSIVE_WORD_MESSAGE);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("綴りは普通でも、AI が露骨な訳を付けて返したら断る", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ ...CLEAN_WORD, translation: "セックスする" }) });
    const res = await request(app).post("/api/gemini/generate-word").send({ word: "lay" });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe(OFFENSIVE_WORD_MESSAGE);
    expect(res.body.translation).toBeUndefined();
  });

  it("普通の語はこれまでどおり返す", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(CLEAN_WORD) });
    const res = await request(app).post("/api/gemini/generate-word").send({ word: "lay" });
    expect(res.status).toBe(200);
    expect(res.body.word).toBe("lay");
    expect(res.body.translation).toBe("置く");
  });
});

describe("PDFからの抽出（/api/gemini/parse-pdf）", () => {
  it("抽出結果から不適切な語を除いて返す", async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify([
        { word: "evaluate", translation: "評価する", level: "senior" },
        { word: "porn", translation: "ポルノ", level: "senior" },
        { word: "station", translation: "駅", level: "junior", sentence: "The [_____] was full of shit." }
      ])
    });
    const res = await request(app).post("/api/gemini/parse-pdf").send({ pdfBase64: "JVBERi0xLjQK" });
    expect(res.status).toBe(200);
    expect(res.body.words.map((w: { word: string }) => w.word)).toEqual(["evaluate"]);
  });
});
