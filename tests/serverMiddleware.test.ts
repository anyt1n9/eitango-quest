import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import type { Express } from "express";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * サーバーの手前の層（本文の読み込み・レート制限・存在しないパス）。
 *
 * issue #109: レート制限が本文の解析より後ろにあり、制限を超えたクライアントでも
 *   parse-pdf に 15MB の JSON を何度でも送れた（毎回読み込みと解析を済ませてから 429）。
 *   解析の失敗は Express 既定の HTML で返り、画面に英文のエラーが出ていた。
 * issue #110: 見つからなかった GET をすべて index.html にしていたため、
 *   存在しない /api/... や古いチャンク（/assets/*.js）にも HTML が 200 で返っていた。
 *
 * レート制限の回数はファイルごとに数え直されるよう、このファイルだけで使う。
 */

let app: Express;
let serveBuiltApp: (target: Express, distPath: string) => void;
let finishApiRoutes: (target: Express) => void;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.GEMINI_API_KEY = "";
  const mod = await import("../server");
  app = mod.app;
  serveBuiltApp = mod.serveBuiltApp;
  finishApiRoutes = mod.finishApiRoutes;
});

describe("本文の読み込みの失敗は日本語の JSON で返す", () => {
  it("壊れた JSON は 400", async () => {
    const res = await request(app)
      .post("/api/gemini/generate-word")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.type).toMatch(/json/);
    expect(res.body.error).toBe("リクエストの形式が正しくありません。");
  });

  it("上限（1MB）を超える本文は 413", async () => {
    const res = await request(app)
      .post("/api/gemini/generate-word")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ word: "x".repeat(1_100_000) }));
    expect(res.status).toBe(413);
    expect(res.type).toMatch(/json/);
    expect(res.body.error).toBe("送信するデータが大きすぎます。");
  });
});

describe("存在しない API", () => {
  it.each(["get", "post"] as const)("%s でも JSON の 404 を返す（index.html を返さない）", async method => {
    const res = await request(app)[method]("/api/nothing");
    expect(res.status).toBe(404);
    expect(res.type).toMatch(/json/);
    expect(res.body.error).toBe("指定された API はありません。");
  });
});

describe("API の中で起きた例外（finishApiRoutes）", () => {
  it("Express 既定の HTML ではなく、JSON の 500 で返す", async () => {
    const api = express();
    api.get("/api/boom", () => { throw new Error("boom"); });
    api.post("/api/later", (_req, _res, next) => { setTimeout(() => next(new Error("later")), 0); });
    finishApiRoutes(api);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const res of [await request(api).get("/api/boom"), await request(api).post("/api/later")]) {
        expect(res.status).toBe(500);
        expect(res.type).toMatch(/json/);
        expect(res.body.error).toBe("サーバーで問題が発生しました。時間をおいて再度お試しください。");
      }
      // 例外の中身（スタックなど）は利用者に返さず、記録にだけ残す
      expect(log).toHaveBeenCalledTimes(2);
    } finally {
      log.mockRestore();
    }
  });
});

describe("ビルド済みファイルの配信（serveBuiltApp）", () => {
  let dist: string;
  let site: Express;

  beforeAll(() => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), "dist-"));
    fs.writeFileSync(path.join(dist, "index.html"), "<!doctype html><title>app</title>");
    fs.mkdirSync(path.join(dist, "assets"));
    fs.writeFileSync(path.join(dist, "assets", "app-abc123.js"), "console.log(1)");
    site = express();
    serveBuiltApp(site, dist);
  });

  afterAll(() => fs.rmSync(dist, { recursive: true, force: true }));

  it.each(["/", "/dictionary", "/reading/aip_x1y2z3", "/grammar/present-perfect"])(
    "画面のパス %s には index.html を返す",
    async p => {
      const res = await request(site).get(p);
      expect(res.status).toBe(200);
      expect(res.type).toMatch(/html/);
    }
  );

  it("あるファイルはそのまま返す", async () => {
    const res = await request(site).get("/assets/app-abc123.js");
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/javascript/);
  });

  it.each(["/assets/Missing-old123.js", "/favicon.ico", "/api/nothing"])(
    "無いファイル・API %s は 404（HTML を 200 で返さない）",
    async p => {
      const res = await request(site).get(p);
      expect(res.status).toBe(404);
      expect(res.text).not.toMatch(/<title>app<\/title>/);
    }
  );
});

describe("レート制限は本文の解析より前（issue #109）", () => {
  it("制限を超えたあとは、本文を読まずに 429 で断る", async () => {
    // 制限（1分に40回）まで小さな要求で使い切る
    let limited = false;
    for (let i = 0; i < 60 && !limited; i++) {
      const res = await request(app).post("/api/gemini/generate-word").send({ word: "" });
      limited = res.status === 429;
    }
    expect(limited, "制限に届かなかった").toBe(true);

    // 解析より後ろで断っていたときは、壊れた本文が先に 400 になっていた
    const res = await request(app)
      .post("/api/gemini/parse-pdf")
      .set("Content-Type", "application/json")
      .send("{" + "x".repeat(2_000_000));
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
  });
});
