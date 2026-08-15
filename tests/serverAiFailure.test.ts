import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

/**
 * APIキーはあるが Gemini の呼び出しが失敗したときの応答。
 *
 * tests/serverRoutes.test.ts が見ているのは「キーが無い」場合で、
 * こちらは「キーはあるが呼べなかった」場合。利用者から見れば同じ
 * 「AIの答えが得られなかった」状況なので、どちらも作り話を返してはいけない。
 *
 * 頻度分析はここで、綴りの語尾から推測した「簡易推定」と汎用の例文を
 * 200 で返していた。断り書きは画面に出していたが、他の6機能は同じ状況で
 * 断るので、利用者から見て挙動が揃わない。
 *
 * Gemini は呼ばずに、SDK を差し替えて必ず失敗させる。
 */

// server.ts は Type.OBJECT のような定数をモジュール読み込み時に使うので、
// 名前をそのまま返すだけの器を渡しておく
vi.mock("@google/genai", () => ({
  Type: new Proxy({}, { get: (_t, key) => String(key) }),
  GoogleGenAI: class {
    models = {
      generateContent: async () => {
        throw new Error("模擬的な通信エラー");
      }
    };
  }
}));

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  // 中身は使われない（SDK を差し替えているため）が、
  // 「キー未設定の 503」を通り抜けさせるために非空にする
  process.env.GEMINI_API_KEY = "test-key-not-used";
  app = (await import("../server")).app;
});

describe("AIの呼び出しが失敗したときの応答", () => {
  const AI_ONLY: [name: string, path: string, body: object][] = [
    ["単語追加", "/api/gemini/generate-word", { word: "serendipity" }],
    ["つながりマップ", "/api/gemini/connection-map", { word: "beautiful" }],
    ["英語日記", "/api/gemini/diary", { words: ["library", "station"] }],
    ["頻度分析", "/api/gemini/word-frequency", { word: "library" }],
    ["長文生成", "/api/gemini/generate-passage", { level: "junior" }],
    ["類義語", "/api/gemini/word-relations", { word: "library" }],
    ["PDF取り込み", "/api/gemini/parse-pdf", { pdfBase64: "JVBERi0xLjQK" }]
  ];

  it.each(AI_ONLY)("%s は 502 で断る（作り話を返さない）", async (_name, path, body) => {
    const res = await request(app).post(path).send(body);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/時間をおいて再度お試しください/);
    // AIの結果を装った中身が混ざっていない
    expect(res.body.words).toBeUndefined();
    expect(res.body.diaryText).toBeUndefined();
    expect(res.body.connections).toBeUndefined();
    expect(res.body.frequencies).toBeUndefined();
    expect(res.body.usageExamples).toBeUndefined();
    expect(res.body.passage).toBeUndefined();
  });

  it("集計で作れるものは失敗しても 200 で返し、出どころを書く", async () => {
    // 苦手分析はAIが要らない。ただし手元で組み立てたことを隠さない
    const res = await request(app)
      .post("/api/gemini/weakness-analysis")
      .send({ wrongWords: [{ word: "beautiful", translation: "美しい", pos: "adjective" }] });
    expect(res.status).toBe(200);
    expect(res.body.isFallback).toBe(true);
  });
});
